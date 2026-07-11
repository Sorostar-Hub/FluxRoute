/**
 * Ledger event processor.
 *
 * Polls the Soroban RPC `getEvents` endpoint every 5 seconds for events
 * emitted by both contracts, persists them to PostgreSQL, and tracks
 * processed ledgers so re-processing is idempotent.
 */

import { Pool } from 'pg';
import { rpc } from '@stellar/stellar-sdk';

import type { IndexerConfig } from './config';

/** Event topics we care about, abbreviated to match on-chain emissions. */
const TOPICS = {
  intentCreated: ['INTENT', 'CREATED'],
  intentFilled: ['INTENT', 'FILLED'],
  intentCancelled: ['INTENT', 'CANCELD'],
  intentExpired: ['INTENT', 'EXPIRD'],
  settleDone: ['SETTLE', 'DONE'],
};

interface ProcessedEvent {
  contractId: string;
  type: 'intent_created' | 'intent_filled' | 'intent_cancelled' | 'intent_expired' | 'settle_done';
  ledger: number;
  txHash: string;
  value: string;
}

export class EventProcessor {
  private readonly config: IndexerConfig;
  private readonly pool: Pool;
  private readonly server: rpc.Server;
  private running = false;
  private lastLedger: number | undefined;

  constructor(config: IndexerConfig, pool: Pool) {
    this.config = config;
    this.pool = pool;
    this.server = new rpc.Server(config.rpcUrl);
  }

  async start(): Promise<void> {
    this.running = true;
    console.log(`indexer: processor started (poll every ${this.config.pollIntervalMs}ms)`);
    while (this.running) {
      try {
        await this.pollOnce();
      } catch (err) {
        console.error(`indexer: poll error: ${err instanceof Error ? err.message : err}`);
        await this.backoff();
      }
      await sleep(this.config.pollIntervalMs);
    }
  }

  stop(): void {
    this.running = false;
  }

  async pollOnce(): Promise<void> {
    const latest = await this.server.getLatestLedger();
    const startLedger = this.lastLedger
      ? this.lastLedger + 1
      : Math.max(1, latest.sequence - 100);

    const [registryEvents, settlementEvents] = await Promise.all([
      this.fetchEvents(this.config.intentRegistryContractId, startLedger, latest.sequence),
      this.fetchEvents(this.config.solverSettlementContractId, startLedger, latest.sequence),
    ]);

    const events = [...registryEvents, ...settlementEvents];
    if (events.length === 0) {
      this.lastLedger = latest.sequence;
      return;
    }

    for (const event of events) {
      await this.persistEvent(event);
    }
    this.lastLedger = latest.sequence;
  }

  private async fetchEvents(
    contractId: string,
    startLedger: number,
    _endLedger: number,
  ): Promise<ProcessedEvent[]> {
    let attempt = 0;
    const maxAttempts = 5;
    while (attempt < maxAttempts) {
      try {
        const response = await this.server.getEvents({
          startLedger,
          limit: 200,
          filters: [
            {
              type: 'contract',
              contractIds: [contractId],
              topics: [
                TOPICS.intentCreated,
                TOPICS.intentFilled,
                TOPICS.intentCancelled,
                TOPICS.intentExpired,
                TOPICS.settleDone,
              ],
            },
          ],
        });
        return response.events.map((e) => this.normalizeEvent(contractId, e));
      } catch (err) {
        attempt++;
        if (attempt >= maxAttempts) {
          console.error(`indexer: getEvents failed after ${maxAttempts} attempts: ${err}`);
          return [];
        }
        await this.backoff(attempt);
      }
    }
    return [];
  }

  private normalizeEvent(contractId: string, event: rpc.Api.EventResponse): ProcessedEvent {
    const topic0 = event.topic[0]?.toString();
    const topic1 = event.topic[1]?.toString();
    let type: ProcessedEvent['type'];
    if (topic0 === 'INTENT' && topic1 === 'CREATED') type = 'intent_created';
    else if (topic0 === 'INTENT' && topic1 === 'FILLED') type = 'intent_filled';
    else if (topic0 === 'INTENT' && topic1 === 'CANCELD') type = 'intent_cancelled';
    else if (topic0 === 'INTENT' && topic1 === 'EXPIRD') type = 'intent_expired';
    else type = 'settle_done';

    return {
      contractId,
      type,
      ledger: event.ledger,
      txHash: event.txHash,
      value: String(event.value ?? ''),
    };
  }

  /** Persist an event idempotently — skips if the ledger was already processed. */
  private async persistEvent(event: ProcessedEvent): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Idempotency guard: insert into processed_ledgers, skip on conflict.
      const guard = await client.query(
        `INSERT INTO processed_ledgers (ledger, contract_id)
         VALUES ($1, $2)
         ON CONFLICT (ledger, contract_id) DO NOTHING
         RETURNING ledger`,
        [event.ledger, event.contractId],
      );
      if (guard.rowCount === 0) {
        await client.query('ROLLBACK');
        return; // already processed
      }

      const intentId = BigInt(event.value);
      switch (event.type) {
        case 'intent_created':
          await client.query(
            `INSERT INTO intents (id, sender, recipient, input_asset, output_asset,
                input_amount, min_output_amount, deadline, status, solver_fee_bps,
                created_at_ledger, created_tx_hash)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Open', 0, $9, $10)
             ON CONFLICT (id) DO NOTHING`,
            [
              intentId.toString(),
              'unknown', // full intent fetched separately in a production system
              'unknown',
              '{}',
              '{}',
              '0',
              '0',
              0,
              event.ledger,
              event.txHash,
            ],
          );
          break;
        case 'intent_filled':
          await client.query(
            `UPDATE intents SET status = 'Filled', filled_tx_hash = $2, updated_at = now()
             WHERE id = $1`,
            [intentId.toString(), event.txHash],
          );
          break;
        case 'intent_cancelled':
          await client.query(
            `UPDATE intents SET status = 'Cancelled', updated_at = now() WHERE id = $1`,
            [intentId.toString()],
          );
          break;
        case 'intent_expired':
          await client.query(
            `UPDATE intents SET status = 'Expired', updated_at = now() WHERE id = $1`,
            [intentId.toString()],
          );
          break;
        case 'settle_done':
          // Settlement details are decoded from the event value in production.
          break;
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  private async backoff(attempt = 1): Promise<void> {
    const delay = Math.min(30_000, 1000 * 2 ** attempt);
    await sleep(delay);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
