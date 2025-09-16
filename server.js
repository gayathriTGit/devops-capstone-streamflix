// server.js (ESM)
import express from 'express';
import path from 'path';
import prom from 'prom-client';
import responseTime from 'response-time';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app = express();
const register = new prom.Registry();

prom.collectDefaultMetrics({ register, prefix: 'streamflix_' });

const httpDuration = new prom.Histogram({
  name: 'streamflix_http_request_duration_seconds',
  help: 'HTTP request duration (seconds)',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005,0.01,0.025,0.05,0.1,0.25,0.5,1,2,5]
});
register.registerMetric(httpDuration);

app.use(responseTime((req, res, time) => {
  const route = req.route?.path || req.path || 'static';
  httpDuration.labels(req.method, route, String(res.statusCode)).observe(time/1000);
}));

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.get('/healthz', (_req, res) => res.send('ok'));

// serve SPA (only if built)
const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));

  // final handler for any GET that wasn’t matched
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`streamflix on :${PORT} (metrics at /metrics)`));
