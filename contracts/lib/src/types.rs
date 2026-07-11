//! Shared types used by both the IntentRegistry and SolverSettlement contracts.
//!
//! Defining these in a dedicated `fluxroute-lib` crate keeps the two contracts
//! decoupled at the WASM level: SolverSettlement does NOT import the
//! IntentRegistry WASM (`contractimport!`). Instead it calls the registry
//! at runtime via `Env::invoke_contract` using the trait interface declared
//! below. This removes the brittle build-order dependency on a pre-built
//! WASM file. See `solver-settlement/src/lib.rs` and ADR-003.

use soroban_sdk::{contracttype, Address, BytesN, Symbol};

/// A Stellar asset: native XLM or an alphanumeric credit asset.
///
/// Mirrors the Stellar `Asset` XDR so the SDK/indexer can represent assets
/// identically across Rust and TypeScript.
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Asset {
    Native,
    Alphanum4(BytesN<4>, Address),
    Alphanum12(BytesN<12>, Address),
}

/// Lifecycle of an intent.
///
/// Transitions:
///   Open      -> Pending  (a solver starts settling)
///   Open      -> Cancelled (sender cancels before fill)
///   Open/Pending -> Filled  (settlement succeeds)
///   Open      -> Expired   (ledger passes the deadline)
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum IntentStatus {
    Open,
    Pending,
    Filled,
    Cancelled,
    Expired,
}

/// An immutable record of a user's desired outcome.
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Intent {
    pub id: u64,
    pub sender: Address,
    pub recipient: Address,
    pub input_asset: Asset,
    pub output_asset: Asset,
    pub input_amount: i128,
    /// Slippage floor: the gross output the recipient is willing to accept.
    pub min_output_amount: i128,
    /// Absolute deadline as a ledger sequence. After this, the intent expires.
    pub deadline: u64,
    pub status: IntentStatus,
    /// Solver that filled the intent, if any.
    pub filled_by: Option<Address>,
    /// Protocol fee charged on the gross output, in basis points (1 bps = 0.01%).
    pub solver_fee_bps: u32,
}

/// A single hop in an execution route. The solver builds these off-chain and
/// the settlement contract validates that the route is non-empty before
/// settling.
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RouteStep {
    pub protocol: Symbol,
    pub pool: Option<Address>,
    pub input_asset: Asset,
    pub output_asset: Asset,
    pub amount_in: i128,
    pub amount_out: i128,
}

/// Outcome of a settlement, returned to the caller and emitted in the
/// `SETTLE.DONE` event.
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SettlementResult {
    pub intent_id: u64,
    pub gross_output: i128,
    pub solver_fee: i128,
    pub net_output: i128,
    pub solver: Address,
}

/// Runtime interface for the IntentRegistry contract.
///
/// SolverSettlement depends only on this trait (and on `Env::invoke_contract`),
/// not on the registry's compiled WASM. This is the pattern mandated by
/// TASK-3 to eliminate the cross-contract WASM build-order dependency.
pub trait IntentRegistryInterface {
    /// Fetch an intent by id. Panics (raises a host error) if not found.
    fn get_intent(env: &soroban_sdk::Env, registry: &Address, id: u64) -> Intent;
    /// Mark an intent as filled by `solver` with the achieved gross output.
    fn mark_filled(
        env: &soroban_sdk::Env,
        registry: &Address,
        id: u64,
        solver: Address,
        gross_output: i128,
    );
}

/// Default TTL (in ledgers) to extend persistent storage entries to.
/// ~3,110,400 ledgers ≈ 6 months at 5s/ledger, the value mandated by TASK-2.
pub const TTL_EXTEND_LEDGERS: u32 = 3_110_400;
/// If a persistent entry has fewer than this many ledgers of life remaining,
/// its TTL is bumped back to TTL_EXTEND_LEDGERS.
pub const TTL_THRESHOLD_LEDGERS: u32 = 1_000;
