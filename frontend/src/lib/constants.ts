/**
 * Frontend constants: contract IDs and network endpoints loaded from the
 * committed `public/testnet.contracts.json` (populated by deploy-contracts.sh)
 * and Vercel environment variables.
 */

export const INTENT_REGISTRY_CONTRACT_ID =
  process.env.NEXT_PUBLIC_INTENT_REGISTRY_CONTRACT_ID ?? '';
export const SOLVER_SETTLEMENT_CONTRACT_ID =
  process.env.NEXT_PUBLIC_SOLVER_SETTLEMENT_CONTRACT_ID ?? '';
export const STELLAR_NETWORK =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet';
export const INDEXER_URL =
  process.env.NEXT_PUBLIC_INDEXER_URL ?? 'http://localhost:4000';

/** Native XLM asset representation for the SDK. */
export const NATIVE_ASSET = { type: 'native' } as const;
