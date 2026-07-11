/**
 * Intent-related types shared across the SDK, solver, indexer, and frontend.
 *
 * These mirror the `#[contracttype]` structs in `contracts/lib/src/types.rs`
 * so that values decoded from on-chain storage map cleanly to TypeScript.
 */

/** A Stellar asset: native XLM or an alphanumeric credit asset. */
export type Asset =
  | { type: 'native' }
  | { type: 'credit4'; code: string; issuer: string }
  | { type: 'credit12'; code: string; issuer: string };

/** Lifecycle of an intent. Mirrors the `IntentStatus` Rust enum. */
export type IntentStatus = 'Open' | 'Pending' | 'Filled' | 'Cancelled' | 'Expired';

/** The terminal statuses at which polling should stop. */
export const TERMINAL_STATUS: ReadonlySet<IntentStatus> = new Set([
  'Filled',
  'Cancelled',
  'Expired',
]);

/** An immutable record of a user's desired outcome. */
export interface Intent {
  id: bigint;
  sender: string;
  recipient: string;
  inputAsset: Asset;
  outputAsset: Asset;
  /** Amount of input asset, in stroops (smallest unit). */
  inputAmount: bigint;
  /** Slippage floor: the minimum gross output the recipient will accept. */
  minOutputAmount: bigint;
  /** Absolute deadline as a ledger sequence. */
  deadline: bigint;
  status: IntentStatus;
  /** Solver that filled the intent, if any. */
  filledBy: string | null;
  /** Protocol fee charged on the gross output, in basis points (1 bps = 0.01%). */
  solverFeeBps: number;
}

/** A single hop in an execution route, built by a solver strategy. */
export interface RouteStep {
  protocol: string;
  pool: string | null;
  inputAsset: Asset;
  outputAsset: Asset;
  amountIn: bigint;
  amountOut: bigint;
}

/** Outcome of a settlement, returned by `execute_settlement`. */
export interface SettlementResult {
  intentId: bigint;
  grossOutput: bigint;
  solverFee: bigint;
  netOutput: bigint;
  solver: string;
}

/** Parameters accepted by `FluxRouteClient.createIntent`. */
export interface CreateIntentParams {
  sender: string;
  recipient: string;
  inputAsset: Asset;
  outputAsset: Asset;
  inputAmount: bigint;
  minOutputAmount: bigint;
  /** Absolute ledger-sequence deadline. */
  deadline: bigint;
  /** Protocol fee in basis points. Defaults to 5 (0.05%). */
  solverFeeBps?: number;
}
