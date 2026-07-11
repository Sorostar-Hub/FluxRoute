# ADR-003: Atomic Settlement via a Dedicated Contract

## Status
Accepted

## Context
FluxRoute separates intent storage from value movement. The `IntentRegistry` holds intent state, while a `SolverSettlement` contract validates a submitted route, executes token transfers atomically, and marks the intent filled via a cross-contract call to the registry. The settlement contract also charges a 5 basis point (0.05%) solver fee and must guarantee users receive at least their quoted floor.

## Decision
We use a **dedicated `SolverSettlement` contract, separate from `IntentRegistry`**, because:

- **Separation of concerns:** the registry stores state; the settlement contract moves value.
- **Upgradeability:** settlement logic can be upgraded without migrating intent data.
- **Reduced attack surface:** the settlement contract is the **only contract that handles tokens**, so token-handling risk is isolated from the broader registry.

We set the **fee at 5 bps (0.05%)**, which is competitive with prevailing DEX fees while still incentivizing solvers to participate and compete.

**Slippage is enforced** by the settlement contract: before completing the transfer, it checks `gross_output >= intent.min_output_amount`. If the check fails, the entire transaction reverts, relying on Soroban's transaction atomicity to guarantee that no partial fill or token loss can occur.

## Consequences

**Positive:** Isolated token risk; upgradeable settlement without data migration; strong slippage guarantee via atomic reverts; fee both competitive and self-funding.

**Negative:** Adds a cross-contract call per fill (minor gas overhead); an upgrade to settlement still requires governance and careful re-audit of the isolated token path.
