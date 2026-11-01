const path = require('path');
const fs = require('fs');
const { env, validateEnv } = require('./config/env');
validateEnv();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('./config/db');
const sanitize = require('./middleware/sanitize');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const routes = require('./routes');

const app = express();
if (env.trustProxy) app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet());


const corsOptions = {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

app.use(cors(corsOptions));

app.use(express.json({ limit: '1mb' }));
app.use(sanitize);

app.get('/api/health', (req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const state = states[mongoose.connection.readyState] || 'unknown';
  const ok = state === 'connected';
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded', uptimeSeconds: Math.round(process.uptime()), timestamp: new Date().toISOString(),
    environment: env.nodeEnv, database: { state, name: ok ? mongoose.connection.name : null },
  });
});

app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 1000, standardHeaders: true, legacyHeaders: false }));
app.use('/api', routes);
app.use('/api', notFound);

if (env.serveFrontend) {
  const dist = path.join(__dirname, '..', 'frontend', 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
  } else console.warn('[server] SERVE_FRONTEND=true but frontend/dist was not found. Run "npm run build" first.');
}
app.use(errorHandler);

let server;
async function start() {
  await connectDB();
  await Promise.all(Object.values(mongoose.models).map((m) => m.init().catch((e) => console.error(`[db] index build failed for ${m.modelName}: ${e.message}`))));
  server = app.listen(env.port, () => console.log(`[server] LeadHunter API listening on :${env.port} (${env.nodeEnv})`));
}

async function shutdown(signal) {
  console.log(`[server] ${signal} received, shutting down...`);
  if (server) await new Promise((r) => server.close(r));
  await disconnectDB().catch(() => {});
  process.exit(0);
}
['SIGINT', 'SIGTERM'].forEach((s) => process.on(s, () => shutdown(s)));
process.on('unhandledRejection', (e) => console.error('[server] unhandledRejection', e));

if (require.main === module) start().catch((e) => { console.error('[server] failed to start:', e.message); process.exit(1); });
module.exports = app;
