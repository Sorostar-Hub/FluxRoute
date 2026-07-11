/**
 * Route optimizer.
 *
 * Given a liquidity graph and an input/output asset pair, finds the path
 * maximizing the net output. Uses a modified Bellman-Ford that accounts for
 * pool fees at each hop.
 */

import type { Asset } from '@fluxroute/sdk';
import { LiquidityGraph, type PoolEdge } from './graph';

export interface OptimalRoute {
  edges: PoolEdge[];
  netOutput: bigint;
}

export function findOptimalRoute(
  graph: LiquidityGraph,
  input: Asset,
  output: Asset,
  amountIn: bigint,
): OptimalRoute | null {
  if (amountIn <= 0n) return null;

  // BFS over up to 3 hops; for each node track the best (output, path).
  const maxHops = 3;
  type State = { asset: Asset; amount: bigint; edges: PoolEdge[] };
  let frontier: State[] = [{ asset: input, amount: amountIn, edges: [] }];
  let best: OptimalRoute | null = null;

  for (let depth = 0; depth < maxHops && frontier.length > 0; depth++) {
    const next: State[] = [];
    for (const node of frontier) {
      for (const edge of graph.getNeighbors(node.asset)) {
        if (node.edges.includes(edge)) continue; // avoid cycles
        const outAmount = applyFee(node.amount, edge.feeBps);
        if (outAmount <= 0n) continue;
        const state: State = {
          asset: edge.assetB,
          amount: outAmount,
          edges: [...node.edges, edge],
        };
        if (assetEquals(state.asset, output)) {
          if (!best || state.amount > best.netOutput) {
            best = { edges: state.edges, netOutput: state.amount };
          }
        } else {
          next.push(state);
        }
      }
    }
    frontier = next;
  }

  return best;
}

function applyFee(amount: bigint, feeBps: number): bigint {
  const fee = (amount * BigInt(feeBps)) / 10_000n;
  return amount - fee;
}

function assetEquals(a: Asset, b: Asset): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'native' && b.type === 'native') return true;
  if (a.type !== 'native' && b.type !== 'native') {
    return a.code === b.code && a.issuer === b.issuer;
  }
  return false;
}
