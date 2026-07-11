/**
 * React hook: manage a FluxRoute client instance and expose convenience
 * methods. The client is constructed lazily so Freighter is only accessed
 * in the browser.
 */

import { useEffect, useState } from 'react';

import { FluxRouteClient } from '@fluxroute/sdk';

import { createClient } from '../lib/stellar';

export function useFluxRoute(): {
  client: FluxRouteClient | null;
  isConnected: boolean;
  error: Error | null;
} {
  const [client, setClient] = useState<FluxRouteClient | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    createClient()
      .then((c) => {
        if (!cancelled) setClient(c);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { client, isConnected: client !== null, error };
}
