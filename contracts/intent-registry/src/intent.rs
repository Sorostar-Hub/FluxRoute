//! Persistent storage helpers for the IntentRegistry contract.
//!
//! All persistent entries have their TTL extended when written (TASK-2):
//!   - the intent entry itself (`save_intent`)
//!   - the per-sender count and per-sender position entries (`index_intent_for_sender`)
//!
//! The instance storage TTL is bumped on every invocation via `bump_all`
//! in `lib.rs`.

use fluxroute_lib::{Intent, TTL_EXTEND_LEDGERS, TTL_THRESHOLD_LEDGERS};
use soroban_sdk::{contracttype, Address, Env, Vec};

/// Storage keys. Instance keys hold admin + counter; persistent keys hold the
/// intent map and the per-sender reverse index.
#[contracttype]
pub enum DataKey {
    Admin,
    Counter,
    Intent(u64),
    SenderCount(Address),
    SenderIntent(Address, u64),
}

pub fn get_admin(env: &Env) -> Option<Address> {
    env.storage().instance().get(&DataKey::Admin)
}

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&DataKey::Admin, admin);
}

pub fn get_counter(env: &Env) -> u64 {
    env.storage().instance().get(&DataKey::Counter).unwrap_or(0)
}

pub fn next_id(env: &Env) -> u64 {
    let id = get_counter(env) + 1;
    env.storage().instance().set(&DataKey::Counter, &id);
    id
}

/// Persist an intent and extend the TTL of its storage entry to ~6 months.
pub fn save_intent(env: &Env, intent: &Intent) {
    let key = DataKey::Intent(intent.id);
    env.storage().persistent().set(&key, intent);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD_LEDGERS, TTL_EXTEND_LEDGERS);
}

/// Fetch an intent by id.
pub fn get_intent(env: &Env, id: u64) -> Option<Intent> {
    env.storage().persistent().get(&DataKey::Intent(id))
}

/// Append an intent id to the per-sender reverse index, extending TTLs.
pub fn index_intent_for_sender(env: &Env, sender: &Address, id: u64) {
    let count_key = DataKey::SenderCount(sender.clone());
    let count: u64 = env.storage().persistent().get(&count_key).unwrap_or(0);
    let position_key = DataKey::SenderIntent(sender.clone(), count);

    env.storage().persistent().set(&position_key, &id);
    let new_count = count + 1;
    env.storage().persistent().set(&count_key, &new_count);

    env.storage()
        .persistent()
        .extend_ttl(&position_key, TTL_THRESHOLD_LEDGERS, TTL_EXTEND_LEDGERS);
    env.storage()
        .persistent()
        .extend_ttl(&count_key, TTL_THRESHOLD_LEDGERS, TTL_EXTEND_LEDGERS);
}

/// Page through a sender's intents. `start` is a 0-based offset.
pub fn get_intents_by_sender(env: &Env, sender: &Address, start: u64, limit: u64) -> Vec<Intent> {
    let mut result = Vec::new(env);
    let count_key = DataKey::SenderCount(sender.clone());
    let total: u64 = env.storage().persistent().get(&count_key).unwrap_or(0);

    if start >= total || limit == 0 {
        return result;
    }

    let mut i = start;
    let mut added: u64 = 0;
    while i < total && added < limit {
        let id: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::SenderIntent(sender.clone(), i))
            .unwrap_or(0);
        if let Some(intent) = get_intent(env, id) {
            result.push_back(intent);
        }
        i += 1;
        added += 1;
    }
    result
}
