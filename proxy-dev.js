const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
const PORT = 3001;

// Enable CORS for all origins during development
app.use(cors());

// Proxy all /api requests to production server
app.use('/api', createProxyMiddleware({
  target: 'https://app.editaliza.com.br',
  changeOrigin: true,
  secure: true,
  logLevel: 'debug',
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[PROXY] ${req.method} ${req.url} -> https://app.editaliza.com.br${req.url}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`[PROXY] Response ${proxyRes.statusCode} for ${req.url}`);
  },
  onError: (err, req, res) => {
    console.error(`[PROXY ERROR]`, err);
    res.status(500).send('Proxy Error');
  }
}));

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║   Proxy Dev Server Rodando!                ║
║                                             ║
║   Proxy: http://localhost:${PORT}            ║
║   Target: https://app.editaliza.com.br     ║
║                                             ║
║   Use http://localhost:${PORT}/api/*         ║
║   para acessar a API de produção           ║
╚════════════════════════════════════════════╝
  `);
});