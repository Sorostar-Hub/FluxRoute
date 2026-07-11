/**
 * GraphQL resolvers backed by PostgreSQL.
 *
 * Implements the queries defined in schema.graphql using the `pg` Pool.
 */

import { Pool } from 'pg';

interface IntentRow {
  id: string;
  sender: string;
  recipient: string;
  input_asset: unknown;
  output_asset: unknown;
  input_amount: string;
  min_output_amount: string;
  deadline: string;
  status: string;
  filled_by: string | null;
  solver_fee_bps: number;
  created_at_ledger: number | null;
  filled_tx_hash: string | null;
}

interface SolverRow {
  address: string;
  intents_filled_total: number;
  success_rate: number;
  is_online: boolean;
}

export interface ResolverContext {
  pool: Pool;
}

function rowToIntent(row: IntentRow) {
  return {
    id: row.id,
    sender: row.sender,
    recipient: row.recipient,
    inputAsset: row.input_asset,
    outputAsset: row.output_asset,
    inputAmount: row.input_amount,
    minOutputAmount: row.min_output_amount,
    deadline: row.deadline,
    status: row.status,
    filledBy: row.filled_by,
    solverFeeBps: row.solver_fee_bps,
    createdAtLedger: row.created_at_ledger,
    filledTxHash: row.filled_tx_hash,
  };
}

export const resolvers = {
  IntentStatus: {
    Open: 'Open',
    Pending: 'Pending',
    Filled: 'Filled',
    Cancelled: 'Cancelled',
    Expired: 'Expired',
  },
  Query: {
    async intent(_parent: unknown, args: { id: string }, ctx: ResolverContext) {
      const res = await ctx.pool.query<IntentRow>(
        'SELECT * FROM intents WHERE id = $1',
        [args.id],
      );
      return res.rows[0] ? rowToIntent(res.rows[0]) : null;
    },

    async recentIntents(
      _parent: unknown,
      args: { limit?: number },
      ctx: ResolverContext,
    ) {
      const limit = Math.min(args.limit ?? 20, 100);
      const res = await ctx.pool.query<IntentRow>(
        'SELECT * FROM intents ORDER BY created_at_ledger DESC LIMIT $1',
        [limit],
      );
      return res.rows.map(rowToIntent);
    },

    async solverStats(_parent: unknown, _args: unknown, ctx: ResolverContext) {
      const res = await ctx.pool.query<SolverRow>(
        'SELECT * FROM solvers ORDER BY intents_filled_total DESC',
      );
      return res.rows;
    },
  },
  // Subscriptions are handled via a websocket layer in production; the
  // resolver signatures are defined here for schema completeness.
  Subscription: {
    onIntentCreated: {
      subscribe: () => {
        throw new Error('Subscriptions require a pubsub transport (not configured).');
      },
    },
    onIntentFilled: {
      subscribe: () => {
        throw new Error('Subscriptions require a pubsub transport (not configured).');
      },
    },
  },
};
