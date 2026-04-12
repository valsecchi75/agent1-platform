// Custom Next.js server with extended timeout and self-restart capability.
//
// Architecture: supervisor → worker
//   - In "supervisor" mode (default): forks itself as a worker, watches for exit,
//     and re-spawns on restart (exit code 0) or graceful shutdown signals.
//   - In "worker" mode (AGENT1_WORKER=1): runs the actual Next.js HTTP server.
//   - POST /api/restart triggers process.exit(0) in the worker, which the
//     supervisor catches and re-forks automatically.

const { fork, execSync } = require('child_process');
const { createServer } = require('http');
const next = require('next');
const path = require('path');
const fs = require('fs');

// ─── Post-Update Build ──────────────────────────────────────────────────────
// After a delta update, the source files on disk are newer than the .next build.
// The update engine writes a marker file; on next process start we detect it,
// run `npm run build`, and delete the marker before launching Next.js.
// This solves the bootstrap problem: even if the OLD update engine (pre-build-step)
// applied the delta, the NEW server.js (delivered by that same delta) will run
// the build on next restart.

const UPDATE_MARKER = path.resolve(__dirname, '.update-pending');

function runPostUpdateBuild() {
  if (!fs.existsSync(UPDATE_MARKER)) return;

  let markerData = {};
  try {
    markerData = JSON.parse(fs.readFileSync(UPDATE_MARKER, 'utf-8'));
  } catch { /* ignore parse errors */ }

  const version = markerData.version || 'unknown';
  console.log(`[post-update] Update to v${version} detected — building...`);

  // Clean stale .next cache
  const nextDir = path.resolve(__dirname, '.next');
  try {
    if (fs.existsSync(nextDir)) {
      fs.rmSync(nextDir, { recursive: true, force: true });
      console.log('[post-update] Cleared .next cache');
    }
  } catch (err) {
    console.warn(`[post-update] Could not clear .next: ${err.message}`);
  }

  // Run build
  try {
    console.log('[post-update] Running npm run build...');
    execSync('npm run build', {
      cwd: __dirname,
      timeout: 5 * 60 * 1000,
      stdio: 'inherit',
    });
    console.log('[post-update] Build completed successfully');
  } catch (err) {
    console.error(`[post-update] Build failed: ${err.message}`);
    console.error('[post-update] The app may not work correctly. Try running "npm run build" manually.');
    // Don't delete marker — will retry on next launch
    return;
  }

  // Delete marker only on success
  try {
    fs.unlinkSync(UPDATE_MARKER);
  } catch { /* best effort */ }

  console.log(`[post-update] Update to v${version} applied successfully`);
}

// ─── Supervisor ──────────────────────────────────────────────────────────────

if (!process.env.AGENT1_WORKER) {
  // Run post-update build BEFORE spawning worker (blocks until done)
  runPostUpdateBuild();

  let worker = null;
  let shuttingDown = false;

  function spawnWorker() {
    console.log('[supervisor] Starting worker…');
    worker = fork(path.resolve(__dirname, 'server.js'), [], {
      env: { ...process.env, AGENT1_WORKER: '1' },
      stdio: 'inherit',
    });

    worker.on('exit', (code, signal) => {
      if (shuttingDown) {
        console.log('[supervisor] Worker stopped — shutting down.');
        process.exit(0);
      }
      if (code === 0) {
        // Restart requested (from /api/restart or post-update)
        // Re-check for update marker before re-spawning
        runPostUpdateBuild();
        console.log('[supervisor] Worker exited with code 0 — restarting…');
        setTimeout(spawnWorker, 300);
      } else {
        console.error(`[supervisor] Worker crashed (code=${code}, signal=${signal}) — restarting in 2s…`);
        setTimeout(spawnWorker, 2000);
      }
    });
  }

  // Forward termination signals to worker, then exit
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => {
      shuttingDown = true;
      if (worker) worker.kill(sig);
      else process.exit(0);
    });
  }

  spawnWorker();

// ─── Worker ──────────────────────────────────────────────────────────────────

} else {
  const dev = process.env.NODE_ENV !== 'production';
  const hostname = 'localhost';
  const port = process.env.PORT || 3000;

  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();

  app.prepare().then(() => {
    const server = createServer(async (req, res) => {
      await handle(req, res);
    });

    // Handle WebSocket upgrade for Next.js HMR in dev mode.
    // Use getUpgradeHandler() (Next.js 16+) if available — it correctly handles
    // the WebSocket handshake. The plain request handler must NOT be used here
    // (socket lacks getHeader/end/write methods and will crash).
    const upgradeHandler = app.getUpgradeHandler?.();
    if (upgradeHandler) {
      server.on('upgrade', async (req, socket, head) => {
        try {
          await upgradeHandler(req, socket, head);
        } catch {
          // Ignore upgrade errors (e.g. empty URL during browser connect/reconnect)
        }
      });
    }

    // Increase timeout to 10 minutes for long-running video generation
    server.requestTimeout = 600000; // 10 minutes
    server.headersTimeout = 610000; // Slightly longer than requestTimeout

    server.listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> Server timeout set to ${server.requestTimeout / 1000 / 60} minutes`);
    });
  });
}
