/**
 * index.ts — News Pulse Backend API server entry point.
 *
 * Endpoints:
 *   GET  /clusters
 *   GET  /clusters/:id
 *   GET  /timeline
 *   POST /ingest/trigger
 *   GET  /ingest/status/:jobId
 *   GET  /health
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import clustersRouter from './routes/clusters';
import timelineRouter from './routes/timeline';
import ingestRouter from './routes/ingest';

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow same-origin / no-origin requests (e.g., server-to-server, curl)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());

// ── Rate limiting on expensive endpoints ──────────────────────────────────────
const ingestLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX || '5', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many ingest requests — please wait before triggering again.' },
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/clusters', clustersRouter);
app.use('/timeline', timelineRouter);
app.use('/ingest', ingestLimiter, ingestRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 fallback
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[global error]', err.message);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

app.listen(PORT, () => {
  console.log(`[News Pulse API] Listening on port ${PORT}`);
  console.log(`[News Pulse API] DATABASE_URL: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@') ?? '(not set)'}`);
});

export default app;
