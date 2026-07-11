/**
 * Solver configuration loaded from environment variables.
 */

import { Networks } from '@stellar/stellar-sdk';
import { z } from 'zod';

import type { SolverConfig } from './types';

const envSchema = z.object({
  SOLVER_SECRET_KEY: z.string().regex(/^S[A-Z0-9]{55}$/, 'must be a valid S... secret key'),
  STELLAR_RPC_URL: z.string().url().default('https://soroban-testnet.stellar.org'),
  STELLAR_NETWORK: z.enum(['testnet', 'futurenet']).default('testnet'),
  INTENT_REGISTRY_CONTRACT_ID: z.string().min(1),
  SOLVER_SETTLEMENT_CONTRACT_ID: z.string().min(1),
  INPUT_TOKEN: z.string().min(1),
  OUTPUT_TOKEN: z.string().min(1),
  POLL_INTERVAL_MS: z.coerce.number().int().positive().default(2000),
  MAX_DEADLINE_LEDGERS: z.coerce.number().int().positive().default(1_000_000),
  ENABLE_METRICS: z.coerce.boolean().default(true),
  METRICS_PORT: z.coerce.number().int().positive().default(8080),
  SOROSWAP_API_URL: z.string().url().default('https://api.soroswap.finance'),
  HORIZON_URL: z.string().url().default('https://horizon-testnet.stellar.org'),
  BLEND_CONTRACT_ID: z.string().default(''),
  DEFINDEX_CONTRACT_ID: z.string().default(''),
});

const networkPassphrase: Record<string, string> = {
  testnet: Networks.TESTNET,
  futurenet: Networks.FUTURENET,
};

/**
 * Load and validate solver configuration from the environment.
 * Throws a descriptive error if required variables are missing or invalid.
 */
export function loadConfig(): SolverConfig {
  const parsed = envSchema.parse(process.env);
  return {
    secretKey: parsed.SOLVER_SECRET_KEY,
    rpcUrl: parsed.STELLAR_RPC_URL,
    networkPassphrase: networkPassphrase[parsed.STELLAR_NETWORK] ?? Networks.TESTNET,
    intentRegistryContractId: parsed.INTENT_REGISTRY_CONTRACT_ID,
    solverSettlementContractId: parsed.SOLVER_SETTLEMENT_CONTRACT_ID,
    inputToken: parsed.INPUT_TOKEN,
    outputToken: parsed.OUTPUT_TOKEN,
    pollIntervalMs: parsed.POLL_INTERVAL_MS,
    maxDeadlineLedgers: parsed.MAX_DEADLINE_LEDGERS,
    enableMetrics: parsed.ENABLE_METRICS,
    metricsPort: parsed.METRICS_PORT,
    soroswapApiUrl: parsed.SOROSWAP_API_URL,
    horizonUrl: parsed.HORIZON_URL,
    blendContractId: parsed.BLEND_CONTRACT_ID,
    defindexContractId: parsed.DEFINDEX_CONTRACT_ID,
  };
}
