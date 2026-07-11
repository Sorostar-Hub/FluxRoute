/**
 * RoutePreview — live quote preview shown while the user fills in the form.
 *
 * TASK-19: polls the solver network for a route quote every 10 seconds and
 * displays expected output, fee, protocol hops, and estimated fill time.
 * Shows a spinner while fetching.
 */

'use client';

import { useEffect, useRef, useState } from 'react';

export interface Quote {
  protocol: string;
  expectedOutput: string;
  fee: string;
  hops: string[];
  estimatedFillTimeSec: number;
  expiresAt: number; // ms since epoch
}

interface RoutePreviewProps {
  inputAmount: string;
  inputAsset: string;
  outputAsset: string;
  deadline: number;
}

const REFRESH_MS = 10_000;

export function RoutePreview({ inputAmount, inputAsset, outputAsset, deadline }: RoutePreviewProps) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!inputAmount || !inputAsset || !outputAsset) {
      setQuote(null);
      return;
    }

    const fetchQuote = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // In production this calls the solver quote endpoint; for the
        // testnet alpha we simulate a quote.
        await new Promise((r) => setTimeout(r, 400));
        setQuote({
          protocol: 'soroswap',
          expectedOutput: (parseFloat(inputAmount) * 0.97).toFixed(7),
          fee: (parseFloat(inputAmount) * 0.0005).toFixed(7),
          hops: [`${inputAsset} → ${outputAsset}`],
          estimatedFillTimeSec: 5,
          expiresAt: Date.now() + 60_000,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setQuote(null);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchQuote();
    timerRef.current = setInterval(fetchQuote, REFRESH_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [inputAmount, inputAsset, outputAsset]);

  if (!inputAmount) {
    return <div className="text-sm text-gray-400 p-4">Enter an amount to see a quote</div>;
  }

  if (isLoading && !quote) {
    return <div className="animate-pulse text-sm text-gray-400 p-4">Fetching best route…</div>;
  }

  if (error || !quote) {
    return <div className="text-sm text-gray-400 p-4">No solver data available</div>;
  }

  const nearDeadline = deadline > 0 && deadline * 1000 < Date.now() + 30_000;

  return (
    <div className="space-y-2 p-4 bg-gray-50 rounded-xl">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">Best route</span>
        <span className="text-xs px-2 py-0.5 bg-stellar-blue/10 text-stellar-blue rounded-full">
          {quote.protocol}
        </span>
      </div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-gray-500">You receive</span>
        <span className="text-lg font-semibold">{quote.expectedOutput}</span>
      </div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-gray-500">Fee</span>
        <span className="text-sm">{quote.fee}</span>
      </div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-gray-500">Hops</span>
        <span className="text-sm">{quote.hops.join(' → ')}</span>
      </div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-gray-500">Est. fill time</span>
        <span className="text-sm">{quote.estimatedFillTimeSec}s</span>
      </div>
      {nearDeadline && (
        <p className="text-xs text-yellow-600">⚠ Quote expires soon — deadline approaching</p>
      )}
    </div>
  );
}
