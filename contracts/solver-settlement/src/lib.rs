//! SolverSettlement Soroban contract.
//!
//! Executes intent settlement atomically: validates the intent against the
//! slippage floor, moves tokens between sender / solver / recipient, and marks
//! the intent filled in the IntentRegistry via a cross-contract call.
//!
//! Cross-contract calls use `Env::invoke_contract` against an interface trait
//! (`IntentRegistryInterface` in `fluxroute-lib`). There is no
//! `contractimport!` of the registry WASM, which removes the brittle
//! build-order dependency documented in TASK-1/TASK-3.

#![no_std]

use errors::SettlementError;
use fluxroute_lib::{
    Intent, IntentRegistryInterface, RouteStep, SettlementResult, TTL_EXTEND_LEDGERS,
    TTL_THRESHOLD_LEDGERS,
};
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, IntoVal, Symbol, Val, Vec,
};

pub mod errors;
pub mod settlement;
pub mod verification;

/// The SolverSettlement contract type.
#[contract]
pub struct SolverSettlementContract;

#[contracttype]
enum DataKey {
    Admin,
    Registry,
    FeeRecipient,
    Solver(Address),
}

fn extend_instance_ttl(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(TTL_THRESHOLD_LEDGERS, TTL_EXTEND_LEDGERS);
}

fn get_admin(env: &Env) -> Option<Address> {
    env.storage().instance().get(&DataKey::Admin)
}

fn get_registry(env: &Env) -> Option<Address> {
    env.storage().instance().get(&DataKey::Registry)
}

fn get_fee_recipient(env: &Env) -> Option<Address> {
    env.storage().instance().get(&DataKey::FeeRecipient)
}

fn is_solver(env: &Env, addr: &Address) -> bool {
    env.storage().instance().has(&DataKey::Solver(addr.clone()))
}

fn set_solver(env: &Env, addr: &Address, registered: bool) {
    let key = DataKey::Solver(addr.clone());
    if registered {
        env.storage().instance().set(&key, &true);
    } else {
        env.storage().instance().remove(&key);
    }
}

/// Runtime client for the IntentRegistry, built on `Env::invoke_contract`.
///
/// This satisfies `IntentRegistryInterface` without importing the registry's
/// compiled WASM (no `contractimport!`), per TASK-3.
struct RegistryClient;

impl IntentRegistryInterface for RegistryClient {
    fn get_intent(env: &Env, registry: &Address, id: u64) -> Intent {
        let mut args: Vec<Val> = Vec::new(env);
        args.push_back(id.into_val(env));
        env.invoke_contract::<Intent>(registry, &Symbol::new(env, "get_intent"), args)
    }

    fn mark_filled(env: &Env, registry: &Address, id: u64, solver: Address, gross_output: i128) {
        let mut args: Vec<Val> = Vec::new(env);
        args.push_back(id.into_val(env));
        args.push_back(solver.into_val(env));
        args.push_back(gross_output.into_val(env));
        let _: () = env.invoke_contract(registry, &Symbol::new(env, "mark_filled"), args);
    }
}

#[contractimpl]
impl SolverSettlementContract {
    /// Initialize the contract with an admin, the IntentRegistry address, and
    /// the fee recipient (commonly the solver, or a protocol treasury).
    pub fn initialize(
        env: Env,
        admin: Address,
        registry: Address,
        fee_recipient: Address,
    ) -> Result<(), SettlementError> {
        if get_admin(&env).is_some() {
            return Err(SettlementError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Registry, &registry);
        env.storage()
            .instance()
            .set(&DataKey::FeeRecipient, &fee_recipient);
        extend_instance_ttl(&env);
        Ok(())
    }

    /// Extend the instance storage TTL (TASK-2).
    pub fn bump_all(env: Env) {
        extend_instance_ttl(&env);
    }

    /// Register a solver. Admin only.
    pub fn register_solver(env: Env, solver: Address) -> Result<(), SettlementError> {
        extend_instance_ttl(&env);
        let admin = get_admin(&env).ok_or(SettlementError::NotInitialized)?;
        admin.require_auth();
        set_solver(&env, &solver, true);
        Ok(())
    }

    /// Remove a solver. Admin only.
    pub fn unregister_solver(env: Env, solver: Address) -> Result<(), SettlementError> {
        extend_instance_ttl(&env);
        let admin = get_admin(&env).ok_or(SettlementError::NotInitialized)?;
        admin.require_auth();
        set_solver(&env, &solver, false);
        Ok(())
    }

    /// Whether a solver is registered.
    pub fn is_registered_solver(env: Env, solver: Address) -> bool {
        extend_instance_ttl(&env);
        is_solver(&env, &solver)
    }

    /// The configured fee recipient.
    pub fn fee_recipient(env: Env) -> Result<Address, SettlementError> {
        extend_instance_ttl(&env);
        get_fee_recipient(&env).ok_or(SettlementError::NotInitialized)
    }

    /// Settle an intent. Moves tokens atomically and marks the intent filled.
    #[allow(clippy::too_many_arguments)]
    pub fn execute_settlement(
        env: Env,
        solver: Address,
        intent_id: u64,
        route: Vec<RouteStep>,
        gross_output: i128,
        input_token: Address,
        output_token: Address,
    ) -> Result<SettlementResult, SettlementError> {
        extend_instance_ttl(&env);
        let registry = get_registry(&env).ok_or(SettlementError::NotInitialized)?;
        let fee_recipient = get_fee_recipient(&env).ok_or(SettlementError::NotInitialized)?;

        solver.require_auth();
        if !is_solver(&env, &solver) {
            return Err(SettlementError::UnregisteredSolver);
        }
        if route.is_empty() {
            return Err(SettlementError::EmptyRoute);
        }
        if gross_output < 0 {
            return Err(SettlementError::InvalidAmount);
        }

        let intent = RegistryClient::get_intent(&env, &registry, intent_id);
        verification::validate_intent_for_fill(&intent, env.ledger().sequence() as u64)?;
        verification::check_slippage(gross_output, intent.min_output_amount)?;

        let fee = verification::compute_fee(gross_output, intent.solver_fee_bps);
        let net_output = gross_output - fee;

        // Mark filled first; if the transfers below panic, Soroban transaction
        // atomicity reverts this and all prior state changes.
        RegistryClient::mark_filled(&env, &registry, intent_id, solver.clone(), gross_output);

        settlement::execute_transfers(
            &env,
            &intent,
            &solver,
            gross_output,
            net_output,
            fee,
            &input_token,
            &output_token,
            &fee_recipient,
        );

        let result = SettlementResult {
            intent_id,
            gross_output,
            solver_fee: fee,
            net_output,
            solver: solver.clone(),
        };
        env.events().publish(
            (symbol_short!("SETTLE"), symbol_short!("DONE")),
            result.clone(),
        );
        Ok(result)
    }
}

#[cfg(test)]
mod tests;
