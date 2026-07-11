/**
 * React hook: manage Freighter wallet connection state.
 */

import { useEffect, useState } from 'react';

interface FreighterWindow {
  freighter?: {
    getAddress: () => Promise<{ address: string }>;
    isConnected: () => Promise<boolean>;
    connect: () => Promise<{ address: string }>;
    disconnect: () => Promise<void>;
  };
}

export function useWallet(): {
  address: string | null;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  error: Error | null;
} {
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const freighter = (window as unknown as FreighterWindow).freighter;
    if (!freighter) return;
    freighter
      .getAddress()
      .then(({ address: addr }) => setAddress(addr))
      .catch(() => {});
  }, []);

  const connect = async () => {
    try {
      if (typeof window === 'undefined') return;
      const freighter = (window as unknown as FreighterWindow).freighter;
      if (!freighter) throw new Error('Freighter wallet not installed');
      const { address: addr } = await freighter.connect();
      setAddress(addr);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const disconnect = async () => {
    try {
      if (typeof window === 'undefined') return;
      const freighter = (window as unknown as FreighterWindow).freighter;
      if (!freighter) return;
      await freighter.disconnect();
      setAddress(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  return {
    address,
    isConnected: address !== null,
    connect,
    disconnect,
    error,
  };
}
