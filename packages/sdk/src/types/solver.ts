/**
 * Solver-related types shared across the SDK, solver node, and frontend.
 */

/** Protocols the solver network can route through. */
export type Protocol = 'soroswap' | 'blend' | 'defindex' | 'path-payment';

/** A quote produced by a solver strategy for a single protocol. */
export interface Quote {
  protocol: Protocol;
  inputAsset: import('./intent').Asset;
  outputAsset: import('./intent').Asset;
  amountIn: bigint;
  /** Gross output the recipient would receive before fees. */
  amountOut: bigint;
  /** Estimated number of ledger sequences until the route would settle. */
  estimatedSettlementLedgers: number;
  /** Protocol-specific hop data used to reconstruct the route. */
  hops: RouteHop[];
}

/** A single hop within a solver quote. */
export interface RouteHop {
  protocol: Protocol;
  pool: string | null;
  amountIn: bigint;
  amountOut: bigint;
}

/** A live solver bid published by the indexer / solver API. */
export interface SolverQuote {
  solverAddress: string;
  intentId: bigint;
  quote: Quote;
  /** Net output the recipient receives after the solver fee. */
  netOutput: bigint;
  /** Timestamp (ms since epoch) the bid was published. */
  timestamp: number;
}

/** Aggregated statistics for a solver node. */
export interface SolverStats {
  address: string;
  intentsFilledTotal: number;
  successRate: number;
  isOnline: boolean;
}
