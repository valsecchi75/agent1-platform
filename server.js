// Custom Next.js server with extended timeout and self-restart capability.
//
// Architecture: supervisor → worker
//   - In "supervisor" mode (default): forks itself as a worker, watches for exit,
//     and re-spawns on restart (exit code 0) or graceful shutdown signals.
//   - In "worker" mode (AGENT1_WORKER=1): runs the actual Next.js HTTP server.
//   - POST /api/restart triggers process.exit(0) in the worker, which the
//     supervisor catches and re-forks automatically.

const { fork } = require('child_process');
const { createServer } = require('http');
const next = require('next');
const path = require('path');

// ─── Supervisor ──────────────────────────────────────────────────────────────

if (!process.env.AGENT1_WORKER) {
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
        // Restart requested (from /api/restart)
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
