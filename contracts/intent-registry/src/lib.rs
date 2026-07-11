//! IntentRegistry Soroban contract.
//!
//! Stores user intents on-chain and tracks their lifecycle. The registry is
//! a pure state store: it does not move tokens. Funds are moved atomically by
//! the SolverSettlement contract, which calls `mark_filled` over the
//! cross-contract interface (see ADR-003).

#![no_std]

use errors::IntentRegistryError;
use fluxroute_lib::{Asset, Intent, IntentStatus, TTL_EXTEND_LEDGERS, TTL_THRESHOLD_LEDGERS};
use soroban_sdk::{contract, contractimpl, Address, Env, Vec};

pub mod errors;
pub mod events;
pub mod intent;

/// Extend the instance storage TTL. Inlined by every public function via
/// `bump_all` so persistent entries never silently expire (TASK-2).
fn extend_instance_ttl(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(TTL_THRESHOLD_LEDGERS, TTL_EXTEND_LEDGERS);
}

/// The IntentRegistry contract type. Exposed at the crate root so other
/// crates (e.g. solver-settlement tests) can register it via
/// `env.register_contract(None, IntentRegistryContract)`.
#[contract]
pub struct IntentRegistryContract;

#[contractimpl]
impl IntentRegistryContract {
    /// Initialize the contract, setting the admin. Callable once.
    pub fn initialize(env: Env, admin: Address) -> Result<(), IntentRegistryError> {
        if intent::get_admin(&env).is_some() {
            return Err(IntentRegistryError::AlreadyInitialized);
        }
        intent::set_admin(&env, &admin);
        extend_instance_ttl(&env);
        Ok(())
    }

    /// Extend the instance storage TTL. Callable directly to keep the
    /// contract instance alive (TASK-2).
    pub fn bump_all(env: Env) {
        extend_instance_ttl(&env);
    }

    /// Create and store a new intent. Returns the new intent id.
    #[allow(clippy::too_many_arguments)]
    pub fn create_intent(
        env: Env,
        sender: Address,
        recipient: Address,
        input_asset: Asset,
        output_asset: Asset,
        input_amount: i128,
        min_output_amount: i128,
        deadline: u64,
        solver_fee_bps: u32,
    ) -> Result<u64, IntentRegistryError> {
        extend_instance_ttl(&env);
        if intent::get_admin(&env).is_none() {
            return Err(IntentRegistryError::NotInitialized);
        }
        sender.require_auth();
        if input_amount <= 0 {
            return Err(IntentRegistryError::InvalidAmount);
        }
        if min_output_amount < 0 {
            return Err(IntentRegistryError::InvalidAmount);
        }
        if input_asset == output_asset {
            return Err(IntentRegistryError::SameAsset);
        }
        if sender == recipient {
            return Err(IntentRegistryError::SameSenderRecipient);
        }
        if deadline <= env.ledger().sequence() as u64 {
            return Err(IntentRegistryError::InvalidDeadline);
        }

        let id = intent::next_id(&env);
        let intent = Intent {
            id,
            sender,
            recipient,
            input_asset,
            output_asset,
            input_amount,
            min_output_amount,
            deadline,
            status: IntentStatus::Open,
            filled_by: None,
            solver_fee_bps,
        };
        intent::save_intent(&env, &intent);
        intent::index_intent_for_sender(&env, &intent.sender, id);
        events::intent_created(&env, id);
        Ok(id)
    }

    /// Fetch an intent by id. Errors if not found.
    pub fn get_intent(env: Env, id: u64) -> Result<Intent, IntentRegistryError> {
        extend_instance_ttl(&env);
        intent::get_intent(&env, id).ok_or(IntentRegistryError::IntentNotFound)
    }

    /// Total number of intents ever created.
    pub fn total_intents(env: Env) -> u64 {
        extend_instance_ttl(&env);
        intent::get_counter(&env)
    }

    /// Page through a sender's intents.
    pub fn intents_by_sender(env: Env, sender: Address, start: u64, limit: u64) -> Vec<Intent> {
        extend_instance_ttl(&env);
        intent::get_intents_by_sender(&env, &sender, start, limit)
    }

    /// Mark an intent as filled by `solver` with the achieved gross output.
    /// Intended to be called by the SolverSettlement contract over the
    /// cross-contract interface.
    ///
    /// NOTE: soroban-sdk 21 does not expose an invoker address, so this entry
    /// point is not caller-gated here. The settlement contract is the sole
    /// intended caller and funds only move inside it (see ADR-003). Marking an
    /// intent filled directly does not move any tokens.
    pub fn mark_filled(
        env: Env,
        id: u64,
        solver: Address,
        gross_output: i128,
    ) -> Result<(), IntentRegistryError> {
        extend_instance_ttl(&env);
        let mut intent = intent::get_intent(&env, id).ok_or(IntentRegistryError::IntentNotFound)?;
        if intent.status != IntentStatus::Open && intent.status != IntentStatus::Pending {
            return Err(IntentRegistryError::IntentNotOpen);
        }
        if env.ledger().sequence() as u64 > intent.deadline {
            return Err(IntentRegistryError::IntentExpired);
        }
        intent.status = IntentStatus::Filled;
        intent.filled_by = Some(solver);
        intent::save_intent(&env, &intent);
        events::intent_filled(&env, id, gross_output);
        Ok(())
    }

    /// Cancel an open intent. Only the sender may cancel.
    pub fn cancel_intent(env: Env, id: u64) -> Result<(), IntentRegistryError> {
        extend_instance_ttl(&env);
        let mut intent = intent::get_intent(&env, id).ok_or(IntentRegistryError::IntentNotFound)?;
        intent.sender.require_auth();
        if intent.status != IntentStatus::Open {
            return Err(IntentRegistryError::IntentNotOpen);
        }
        intent.status = IntentStatus::Cancelled;
        intent::save_intent(&env, &intent);
        events::intent_cancelled(&env, id);
        Ok(())
    }

    /// Expire an intent whose deadline has passed. Callable by anyone.
    pub fn expire_intent(env: Env, id: u64) -> Result<(), IntentRegistryError> {
        extend_instance_ttl(&env);
        let mut intent = intent::get_intent(&env, id).ok_or(IntentRegistryError::IntentNotFound)?;
        if intent.status != IntentStatus::Open && intent.status != IntentStatus::Pending {
            return Err(IntentRegistryError::IntentNotOpen);
        }
        if env.ledger().sequence() as u64 <= intent.deadline {
            return Err(IntentRegistryError::InvalidDeadline);
        }
        intent.status = IntentStatus::Expired;
        intent::save_intent(&env, &intent);
        events::intent_expired(&env, id);
        Ok(())
    }
}

#[cfg(test)]
mod tests;
