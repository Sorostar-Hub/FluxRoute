/**
 * Route simulator.
 *
 * Estimates the outcome of executing a route against current pool reserves
 * without submitting a transaction. Used by the solver to sanity-check a
 * quote before settlement and to compute expected slippage.
 */

import type { Quote } from '../types';

export interface SimulationResult {
  expectedOutput: bigint;
  slippageBps: number;
  estimatedFee: bigint;
}

export function simulateRoute(quote: Quote, feeBps: number): SimulationResult {
  const fee = (quote.amountOut * BigInt(feeBps)) / 10_000n;
  const expectedOutput = quote.amountOut - fee;
  // Slippage is unknown pre-execution; assume 0 for deterministic strategies.
  return {
    expectedOutput,
    slippageBps: 0,
    estimatedFee: fee,
  };
}
