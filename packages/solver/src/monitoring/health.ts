/**
 * Health and metrics HTTP server.
 *
 * Exposes two endpoints:
 *   GET /health   — lightweight liveness probe returning solver state
 *   GET /metrics  — Prometheus exposition format for scraping
 */

import express, { type Express } from 'express';

import { metrics, renderMetrics, solverState } from './metrics';

/** Create and configure the Express app without binding a port. */
export function createHealthApp(): Express {
  const app = express();

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      uptime: Math.floor((Date.now() - solverState.startedAt) / 1000),
      intentsProcessed: solverState.intentsProcessed,
    });
  });

  app.get('/metrics', async (_req, res) => {
    res.type('text/plain');
    res.send(await renderMetrics());
  });

  return app;
}

/**
 * Start the health + metrics server on the given port. Returns the underlying
 * http.Server so the caller can shut it down gracefully.
 */
export function startHealthServer(port: number): ReturnType<Express['listen']> {
  const app = createHealthApp();
  const server = app.listen(port, () => {
    console.log(`solver monitoring: health + metrics on :${port}`);
  });
  // Record process start for uptime calculation.
  metrics.intentsSeen; // touch to ensure metrics are registered
  return server;
}
