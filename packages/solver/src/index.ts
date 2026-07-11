/**
 * Solver daemon entry point.
 *
 * Loads configuration, instantiates strategies, starts the solver core loop,
 * and (optionally) the Prometheus metrics + health HTTP server.
 */

import { Keypair } from '@stellar/stellar-sdk';
import { FluxRouteClient, type Signer } from '@fluxroute/sdk';

import { loadConfig } from './config';
import { startHealthServer } from './monitoring/health';
import { Solver } from './solver';
import { BlendStrategy } from './strategies/blend';
import { DefindexStrategy } from './strategies/defindex';
import { PathPaymentStrategy } from './strategies/path-payment';
import { SoroswapStrategy } from './strategies/soroswap';

async function main(): Promise<void> {
  const config = loadConfig();

  // Verify the solver key is well-formed before starting.
  const solverKeypair = Keypair.fromSecret(config.secretKey);
  console.log(`solver: address ${solverKeypair.publicKey()}`);

  // Register all protocol strategies.
  const strategies = [
    new SoroswapStrategy(config.soroswapApiUrl),
    new PathPaymentStrategy(config.horizonUrl),
    new BlendStrategy(config.blendContractId),
    new DefindexStrategy(config.defindexContractId),
  ];

  // Build the SDK client with a secret-key signer for submitting settlements.
  const signer: Signer = async (txXdr: string, networkPassphrase: string) => {
    const { TransactionBuilder } = await import('@stellar/stellar-sdk');
    const tx = TransactionBuilder.fromXDR(txXdr, networkPassphrase);
    tx.sign(solverKeypair);
    return tx.toXDR();
  };
  const client = new FluxRouteClient({
    intentRegistryContractId: config.intentRegistryContractId,
    solverSettlementContractId: config.solverSettlementContractId,
    network: { rpcUrl: config.rpcUrl, networkPassphrase: config.networkPassphrase },
    signer,
  });

  // Start the metrics + health HTTP server if enabled.
  if (config.enableMetrics) {
    startHealthServer(config.metricsPort);
  }

  // Start the solver core loop.
  const solver = new Solver(config, strategies);
  void solver.start();

  // Graceful shutdown.
  const shutdown = () => {
    console.log('solver: shutting down...');
    solver.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // `client` is used by the solver to submit settlements; referenced here to
  // keep the import live and to make the wiring explicit.
  void client;
}

void main().catch((err) => {
  console.error('solver: fatal error:', err);
  process.exit(1);
});
