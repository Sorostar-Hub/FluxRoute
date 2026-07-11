# ADR-001: Intent Schema Design

## Status
Accepted

## Context
The `Intent` struct is the core data unit users submit to FluxRoute. It must capture everything needed to express a swap, validate it on-chain, and settle it atomically. The struct carries: `id`, `sender`, `recipient`, `input_asset`, `output_asset`, `input_amount`, `min_output_amount`, `deadline`, `status`, `filled_by`, and `solver_fee_bps`.

Two fields required careful design choices: the slippage protection mechanism and the expiry semantics. Soroban does not expose wall-clock time, and percentage-based slippage is awkward to evaluate deterministically on-chain.

## Decision
We use an **absolute `min_output_amount` floor** rather than a percentage slippage parameter because:

- It is more precise for small amounts, where a percentage rounding would lose meaningful value.
- It maps directly to the contract's slippage check `gross_output < min_output_amount`, with no derivation step.
- It avoids floating-point or fixed-point division on-chain, keeping settlement cheap and deterministic.

We use an **absolute `deadline` expressed as a ledger sequence** rather than a timestamp because:

- Soroban has no reliable wall-clock source available to contracts.
- Ledger sequences are monotonically increasing and tamper-proof, giving a deterministic, consensus-aligned expiry.

The remaining fields (`sender`, `recipient`, asset/amount pairs, `status`, `filled_by`, `solver_fee_bps`) directly mirror the validation and settlement responsibilities split across the registry and settlement contracts.

## Consequences

**Positive:** Settlement slippage checks are a single integer comparison; deadlines are robust against clock skew and miner manipulation; the schema is self-contained and portable across contracts.

**Negative:** Users (or their wallets) must compute `min_output_amount` off-chain before submitting, which shifts quoting work to the client and can produce conservative or stale floors if the quote is delayed.
