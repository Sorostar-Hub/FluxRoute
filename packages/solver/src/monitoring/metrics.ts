/**
 * Prometheus metrics for the solver node.
 *
 * Exposes counters and histograms for intent processing, settlements, and
 * per-protocol quote latency. Consumed by the health server and scrapeable
 * at `GET :8080/metrics`.
 */

import client from 'prom-client';

// Use a single registry so the metrics endpoint emits only our metrics.
const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

export const metrics = {
  intentsSeen: new client.Counter({
    name: 'fluxroute_intents_seen_total',
    help: 'Total number of intents discovered by the solver.',
    registers: [registry],
  }),
  intentsFilled: new client.Counter({
    name: 'fluxroute_intents_filled_total',
    help: 'Total number of intents successfully filled by this solver.',
    registers: [registry],
  }),
  settlementErrors: new client.Counter({
    name: 'fluxroute_settlement_errors_total',
    help: 'Total number of settlement errors encountered.',
    registers: [registry],
  }),
  quoteLatencyMs: new client.Histogram({
    name: 'fluxroute_quote_latency_ms',
    help: 'Latency of protocol quote requests in milliseconds.',
    labelNames: ['protocol'],
    buckets: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    registers: [registry],
  }),
};

/** Internal state tracked for the health endpoint. */
export const solverState = {
  intentsProcessed: 0,
  startedAt: Date.now(),
};

/** Render all metrics in the Prometheus exposition format. */
export async function renderMetrics(): Promise<string> {
  return registry.metrics();
}
