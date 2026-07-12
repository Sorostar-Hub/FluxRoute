/**
 * Stellar-specific helpers for the frontend: wallet access, client
 * construction, and asset display utilities.
 */

import { FluxRouteClient, type Signer, NETWORKS } from '@fluxroute/sdk';

import {
  INTENT_REGISTRY_CONTRACT_ID,
  SOLVER_SETTLEMENT_CONTRACT_ID,
  STELLAR_NETWORK,
} from './constants';

import * as freighter from '@stellar/freighter-api';

const { signTransaction, isConnected } = freighter;

/** Build a `Signer` backed by the Freighter extension. */
export async function getFreighterSigner(): Promise<Signer | null> {
  if (typeof window === 'undefined') return null;

  // Check if Freighter is available
  const connected = await isConnected().catch(() => false);
  if (!connected) return null;

  return async (txXdr, networkPassphrase) => {
    const result = await signTransaction(txXdr, { networkPassphrase });

    // Handle v6.0.1 API response format
    if (result.error) {
      throw new Error(`Transaction signing failed: ${result.error}`);
    }

    // Return just the signed XDR as expected by the SDK Signer type
    return result.signedTxXdr;
  };
}

/** Construct a FluxRoute client using the committed contract IDs. */
export async function createClient(): Promise<FluxRouteClient> {
  const signer = await getFreighterSigner();
  return new FluxRouteClient({
    intentRegistryContractId: INTENT_REGISTRY_CONTRACT_ID,
    solverSettlementContractId: SOLVER_SETTLEMENT_CONTRACT_ID,
    network: STELLAR_NETWORK as keyof typeof NETWORKS,
    signer: signer ?? undefined,
  });
}

/** Shorten a Stellar address for display: G...WHF. */
export function shortAddress(addr: string | null): string {
  if (!addr) return '—';
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

/** Format a stroops amount for display with 7-decimal precision. */
export function formatAmount(stroops: bigint, decimals = 7): string {
  const str = stroops.toString();
  const padded = str.padStart(decimals + 1, '0');
  const whole = padded.slice(0, padded.length - decimals);
  const fraction = padded.slice(padded.length - decimals).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}
