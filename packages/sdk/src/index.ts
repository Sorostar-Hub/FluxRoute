/**
 * @fluxroute/sdk — TypeScript SDK for FluxRoute.
 *
 * Cross-protocol intent aggregation on Stellar. Users submit intents and a
 * decentralized solver network competes to find and execute the optimal route.
 *
 * @packageDocumentation
 */

export { FluxRouteClient, NETWORKS } from './client';
export type {
  FluxRouteClientOptions,
  FluxRouteNetwork,
  Signer,
} from './client';
export * from './types';
export * from './utils';
export { useIntent } from './hooks/useIntent';
export type { UseIntentResult } from './hooks/useIntent';
export { useSolver } from './hooks/useSolver';
export type { UseSolverResult } from './hooks/useSolver';
