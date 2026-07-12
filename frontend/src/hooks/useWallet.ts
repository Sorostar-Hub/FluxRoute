/**
 * React hook: manage Freighter wallet connection state.
 */

import { useEffect, useState } from 'react';
import {
  isConnected as checkFreighterConnection,
  getAddress,
  requestAccess,
} from '@stellar/freighter-api';

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

    // Check if already connected and get address
    checkFreighterConnection()
      .then((connected) => {
        if (connected) {
          return getAddress();
        }
        return null;
      })
      .then((result) => {
        if (result && result.address && !result.error) {
          setAddress(result.address);
        }
      })
      .catch(() => {
        // Silently fail - user hasn't connected yet
      });
  }, []);

  const connect = async () => {
    try {
      if (typeof window === 'undefined') return;

      // Check if Freighter is installed
      const connected = await checkFreighterConnection();
      if (!connected) {
        throw new Error('Freighter wallet not installed. Please install it from freighter.app');
      }

      // Request access to the wallet
      const result = await requestAccess();
      if (result.error) {
        throw new Error(result.error);
      }

      if (!result.address) {
        throw new Error('Failed to get wallet address');
      }

      setAddress(result.address);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(new Error(errorMessage));
      throw err;
    }
  };

  const disconnect = async () => {
    try {
      // Freighter doesn't have a disconnect method in the API
      // We just clear the local state
      setAddress(null);
      setError(null);
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
