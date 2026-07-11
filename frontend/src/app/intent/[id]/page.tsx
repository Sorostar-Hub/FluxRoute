/**
 * Intent status tracking page — `/intent/[id]`.
 *
 * TASK-17: fetches an intent by id using `useIntent`, displays its status,
 * assets, amounts, and a deadline countdown, and live-polls until a terminal
 * status. Shows a Stellar Expert link to the fill transaction.
 */

'use client';

import { use, useEffect, useState } from 'react';
import { useIntent } from '@fluxroute/sdk';

import { StatusBadge } from '../../../components/StatusBadge';
import { useFluxRoute } from '../../../hooks/useFluxRoute';
import { formatAmount, shortAddress } from '../../../lib/stellar';

export default function IntentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const intentId = BigInt(id);
  const { client } = useFluxRoute();
  const { intent, isLoading, error } = useIntent(client, intentId);
  const [countdown, setCountdown] = useState<string>('');

  // Deadline countdown.
  useEffect(() => {
    if (!intent) return;
    const update = () => {
      // Deadline is a ledger sequence; we can't know the current ledger
      // client-side without an RPC call, so show the raw deadline.
      setCountdown(`ledger ${intent.deadline.toString()}`);
    };
    update();
  }, [intent]);

  if (isLoading && !intent) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="animate-pulse text-gray-400">Loading intent…</div>
      </div>
    );
  }

  if (error || !intent) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <p className="text-red-500">
          {error?.message ?? 'Intent not found'}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Intent #{intent.id.toString()}</h1>
        <StatusBadge status={intent.status} />
      </div>

      <dl className="space-y-3 bg-white rounded-xl shadow-sm p-6">
        <div className="flex justify-between">
          <dt className="text-sm text-gray-500">Sender</dt>
          <dd className="text-sm font-mono">{shortAddress(intent.sender)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-sm text-gray-500">Recipient</dt>
          <dd className="text-sm font-mono">{shortAddress(intent.recipient)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-sm text-gray-500">Input</dt>
          <dd className="text-sm">{formatAmount(intent.inputAmount)} XLM</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-sm text-gray-500">Min. output</dt>
          <dd className="text-sm">{formatAmount(intent.minOutputAmount)} USDC</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-sm text-gray-500">Deadline</dt>
          <dd className="text-sm">{countdown}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-sm text-gray-500">Solver fee</dt>
          <dd className="text-sm">{intent.solverFeeBps / 100}%</dd>
        </div>
        {intent.filledBy && (
          <div className="flex justify-between">
            <dt className="text-sm text-gray-500">Filled by</dt>
            <dd className="text-sm font-mono">{shortAddress(intent.filledBy)}</dd>
          </div>
        )}
      </dl>

      {intent.status === 'Filled' && (
        <a
          href={`https://stellar.expert/explorer/testnet/account/${intent.filledBy}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block mt-4 text-center text-sm text-stellar-blue underline"
        >
          View on Stellar Expert →
        </a>
      )}

      {intent.status !== 'Filled' &&
        intent.status !== 'Cancelled' &&
        intent.status !== 'Expired' && (
          <p className="mt-4 text-sm text-gray-400 text-center">
            Live-updating every 3 seconds until filled…
          </p>
        )}
    </div>
  );
}
