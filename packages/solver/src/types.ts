/**
 * Shared types for the solver node.
 *
 * Defines the `SolverStrategy` interface that every protocol integration must
 * implement, plus the `Quote`, `SolverConfig`, and `PollResult` types used
 * across the solver core loop and monitoring.
 */

import type { Asset, RouteStep } from '@fluxroute/sdk';

/** Protocols the solver network can route through. */
export type Protocol = 'soroswap' | 'blend' | 'defindex' | 'path-payment';

/** Re-export RouteStep so strategies can import it from the solver types. */
export type { RouteStep };

/** A quote produced by a solver strategy for a single protocol. */
export interface Quote {
  protocol: Protocol;
  inputAsset: Asset;
  outputAsset: Asset;
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

/**
 * Interface every protocol integration must implement.
 *
 * Strategies are polled in parallel by the solver core loop; the strategy
 * returning the highest `netOutput` (after fees) wins the right to settle.
 */
export interface SolverStrategy {
  /** Human-readable protocol name. */
  name: Protocol;
  /** Whether the upstream API is currently reachable and responding. */
  isAvailable(): Promise<boolean>;
  /** Get a quote for swapping `amount` of `input` into `output`. Null if no route. */
  getQuote(input: Asset, output: Asset, amount: bigint): Promise<Quote | null>;
  /** Convert a quote into a `RouteStep` for the settlement contract. */
  buildRouteStep(quote: Quote): RouteStep;
}

/** Runtime configuration for the solver daemon. */
export interface SolverConfig {
  /** The solver's Stellar secret key (S...). */
  secretKey: string;
  /** Soroban RPC endpoint. */
  rpcUrl: string;
  /** Stellar network passphrase. */
  networkPassphrase: string;
  /** IntentRegistry contract address. */
  intentRegistryContractId: string;
  /** SolverSettlement contract address. */
  solverSettlementContractId: string;
  /** Input token addresses for settlement (SAC addresses). */
  inputToken: string;
  outputToken: string;
  /** Polling interval for new intents, in milliseconds. */
  pollIntervalMs: number;
  /** Maximum ledger deadline extension when submitting intents. */
  maxDeadlineLedgers: number;
  /** Whether to enable the Prometheus metrics + health HTTP server. */
  enableMetrics: boolean;
  /** Port for the metrics/health HTTP server. */
  metricsPort: number;
  /** Protocol API endpoints. */
  soroswapApiUrl: string;
  horizonUrl: string;
  blendContractId: string;
  defindexContractId: string;
}

/** Result of one poll iteration of the solver core loop. */
export interface PollResult {
  /** Timestamp of the poll (ms since epoch). */
  timestamp: number;
  /** Number of open intents discovered. */
  intentsSeen: number;
  /** Number of settlements attempted. */
  settlementsAttempted: number;
  /** Number of settlements that succeeded. */
  settlementsSucceeded: number;
  /** Errors encountered during this poll. */
  errors: string[];
}
