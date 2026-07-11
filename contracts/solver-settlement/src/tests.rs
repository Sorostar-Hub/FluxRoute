#![cfg(test)]

//! Test suite for the SolverSettlement contract (TASK-4).
//!
//! Covers: happy-path settlement, slippage enforcement, unregistered solver,
//! empty route, admin-only registration, and fee calculation edge cases.

use super::{SolverSettlementContract, SolverSettlementContractClient};
use crate::errors::SettlementError;
use crate::verification;
use fluxroute_lib::{Asset, IntentStatus, RouteStep};
use intent_registry::{IntentRegistryContract, IntentRegistryContractClient};

use soroban_sdk::{
    testutils::Address as _, token::Client as TokenClient, token::StellarAssetClient, Address, Env,
    Symbol, Vec,
};

const INPUT_AMOUNT: i128 = 100_0000000; // 100 units (7 decimals)
const MIN_OUTPUT: i128 = 90_0000000; // recipient slippage floor
const FEE_BPS: u32 = 5; // 0.05%
const SOLVER_STASH: i128 = 1_000_000_000_000; // solver's output-asset stash

struct World {
    env: Env,
    admin: Address,
    sender: Address,
    recipient: Address,
    solver: Address,
    registry: Address,
    settlement: Address,
    input_token: Address,
    output_token: Address,
}

fn world() -> World {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let solver = Address::generate(&env);

    let registry = env.register_contract(None, IntentRegistryContract);
    let settlement = env.register_contract(None, SolverSettlementContract);

    let input_token = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let output_token = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();

    IntentRegistryContractClient::new(&env, &registry).initialize(&admin);
    // fee recipient = solver, so the solver "receives the fee".
    SolverSettlementContractClient::new(&env, &settlement).initialize(&admin, &registry, &solver);

    // Fund the participants. set_authorized is a no-op if auth is not required
    // by the asset, and required if it is — call it either way to be safe.
    let input_sac = StellarAssetClient::new(&env, &input_token);
    let output_sac = StellarAssetClient::new(&env, &output_token);
    for addr in [&sender, &recipient, &solver] {
        input_sac.set_authorized(addr, &true);
        output_sac.set_authorized(addr, &true);
    }
    input_sac.mint(&sender, &INPUT_AMOUNT);
    output_sac.mint(&solver, &SOLVER_STASH);

    // Register the solver.
    SolverSettlementContractClient::new(&env, &settlement).register_solver(&solver);

    World {
        env,
        admin,
        sender,
        recipient,
        solver,
        registry,
        settlement,
        input_token,
        output_token,
    }
}

fn output_asset(env: &Env, issuer: &Address) -> Asset {
    Asset::Alphanum4(
        soroban_sdk::bytesn!(env, [b'X', b'L', b'M', b'1']),
        issuer.clone(),
    )
}

fn single_step_route(env: &Env, amount_in: i128, amount_out: i128) -> Vec<RouteStep> {
    let mut route = Vec::new(env);
    route.push_back(RouteStep {
        protocol: Symbol::new(env, "soroswap"),
        pool: None,
        input_asset: Asset::Native,
        output_asset: Asset::Native,
        amount_in,
        amount_out,
    });
    route
}

fn make_intent(w: &World) -> u64 {
    let registry_client = IntentRegistryContractClient::new(&w.env, &w.registry);
    registry_client.create_intent(
        &w.sender,
        &w.recipient,
        &Asset::Native,
        &output_asset(&w.env, &w.admin),
        &INPUT_AMOUNT,
        &MIN_OUTPUT,
        &(w.env.ledger().sequence() as u64 + 1000),
        &FEE_BPS,
    )
}

#[test]
fn happy_path_settlement() {
    let w = world();
    let registry_client = IntentRegistryContractClient::new(&w.env, &w.registry);
    let settlement_client = SolverSettlementContractClient::new(&w.env, &w.settlement);
    let input_token = TokenClient::new(&w.env, &w.input_token);
    let output_token = TokenClient::new(&w.env, &w.output_token);

    let gross_output = 120_0000000_i128;
    let intent_id = make_intent(&w);

    // Approvals: the settlement contract pulls input from the sender and the
    // gross output from the solver.
    let expiration = w.env.ledger().sequence() + 100_000;
    input_token.approve(&w.sender, &w.settlement, &INPUT_AMOUNT, &expiration);
    output_token.approve(&w.solver, &w.settlement, &SOLVER_STASH, &expiration);

    let route = single_step_route(&w.env, INPUT_AMOUNT, gross_output);
    let result = settlement_client.execute_settlement(
        &w.solver,
        &intent_id,
        &route,
        &gross_output,
        &w.input_token,
        &w.output_token,
    );

    let fee = verification::compute_fee(gross_output, FEE_BPS);
    let net = gross_output - fee;

    assert_eq!(result.intent_id, intent_id);
    assert_eq!(result.gross_output, gross_output);
    assert_eq!(result.solver_fee, fee);
    assert_eq!(result.net_output, net);

    // Recipient received the net output.
    assert_eq!(output_token.balance(&w.recipient), net);
    // Sender's input was consumed.
    assert_eq!(input_token.balance(&w.sender), 0);
    // Solver received the input asset...
    assert_eq!(input_token.balance(&w.solver), INPUT_AMOUNT);
    // ...and received the fee (deposited gross, got fee back).
    assert_eq!(
        output_token.balance(&w.solver),
        SOLVER_STASH - gross_output + fee
    );

    // Intent is now Filled.
    let intent = registry_client.get_intent(&intent_id);
    assert_eq!(intent.status, IntentStatus::Filled);
    assert_eq!(intent.filled_by.unwrap(), w.solver);
}

#[test]
fn slippage_exceeded_reverts() {
    let w = world();
    let registry_client = IntentRegistryContractClient::new(&w.env, &w.registry);
    let settlement_client = SolverSettlementContractClient::new(&w.env, &w.settlement);

    let gross_output = MIN_OUTPUT - 1; // below the slippage floor
    let intent_id = make_intent(&w);

    let route = single_step_route(&w.env, INPUT_AMOUNT, gross_output);
    let res = settlement_client.try_execute_settlement(
        &w.solver,
        &intent_id,
        &route,
        &gross_output,
        &w.input_token,
        &w.output_token,
    );
    assert!(matches!(res, Err(Ok(SettlementError::SlippageExceeded))));

    // No funds moved, intent still open.
    let input_token = TokenClient::new(&w.env, &w.input_token);
    assert_eq!(input_token.balance(&w.sender), INPUT_AMOUNT);
    let intent = registry_client.get_intent(&intent_id);
    assert_eq!(intent.status, IntentStatus::Open);
}

#[test]
fn unregistered_solver_reverts() {
    let w = world();
    let registry_client = IntentRegistryContractClient::new(&w.env, &w.registry);
    let settlement_client = SolverSettlementContractClient::new(&w.env, &w.settlement);

    let gross_output = 120_0000000_i128;
    let intent_id = make_intent(&w);

    let rogue = Address::generate(&w.env);
    let route = single_step_route(&w.env, INPUT_AMOUNT, gross_output);
    let res = settlement_client.try_execute_settlement(
        &rogue,
        &intent_id,
        &route,
        &gross_output,
        &w.input_token,
        &w.output_token,
    );
    assert!(matches!(res, Err(Ok(SettlementError::UnregisteredSolver))));
    let intent = registry_client.get_intent(&intent_id);
    assert_eq!(intent.status, IntentStatus::Open);
}

#[test]
fn empty_route_reverts() {
    let w = world();
    let settlement_client = SolverSettlementContractClient::new(&w.env, &w.settlement);

    let gross_output = 120_0000000_i128;
    let intent_id = make_intent(&w);

    let empty_route = Vec::new(&w.env);
    let res = settlement_client.try_execute_settlement(
        &w.solver,
        &intent_id,
        &empty_route,
        &gross_output,
        &w.input_token,
        &w.output_token,
    );
    assert!(matches!(res, Err(Ok(SettlementError::EmptyRoute))));
}

#[test]
fn non_admin_cannot_register_solver() {
    // A fresh environment without mocked auths: the admin has not authorized
    // the registration, so `admin.require_auth()` traps.
    let env = Env::default();
    let admin = Address::generate(&env);
    let solver = Address::generate(&env);
    let registry = env.register_contract(None, IntentRegistryContract);
    let settlement = env.register_contract(None, SolverSettlementContract);
    IntentRegistryContractClient::new(&env, &registry).initialize(&admin);
    SolverSettlementContractClient::new(&env, &settlement).initialize(&admin, &registry, &solver);

    let client = SolverSettlementContractClient::new(&env, &settlement);
    let attempted = Address::generate(&env);
    let res = client.try_register_solver(&attempted);
    assert!(res.is_err()); // trapped: admin did not authorize
    assert!(!client.is_registered_solver(&attempted));
}

#[test]
fn fee_calculation_edges() {
    assert_eq!(verification::compute_fee(0, 5), 0);
    assert_eq!(verification::compute_fee(1, 5), 0); // 1 * 5 / 10000 = 0 (truncates)
    assert_eq!(verification::compute_fee(1_000_000_000, 5), 500_000); // 0.05% of 1e9
    assert_eq!(verification::compute_fee(1_000_000_000, 0), 0);
    assert_eq!(verification::compute_fee(100, 10), 0); // 0.1% of 100 truncates to 0
    assert_eq!(verification::compute_fee(10000, 100), 100); // 1% of 10000 = 100
    assert_eq!(verification::compute_fee(20_0000000_i128, 5), 100_000); // 0.05% of 20 (7dp) = 0.01 = 100000 stroops
}
