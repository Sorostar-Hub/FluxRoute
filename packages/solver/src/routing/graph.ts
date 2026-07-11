/**
 * Liquidity-graph builder for multi-hop route optimization.
 *
 * Builds a directed graph of available pools across protocols so the
 * optimizer can find arbitrage-aware paths between any two assets.
 */

import type { Asset } from '@fluxroute/sdk';
import type { Protocol } from '../types';

export interface PoolEdge {
  protocol: Protocol;
  pool: string;
  assetA: Asset;
  assetB: Asset;
  reserveA: bigint;
  reserveB: bigint;
  feeBps: number;
}

export class LiquidityGraph {
  private readonly edges: Map<string, PoolEdge[]> = new Map();

  addEdge(edge: PoolEdge): void {
    const key = assetKey(edge.assetA);
    const list = this.edges.get(key) ?? [];
    list.push(edge);
    this.edges.set(key, list);

    const reverseKey = assetKey(edge.assetB);
    const reverseList = this.edges.get(reverseKey) ?? [];
    reverseList.push({ ...edge, assetA: edge.assetB, assetB: edge.assetA });
    this.edges.set(reverseKey, reverseList);
  }

  getNeighbors(asset: Asset): PoolEdge[] {
    return this.edges.get(assetKey(asset)) ?? [];
  }

  size(): number {
    return this.edges.size;
  }
}

function assetKey(asset: Asset): string {
  if (asset.type === 'native') return 'native';
  return `${asset.code}:${asset.issuer}`;
}
