/**
 * Stellar-specific helpers for the frontend: wallet access, client
 * construction, and asset display utilities.
 */

import {
  FluxRouteClient,
  type Signer,
  NETWORKS,
} from '@fluxroute/sdk';

import {
  INTENT_REGISTRY_CONTRACT_ID,
  SOLVER_SETTLEMENT_CONTRACT_ID,
  STELLAR_NETWORK,
} from './constants';

/**
 * Lazy-load Freighter's window API. Returns `null` if Freighter is not
 * installed or we're not in a browser context.
 */
async function getFreighter(): Promise<{
  signTransaction: (xdr: string, opts?: Record<string, unknown>) => Promise<string>;
} | null> {
  if (typeof window === 'undefined') return null;
  // Freighter injects `window.freighter` once the extension is installed.
  const freighter = (window as unknown as Record<string, unknown>).freighter as
    | {
        signTransaction: (xdr: string, opts?: Record<string, unknown>) => Promise<string>;
      }
    | undefined;
  return freighter ?? null;
}

/** Build a `Signer` backed by the Freighter extension. */
export async function getFreighterSigner(): Promise<Signer | null> {
  const freighter = await getFreighter();
  if (!freighter) return null;
  return async (txXdr, networkPassphrase) => {
    return freighter.signTransaction(txXdr, { networkPassphrase });
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
