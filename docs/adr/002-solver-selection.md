# ADR-002: Off-Chain Competitive Solver Selection

## Status
Accepted

## Context
FluxRoute must route user intents across a fragmented set of Stellar liquidity venues. The design question is where routing logic should live: executed on-chain (as in Uniswap v4 hooks, where custom code runs inside the pool swap path) or computed off-chain by a competing network of solver nodes.

On-chain routing keeps state colocated but forces every venue query, hop, and comparison to consume gas, and it typically requires oracles to reason about external pools.

## Decision
We use an **off-chain solver network** in which multiple solver nodes independently compute routes and compete; the solver producing the highest `net_output` wins the right to settle the intent. This is preferred over on-chain routing (e.g. Uniswap v4 hooks) because:

- Solvers can query external venues and APIs (Soroswap, Blend, DeFindex, Horizon) off-chain with **no gas cost** per query.
- Open competition drives offered prices toward the true best execution.
- It keeps the on-chain contracts minimal—limited to validation and settlement, with **no routing logic on-chain**.
- It removes the need for on-chain price oracles, since solvers source quotes directly.

The winning route is submitted to the settlement contract, which only validates and executes.

## Consequences

**Positive:** Minimal, auditable contracts; gas-efficient for users; routing can evolve without contract upgrades; competition improves fill quality.

**Negative:** Requires operating solver infrastructure and maintaining venue integrations; concentration risk if few solvers operate, weakening competition; off-chain computation adds latency to the fill path.
