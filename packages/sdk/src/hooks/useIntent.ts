/**
 * React hook: poll an intent by id until it reaches a terminal status.
 *
 * Requires React >=18 and the `react` peer-dependency. This module is only
 * imported when the consumer is in a React context; the SDK core stays
 * framework-agnostic.
 */

import { useEffect, useRef, useState } from 'react';

import type { FluxRouteClient } from '../client';
import { TERMINAL_STATUS, type Intent, type IntentStatus } from '../types';

export interface UseIntentResult {
  intent: Intent | null;
  status: IntentStatus | null;
  isLoading: boolean;
  error: Error | null;
}

const POLL_INTERVAL_MS = 3_000;

export function useIntent(
  client: FluxRouteClient | null,
  intentId: bigint | null,
): UseIntentResult {
  const [intent, setIntent] = useState<Intent | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!client || intentId === null) {
      setIntent(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const poll = async () => {
      try {
        const result = await client.getIntent(intentId);
        if (cancelled) return;
        setIntent(result);
        setError(null);
        if (TERMINAL_STATUS.has(result.status)) {
          setIsLoading(false);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        } else {
          setIsLoading(false);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
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
  }, [client, intentId?.toString()]);

  return {
    intent,
    status: intent?.status ?? null,
    isLoading,
    error,
  };
}
