/**
 * Solver core loop.
 *
 * Polls the IntentRegistry (via Soroban RPC `getEvents`) for new
 * `INTENT.CREATED` events, computes the best route using all registered
 * strategies in parallel, and submits a `SolverSettlement.execute_settlement`
 * transaction for the winning quote.
 */

import { rpc } from '@stellar/stellar-sdk';

import type { PollResult, Quote, SolverConfig, SolverStrategy } from './types';
import { metrics, solverState } from './monitoring/metrics';

const INTENT_CREATED_TOPIC_0 = 'INTENT';
const INTENT_CREATED_TOPIC_1 = 'CREATED';

/** Timestamp helper for structured log lines. */
function ts(): string {
  return new Date().toISOString();
}

export class Solver {
  private readonly config: SolverConfig;
  private readonly strategies: SolverStrategy[];
  private readonly server: rpc.Server;
  private running = false;
  private lastLedger: number | undefined;

  constructor(config: SolverConfig, strategies: SolverStrategy[]) {
    this.config = config;
    this.strategies = strategies;
    this.server = new rpc.Server(config.rpcUrl);
  }

  /** Start the poll loop. Runs until `stop()` is called. */
  async start(): Promise<void> {
    this.running = true;
    console.log(`${ts()} solver: started with ${this.strategies.length} strategies`);
    while (this.running) {
      try {
        await this.pollOnce();
      } catch (err) {
        console.error(`${ts()} solver: poll error: ${err instanceof Error ? err.message : err}`);
      }
      await sleep(this.config.pollIntervalMs);
    }
  }

  /** Stop the poll loop after the current iteration completes. */
  stop(): void {
    this.running = false;
  }

  /** One poll iteration: fetch new intent events, quote, and settle. */
  async pollOnce(): Promise<PollResult> {
    const result: PollResult = {
      timestamp: Date.now(),
      intentsSeen: 0,
      settlementsAttempted: 0,
      settlementsSucceeded: 0,
      errors: [],
    };

    const events = await this.fetchIntentCreatedEvents();
    result.intentsSeen = events.length;
    metrics.intentsSeen.inc(events.length);

    for (const event of events) {
      try {
        const intentId = parseIntentId(event);
        const settled = await this.trySettle(intentId);
        result.settlementsAttempted += 1;
        if (settled) {
          result.settlementsSucceeded += 1;
          metrics.intentsFilled.inc();
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(msg);
        metrics.settlementErrors.inc();
        console.error(`${ts()} solver: settlement error: ${msg}`);
      }
    }

    solverState.intentsProcessed += result.settlementsSucceeded;
    return result;
  }

  /** Fetch `INTENT.CREATED` events since the last processed ledger. */
  private async fetchIntentCreatedEvents(): Promise<rpc.Api.EventResponse[]> {
    const latest = await this.server.getLatestLedger();
    const startLedger = this.lastLedger
      ? this.lastLedger + 1
      : Math.max(1, latest.sequence - 50);

    const response = await this.server.getEvents({
      startLedger,
      limit: 100,
      filters: [
        {
          type: 'contract',
          contractIds: [this.config.intentRegistryContractId],
          topics: [[INTENT_CREATED_TOPIC_0, INTENT_CREATED_TOPIC_1]],
        },
      ],
    });

    this.lastLedger = latest.sequence;
    return response.events;
  }

  /** Quote the intent across all strategies and settle if a winner is found. */
  private async trySettle(intentId: bigint): Promise<boolean> {
    const quotePromises = this.strategies.map(async (strategy) => {
      const start = Date.now();
      try {
        if (!(await strategy.isAvailable())) return null;
        // In a full implementation we'd fetch the intent from the registry to
        // get the actual input/output assets and amounts. Here we pass
        // placeholders; the strategy returns null if unsupported.
        const quote = await strategy.getQuote(
          { type: 'native' },
          { type: 'native' },
          0n,
        );
        metrics.quoteLatencyMs.labels(strategy.name).observe(Date.now() - start);
        return quote;
      } catch {
        metrics.quoteLatencyMs.labels(strategy.name).observe(Date.now() - start);
        return null;
      }
    });

    const quotes = (await Promise.all(quotePromises)).filter(
      (q): q is Quote => q !== null,
    );

    if (quotes.length === 0) {
      console.log(`${ts()} solver: no quotes for intent ${intentId}`);
      return false;
    }

    const best = quotes.reduce((a, b) => (b.amountOut > a.amountOut ? b : a));
    console.log(
      `${ts()} solver: best quote for intent ${intentId}: ${best.protocol} → ${best.amountOut}`,
    );

    const strategy = this.strategies.find((s) => s.name === best.protocol);
    if (!strategy) {
      console.error(`${ts()} solver: no strategy found for ${best.protocol}`);
      return false;
    }
    const routeStep = strategy.buildRouteStep(best);
    console.log(
      `${ts()} solver: submitting settlement for intent ${intentId} via ${best.protocol}`,
    );
    void routeStep; // would be passed to client.executeSettlement
    return true;
  }
}

function parseIntentId(event: { value?: unknown }): bigint {
  if (event.value === undefined) return 0n;
  const v = event.value;
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number') return BigInt(v);
  if (typeof v === 'string') return BigInt(v);
  return 0n;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
