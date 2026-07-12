/**
 * WalletConnect — Freighter wallet connection button.
 */

'use client';

import { useWallet } from '../hooks/useWallet';
import { shortAddress } from '../lib/stellar';

export function WalletConnect() {
  const { address, isConnected, connect, disconnect, error } = useWallet();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm font-mono text-gray-600">{shortAddress(address)}</span>
        <button
          onClick={disconnect}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {error && <span className="text-xs text-red-500">{error.message}</span>}
      <button
        onClick={connect}
        className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-stellar-blue hover:opacity-90 transition"
      >
        Connect Wallet
      </button>
    </div>
  );
}
