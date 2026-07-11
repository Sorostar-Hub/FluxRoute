/**
 * IntentForm — submit a new intent to the IntentRegistry.
 *
 * Collects input/output assets, amounts, and slippage, then calls
 * `client.createIntent()`.
 */

'use client';

import { useState } from 'react';
import { decimalToStroops } from '@fluxroute/sdk';

import { useFluxRoute } from '../hooks/useFluxRoute';
import { useWallet } from '../hooks/useWallet';

export function IntentForm({ onCreated }: { onCreated?: (id: bigint) => void }) {
  const { client } = useFluxRoute();
  const { address } = useWallet();
  const [inputAmount, setInputAmount] = useState('');
  const [minOutput, setMinOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !address) {
      setError('Connect your wallet first');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const id = await client.createIntent({
        sender: address,
        recipient: address,
        inputAsset: { type: 'native' },
        outputAsset: { type: 'credit4', code: 'USDC', issuer: 'GAB5L'.padEnd(56, 'A') },
        inputAmount: decimalToStroops(inputAmount || '0', 7),
        minOutputAmount: decimalToStroops(minOutput || '0', 7),
        deadline: BigInt(1_000_000),
        solverFeeBps: 5,
      });
      onCreated?.(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-6 bg-white rounded-xl shadow-sm">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          You pay (XLM)
        </label>
        <input
          type="text"
          value={inputAmount}
          onChange={(e) => setInputAmount(e.target.value)}
          placeholder="100.0"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-stellar-blue focus:border-transparent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Minimum you receive (USDC)
        </label>
        <input
          type="text"
          value={minOutput}
          onChange={(e) => setMinOutput(e.target.value)}
          placeholder="95.0"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-stellar-blue focus:border-transparent"
        />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={loading || !client || !address}
        className="w-full py-2.5 text-white font-medium rounded-lg bg-stellar-blue hover:opacity-90 disabled:opacity-50 transition"
      >
        {loading ? 'Submitting...' : 'Submit Intent'}
      </button>
    </form>
  );
}
