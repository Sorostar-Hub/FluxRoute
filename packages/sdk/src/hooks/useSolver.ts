/**
 * React hook: poll active solver bids for a given intent from the indexer.
 *
 * The indexer exposes a REST endpoint `GET /api/solvers/:intentId/bids` that
 * returns an array of `SolverQuote`. The hook gracefully handles network
 * errors without crashing the host component.
 */

import { useEffect, useRef, useState } from 'react';

import type { SolverQuote } from '../types';

export interface UseSolverResult {
  bids: SolverQuote[];
  bestBid: SolverQuote | null;
  isConnected: boolean;
  error: Error | null;
}

const POLL_INTERVAL_MS = 5_000;

interface SolverBidsResponse {
  bids: SolverQuote[];
}

function parseBidsResponse(raw: unknown): SolverQuote[] {
  if (!raw || typeof raw !== 'object') return [];
  const bids = (raw as SolverBidsResponse).bids;
  return Array.isArray(bids) ? bids : [];
}

export function useSolver(
  indexerUrl: string | null,
  intentId: bigint | null,
): UseSolverResult {
  const [bids, setBids] = useState<SolverQuote[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!indexerUrl || intentId === null) {
      setBids([]);
      setIsConnected(false);
      setError(null);
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(
          `${indexerUrl.replace(/\/$/, '')}/api/solvers/${intentId.toString()}/bids`,
          { headers: { Accept: 'application/json' } },
        );
        if (!res.ok) {
          throw new Error(`indexer responded ${res.status} ${res.statusText}`);
        }
        const json = await res.json();
        if (cancelled) return;
        setBids(parseBidsResponse(json));
        setIsConnected(true);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsConnected(false);
      }
    };

    void poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [indexerUrl, intentId?.toString()]);

  const bestBid =
    bids.length === 0
      ? null
      : bids.reduce((best, bid) =>
          bid.netOutput > best.netOutput ? bid : best,
        );

  return { bids, bestBid, isConnected, error };
}
