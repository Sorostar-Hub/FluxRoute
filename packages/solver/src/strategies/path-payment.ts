/**
 * Stellar Path Payment solver strategy.
 *
 * Uses Horizon's `/paths/strict-send` endpoint to find competitive routes
 * for cross-asset swaps via Stellar's native multi-hop path payments. This is
 * the simplest strategy — it only relies on the public Horizon REST API.
 *
 * Reference: https://developers.stellar.org/docs/data/horizon
 */

import type { Asset } from '@fluxroute/sdk';
import { toStellarAsset } from '@fluxroute/sdk';

import type { Quote, RouteStep, SolverStrategy } from '../types';

interface HorizonPath {
  source_amount: string;
  destination_amount: string;
  destination_asset_type: string;
  destination_asset_code?: string;
  destination_asset_issuer?: string;
  source_asset_type: string;
  source_asset_code?: string;
  source_asset_issuer?: string;
  inner_path: Array<{
    operation: string;
    source_amount: string;
    destination_amount: string;
  }>;
}

interface HorizonPathsResponse {
  _embedded: { records: HorizonPath[] };
}

function assetToHorizon(asset: Asset): string {
  const stellar = toStellarAsset(asset);
  if (stellar.isNative()) return 'native';
  return `${stellar.getCode()}:${stellar.getIssuer()}`;
}

export class PathPaymentStrategy implements SolverStrategy {
  readonly name = 'path-payment' as const;
  private readonly horizonUrl: string;

  constructor(horizonUrl: string = 'https://horizon-testnet.stellar.org') {
    this.horizonUrl = horizonUrl.replace(/\/$/, '');
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.horizonUrl}/`, {
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async getQuote(input: Asset, output: Asset, amount: bigint): Promise<Quote | null> {
    const url = new URL(`${this.horizonUrl}/paths/strict-send`);
    url.searchParams.set('source_amount', stroopsToDecimal(amount));
    url.searchParams.set('source_asset', assetToHorizon(input));
    url.searchParams.set('destination_asset', assetToHorizon(output));

    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        console.warn(`path-payment: horizon responded ${res.status}`);
        return null;
      }
      const data = (await res.json()) as HorizonPathsResponse;
      const paths = data._embedded?.records;
      if (!paths || paths.length === 0) {
        return null;
      }
      // Pick the path delivering the most destination asset.
      const best = paths.reduce((a, b) =>
        BigInt(b.destination_amount) > BigInt(a.destination_amount) ? b : a,
      );
      return {
        protocol: 'path-payment',
        inputAsset: input,
        outputAsset: output,
        amountIn: amount,
        amountOut: BigInt(best.destination_amount),
        estimatedSettlementLedgers: 1,
        hops: best.inner_path.map((h) => ({
          protocol: 'path-payment' as const,
          pool: null,
          amountIn: BigInt(h.source_amount),
          amountOut: BigInt(h.destination_amount),
        })),
      };
    } catch (err) {
      console.warn(`path-payment: quote failed: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  buildRouteStep(quote: Quote): RouteStep {
    return {
      protocol: 'path-payment',
      pool: null,
      inputAsset: quote.inputAsset,
      outputAsset: quote.outputAsset,
      amountIn: quote.amountIn,
      amountOut: quote.amountOut,
    };
  }
}

// Horizon expects decimal amounts, not stroops. Convert at 7 decimals (XLM).
function stroopsToDecimal(stroops: bigint, decimals = 7): string {
  const abs = stroops < 0n ? -stroops : stroops;
  const str = abs.toString();
  const padded = str.padStart(decimals + 1, '0');
  const whole = padded.slice(0, padded.length - decimals) || '0';
  const fraction = padded.slice(padded.length - decimals).replace(/0+$/, '');
  return fraction === '' ? whole : `${whole}.${fraction}`;
}
