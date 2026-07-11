/**
 * SolverFeed — live solver bids feed.
 *
 * TASK-16: polls the indexer's REST endpoint for active solver bids and
 * displays them. Falls back to "No solver data available" on error without
 * crashing.
 */

'use client';

import { useEffect, useState } from 'react';

import { INDEXER_URL } from '../lib/constants';

interface SolverBid {
  solverAddress: string;
  netOutput: string;
  protocol: string;
  timestamp: number;
}

export function SolverFeed({ intentId }: { intentId?: bigint }) {
  const [bids, setBids] = useState<SolverBid[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!intentId) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(
          `${INDEXER_URL}/api/solvers/${intentId.toString()}/bids`,
          { headers: { Accept: 'application/json' } },
        );
        if (!res.ok) throw new Error(`indexer ${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        setBids(json.bids ?? []);
        setIsConnected(true);
      } catch {
        if (cancelled) return;
        setIsConnected(false);
        setBids([]);
      }
    };

    void poll();
    const interval = setInterval(poll, 5_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [intentId]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Solver Bids</h3>
        <span className={`text-xs ${isConnected ? 'text-green-500' : 'text-gray-400'}`}>
          {isConnected ? '● live' : '○ disconnected'}
        </span>
      </div>
      {bids.length === 0 ? (
        <p className="text-sm text-gray-400">No solver data available</p>
      ) : (
        <ul className="space-y-2">
          {bids.map((bid, i) => (
            <li
              key={i}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div>
                <span className="text-xs font-mono text-gray-500">
                  {bid.solverAddress.slice(0, 4)}...{bid.solverAddress.slice(-4)}
                </span>
                <span className="ml-2 text-xs px-1.5 py-0.5 bg-stellar-blue/10 text-stellar-blue rounded">
                  {bid.protocol}
                </span>
              </div>
              <span className="text-sm font-semibold">{bid.netOutput}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
