/**
 * FluxRoute SDK — Basic swap example.
 *
 * Demonstrates the end-to-end flow: create a client → submit an intent → poll
 * until it is filled. Uses the testnet contract IDs from
 * `public/testnet.contracts.json`.
 *
 * Run with:
 *   ts-node packages/sdk/examples/basic-swap.ts
 *
 * Prerequisites:
 *   - The contracts are deployed to testnet (run scripts/deploy-contracts.sh)
 *   - The signing wallet is Freighter (connected to testnet in the browser) or
 *     a secret key signer for CLI use.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { FluxRouteClient, type Signer } from '../src';

const __dirname = dirname(fileURLToPath(import.meta.url));
const contractsPath = resolve(__dirname, '../../../public/testnet.contracts.json');

// Load the deployed contract IDs (populated by scripts/deploy-contracts.sh).
const contracts = JSON.parse(readFileSync(contractsPath, 'utf8')) as {
  contracts: { IntentRegistry: string; SolverSettlement: string };
};

if (!contracts.contracts.IntentRegistry) {
  console.error('Contract IDs not found. Run scripts/deploy-contracts.sh first.');
  process.exit(1);
}

// A placeholder signer that wraps Freighter in a browser context. In Node,
// swap this for a Keypair-based signer using the secret key.
const signer: Signer = async (txXdr, _networkPassphrase) => {
  // In a real app, call window.freighter.signTransaction(txXdr, { networkPassphrase })
  throw new Error(
    'Replace this signer with a Freighter or Keypair signer before running.',
  );
};

async function main() {
  const client = new FluxRouteClient({
    intentRegistryContractId: contracts.contracts.IntentRegistry,
    solverSettlementContractId: contracts.contracts.SolverSettlement,
    network: 'testnet',
    signer,
  });

  const total = await client.totalIntents();
  console.log('Total intents on registry:', total.toString());

  // Submit a swap intent: 50 native XLM → at least 45 USDC.
  const intentId = await client.createIntent({
    sender: 'GDVXC7TGO3W5IDZTUYYJBITZJNBKL54P6RUOVMS5VJ2H3K5DZ462FDU4',
    recipient: 'GDVXC7TGO3W5IDZTUYYJBITZJNBKL54P6RUOVMS5VJ2H3K5DZ462FDU4',
    inputAsset: { type: 'native' },
    outputAsset: { type: 'credit4', code: 'USDC', issuer: 'GAB5L....' },
    inputAmount: 500_000000n, // 50 XLM (7 decimals)
    minOutputAmount: 45_0000000n, // 45 USDC slippage floor
    deadline: BigInt(1_000_000), // ledger sequence ~1M ledgers from now
    solverFeeBps: 5, // 0.05%
  });
  console.log('Intent created with id:', intentId.toString());

  // Poll until the intent reaches a terminal status.
  for (let i = 0; i < 100; i++) {
    const intent = await client.getIntent(intentId);
    console.log(`  status: ${intent.status}`);
    if (intent.status === 'Filled') {
      console.log('  filled by:', intent.filledBy);
      break;
    }
    if (intent.status === 'Cancelled' || intent.status === 'Expired') {
      console.log('  intent did not fill');
      break;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
