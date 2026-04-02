// Custom Next.js server with extended timeout for video generation
// Node.js default server.requestTimeout is 5 minutes (300,000ms)
// We extend it to 10 minutes for long-running fal.ai video generation

const { createServer } = require('http');
const next = require('next');

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
