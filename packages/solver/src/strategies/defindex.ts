/**
 * DeFindex yield-vault solver strategy (stub).
 *
 * DeFindex routes through yield-optimized vaults. This stub implements the
 * `SolverStrategy` interface but returns `null` from `getQuote` until the
 * integration is built.
 */

import type { Asset } from '@fluxroute/sdk';

import type { Quote, RouteStep, SolverStrategy } from '../types';

export class DefindexStrategy implements SolverStrategy {
  readonly name = 'defindex' as const;
  private readonly contractId: string;

  constructor(contractId: string = '') {
    this.contractId = contractId;
  }

  async isAvailable(): Promise<boolean> {
    return this.contractId !== '';
  }

  async getQuote(_input: Asset, _output: Asset, _amount: bigint): Promise<Quote | null> {
    return null;
  }

  buildRouteStep(quote: Quote): RouteStep {
    return {
      protocol: 'defindex',
      pool: this.contractId || null,
      inputAsset: quote.inputAsset,
      outputAsset: quote.outputAsset,
      amountIn: quote.amountIn,
      amountOut: quote.amountOut,
    };
  }
}
