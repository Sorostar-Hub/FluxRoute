/**
 * Soroswap AMM solver strategy.
 *
 * Queries the Soroswap router API for a swap quote and builds the
 * corresponding `RouteStep` for settlement.
 *
 * Reference: https://docs.soroswap.finance
 * Testnet router: GET https://api.soroswap.finance/api/testnet/router
 */

import type { Asset } from '@fluxroute/sdk';
import { toStellarAsset } from '@fluxroute/sdk';

import type { Quote, RouteStep, SolverStrategy } from '../types';

interface SoroswapQuoteResponse {
  amountOut: string;
  routerAddress: string;
  hops?: Array<{ protocol: string; pool: string; amountIn: string; amountOut: string }>;
}

function assetToSoroswap(asset: Asset): string {
  return toStellarAsset(asset).toString();
}

export class SoroswapStrategy implements SolverStrategy {
  readonly name = 'soroswap' as const;
  private readonly apiUrl: string;
  private readonly routerAddress: string;

  constructor(apiUrl: string = 'https://api.soroswap.finance', routerAddress: string = '') {
    this.apiUrl = apiUrl.replace(/\/$/, '');
    this.routerAddress = routerAddress;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.apiUrl}/api/testnet/health`, {
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async getQuote(input: Asset, output: Asset, amount: bigint): Promise<Quote | null> {
    const url = new URL(`${this.apiUrl}/api/testnet/router`);
    url.searchParams.set('amountIn', amount.toString());
    url.searchParams.set('tokenIn', assetToSoroswap(input));
    url.searchParams.set('tokenOut', assetToSoroswap(output));

    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        console.warn(`soroswap: router responded ${res.status}`);
        return null;
      }
      const data = (await res.json()) as SoroswapQuoteResponse;
      if (!data.amountOut) {
        return null;
      }
      return {
        protocol: 'soroswap',
        inputAsset: input,
        outputAsset: output,
        amountIn: amount,
        amountOut: BigInt(data.amountOut),
        estimatedSettlementLedgers: 2,
        hops:
          data.hops?.map((h) => ({
            protocol: 'soroswap',
            pool: h.pool,
            amountIn: BigInt(h.amountIn),
            amountOut: BigInt(h.amountOut),
          })) ?? [],
      };
    } catch (err) {
      console.warn(`soroswap: quote failed: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  buildRouteStep(quote: Quote): RouteStep {
    return {
      protocol: 'soroswap',
      pool: this.routerAddress || quote.hops[0]?.pool || null,
      inputAsset: quote.inputAsset,
      outputAsset: quote.outputAsset,
      amountIn: quote.amountIn,
      amountOut: quote.amountOut,
    };
  }
}
