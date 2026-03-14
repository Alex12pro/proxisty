import express from 'express';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { hostname } from 'node:os';
import { publicPath } from 'ultraviolet-static';
import { uvPath } from '@titaniumnetwork-dev/ultraviolet';
import { epoxyPath } from '@mercuryworkshop/epoxy-transport';
import { baremuxPath } from '@mercuryworkshop/bare-mux/node';
import wisp from 'wisp-server-node';

const app = express();

app.use(express.static(join(process.cwd(), 'public')));
app.use(express.static(publicPath));
app.use('/uv/', express.static(uvPath));
app.use('/epoxy/', express.static(epoxyPath));
app.use('/baremux/', express.static(baremuxPath));

app.use((req, res) => {
  res.status(404).sendFile(join(process.cwd(), 'public', '404.html'));
});

const server = createServer();
server.on('request', (req, res) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  app(req, res);
});

server.on('upgrade', (req, socket, head) => {
  if (req.url?.endsWith('/wisp/')) {
    wisp.routeRequest(req, socket, head);
  } else {
    socket.end();
  }
});

let port = Number.parseInt(process.env.PORT || '', 10);
if (Number.isNaN(port)) port = 8080;

server.listen({ port, host: '0.0.0.0' }, () => {
  const address = server.address();
  console.log('Listening on:');
  console.log(`  http://localhost:${address.port}`);
  console.log(`  http://${hostname()}:${address.port}`);
});

function shutdown() {
  console.log('Shutting down server');
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
