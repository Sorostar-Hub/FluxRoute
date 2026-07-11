/**
 * Indexer configuration loaded from environment variables.
 */

import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  STELLAR_RPC_URL: z.string().url().default('https://soroban-testnet.stellar.org'),
  INTENT_REGISTRY_CONTRACT_ID: z.string().min(1),
  SOLVER_SETTLEMENT_CONTRACT_ID: z.string().min(1),
  POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  GRAPHQL_PORT: z.coerce.number().int().positive().default(4000),
});

export interface IndexerConfig {
  databaseUrl: string;
  rpcUrl: string;
  intentRegistryContractId: string;
  solverSettlementContractId: string;
  pollIntervalMs: number;
  graphqlPort: number;
}

export function loadConfig(): IndexerConfig {
  const parsed = envSchema.parse(process.env);
  return {
    databaseUrl: parsed.DATABASE_URL,
    rpcUrl: parsed.STELLAR_RPC_URL,
    intentRegistryContractId: parsed.INTENT_REGISTRY_CONTRACT_ID,
    solverSettlementContractId: parsed.SOLVER_SETTLEMENT_CONTRACT_ID,
    pollIntervalMs: parsed.POLL_INTERVAL_MS,
    graphqlPort: parsed.GRAPHQL_PORT,
  };
}
