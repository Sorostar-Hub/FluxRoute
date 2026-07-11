/**
 * FluxRoute SDK — Cross-protocol route example.
 *
 * Demonstrates a multi-hop intent where the user expresses a preference for
 * routing through Soroswap first, then Stellar path payments as a fallback.
 * The off-chain solver network selects the optimal route; this example shows
 * how to express that preference and submit the resulting settlement.
 *
 * Run with:
 *   ts-node packages/sdk/examples/cross-protocol-route.ts
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { FluxRouteClient, type Signer } from '../src';

const __dirname = dirname(fileURLToPath(import.meta.url));
const contractsPath = resolve(__dirname, '../../../public/testnet.contracts.json');

const contracts = JSON.parse(readFileSync(contractsPath, 'utf8')) as {
  contracts: { IntentRegistry: string; SolverSettlement: string };
};

if (!contracts.contracts.IntentRegistry) {
  console.error('Contract IDs not found. Run scripts/deploy-contracts.sh first.');
  process.exit(1);
}

const signer: Signer = async (txXdr, _networkPassphrase) => {
  throw new Error('Replace this signer with a Freighter or Keypair signer.');
};

async function main() {
  const client = new FluxRouteClient({
    intentRegistryContractId: contracts.contracts.IntentRegistry,
    solverSettlementContractId: contracts.contracts.SolverSettlement,
    network: 'testnet',
    signer,
  });

  // Create an intent that prefers Soroswap but accepts any route meeting the
  // slippage floor. The solver network evaluates Soroswap, Blend, DeFindex,
  // and native path payments off-chain and submits the best one.
  const intentId = await client.createIntent({
    sender: 'GDVXC7TGO3W5IDZTUYYJBITZJNBKL54P6RUOVMS5VJ2H3K5DZ462FDU4',
    recipient: 'GDCMUKBLXKTY6QZFFDIAGV4IS7FOM2GU7GJL45K2AITRU7LXGLVT44TT',
    inputAsset: { type: 'native' },
    outputAsset: { type: 'credit4', code: 'USDC', issuer: 'GAB5L....' },
    inputAmount: 200_0000000n, // 200 XLM
    minOutputAmount: 180_0000000n, // 180 USDC floor (10% slippage tolerance)
    deadline: BigInt(1_000_000),
    solverFeeBps: 5,
  });
  console.log('Cross-protocol intent created:', intentId.toString());

  // In a real flow, the solver node (packages/solver) would:
  //   1. detect the IntentCreated event via RPC getEvents
  //   2. query Soroswap + path-payment strategies in parallel
  //   3. submit execute_settlement with the winning route
  // Here we just poll for the fill.
  for (let i = 0; i < 100; i++) {
    const intent = await client.getIntent(intentId);
    console.log(`  status: ${intent.status}, filledBy: ${intent.filledBy ?? '-'}`);
    if (['Filled', 'Cancelled', 'Expired'].includes(intent.status)) break;
    await new Promise((r) => setTimeout(r, 3000));
  }
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
