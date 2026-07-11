#![cfg(test)]

use super::{IntentRegistryContract, IntentRegistryContractClient};
use fluxroute_lib::{Asset, IntentStatus};

use soroban_sdk::{testutils::Address as _, testutils::Ledger as _, Address, Env};

use crate::errors::IntentRegistryError;

const DEADLINE_OFFSET: u64 = 1000;

fn setup() -> (Env, Address, IntentRegistryContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let sender = Address::generate(&env);
    let contract_id = env.register_contract(None, IntentRegistryContract);
    let client = IntentRegistryContractClient::new(&env, &contract_id);
    client.initialize(&admin);
    (env, sender, client)
}

fn usdc_asset(env: &Env, issuer: &Address) -> Asset {
    Asset::Alphanum4(
        soroban_sdk::bytesn!(env, [b'U', b'S', b'D', b'C']),
        issuer.clone(),
    )
}

fn deadline(env: &Env) -> u64 {
    env.ledger().sequence() as u64 + DEADLINE_OFFSET
}

#[test]
fn create_and_fetch_intent() {
    let (env, sender, client) = setup();
    let recipient = Address::generate(&env);
    let issuer = Address::generate(&env);
    let input = usdc_asset(&env, &issuer);

    let intent_id = client.create_intent(
        &sender,
        &recipient,
        &input,
        &Asset::Native,
        &100_0000000_i128,
        &90_0000000_i128,
        &deadline(&env),
        &5u32,
    );
    assert_eq!(intent_id, 1);
    assert_eq!(client.total_intents(), 1);

    let intent = client.get_intent(&1);
    assert_eq!(intent.status, IntentStatus::Open);
    assert_eq!(intent.sender, sender);
    assert_eq!(intent.recipient, recipient);
    assert_eq!(intent.min_output_amount, 90_0000000_i128);
    assert_eq!(intent.solver_fee_bps, 5);
}

#[test]
fn rejects_same_asset() {
    let (env, sender, client) = setup();
    let recipient = Address::generate(&env);

    let res = client.try_create_intent(
        &sender,
        &recipient,
        &Asset::Native,
        &Asset::Native,
        &100_i128,
        &90_i128,
        &deadline(&env),
        &5u32,
    );
    assert!(matches!(res, Err(Ok(IntentRegistryError::SameAsset))));
}

#[test]
fn rejects_past_deadline() {
    let (env, sender, client) = setup();
    let recipient = Address::generate(&env);
    let past = env.ledger().sequence() as u64;

    let res = client.try_create_intent(
        &sender,
        &recipient,
        &Asset::Native,
        &usdc_asset(&env, &Address::generate(&env)),
        &100_i128,
        &90_i128,
        &past,
        &5u32,
    );
    assert!(matches!(res, Err(Ok(IntentRegistryError::InvalidDeadline))));
}

#[test]
fn cancel_intent_marks_cancelled() {
    let (env, sender, client) = setup();
    let recipient = Address::generate(&env);

    let id = client.create_intent(
        &sender,
        &recipient,
        &Asset::Native,
        &usdc_asset(&env, &Address::generate(&env)),
        &100_i128,
        &90_i128,
        &deadline(&env),
        &5u32,
    );
    client.cancel_intent(&id);
    let intent = client.get_intent(&id);
    assert_eq!(intent.status, IntentStatus::Cancelled);
}

#[test]
fn expire_intent_after_deadline() {
    let (env, sender, client) = setup();
    let recipient = Address::generate(&env);
    let dl = env.ledger().sequence() as u64 + 5;

    let id = client.create_intent(
        &sender,
        &recipient,
        &Asset::Native,
        &usdc_asset(&env, &Address::generate(&env)),
        &100_i128,
        &90_i128,
        &dl,
        &5u32,
    );

    // Advance the ledger past the deadline.
    env.ledger().set_sequence_number((dl + 1) as u32);

    client.expire_intent(&id);
    let intent = client.get_intent(&id);
    assert_eq!(intent.status, IntentStatus::Expired);
}

#[test]
fn mark_filled_sets_solver() {
    let (env, sender, client) = setup();
    let recipient = Address::generate(&env);
    let solver = Address::generate(&env);

    let id = client.create_intent(
        &sender,
        &recipient,
        &Asset::Native,
        &usdc_asset(&env, &Address::generate(&env)),
        &100_i128,
        &90_i128,
        &deadline(&env),
        &5u32,
    );
    client.mark_filled(&id, &solver, &120_i128);
    let intent = client.get_intent(&id);
    assert_eq!(intent.status, IntentStatus::Filled);
    assert_eq!(intent.filled_by.unwrap(), solver);
}

#[test]
fn cannot_fill_twice() {
    let (env, sender, client) = setup();
    let recipient = Address::generate(&env);
    let solver = Address::generate(&env);

    let id = client.create_intent(
        &sender,
        &recipient,
        &Asset::Native,
        &usdc_asset(&env, &Address::generate(&env)),
        &100_i128,
        &90_i128,
        &deadline(&env),
        &5u32,
    );
    client.mark_filled(&id, &solver, &120_i128);
    let res = client.try_mark_filled(&id, &solver, &120_i128);
    assert!(matches!(res, Err(Ok(IntentRegistryError::IntentNotOpen))));
}
