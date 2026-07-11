/**
 * Home page — intent submission form with live route preview and solver feed.
 *
 * TASK-19: RoutePreview is wired to the form state so quotes update as the
 * user types. TASK-16: SolverFeed shows live bids from the indexer.
 */

'use client';

import { useState } from 'react';

import { IntentForm } from '../components/IntentForm';
import { RoutePreview } from '../components/RoutePreview';
import { SolverFeed } from '../components/SolverFeed';
import { WalletConnect } from '../components/WalletConnect';

export default function HomePage() {
  const [intentId, setIntentId] = useState<bigint | null>(null);
  const [inputAmount, setInputAmount] = useState('');
  const [inputAsset] = useState('XLM');
  const [outputAsset] = useState('USDC');

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-stellar-black">
            FluxRoute<span className="text-stellar-blue">⚡</span>
          </h1>
          <WalletConnect />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <IntentForm
              onCreated={(id) => {
                setIntentId(id);
                setInputAmount('');
              }}
            />
          </div>
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-3">Route Preview</h2>
              <RoutePreview
                inputAmount={inputAmount}
                inputAsset={inputAsset}
                outputAsset={outputAsset}
                deadline={intentId ? 60 : 0}
              />
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6">
              <SolverFeed intentId={intentId ?? undefined} />
            </div>
          </div>
        </div>

        {intentId && (
          <div className="mt-8 p-4 bg-green-50 rounded-xl text-center">
            <p className="text-sm text-green-700">
              Intent created! ID: <span className="font-mono">{intentId.toString()}</span>
            </p>
            <a
              href={`/intent/${intentId.toString()}`}
              className="text-sm text-stellar-blue underline mt-1 inline-block"
            >
              Track status →
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
