//! Event helpers for the IntentRegistry contract.
//!
//! Topics use the abbreviated names mandated by the indexer (TASK-14):
//!   INTENT.CREATED, INTENT.FILLED, INTENT.CANCELD, INTENT.EXPIRD
//! The settlement contract additionally emits SETTLE.DONE.

use soroban_sdk::{symbol_short, Env};

/// Emits `("INTENT", "CREATED")` with the intent id as data.
pub fn intent_created(env: &Env, id: u64) {
    env.events()
        .publish((symbol_short!("INTENT"), symbol_short!("CREATED")), id);
}

/// Emits `("INTENT", "FILLED", id)` with the achieved gross output as data.
pub fn intent_filled(env: &Env, id: u64, gross_output: i128) {
    env.events().publish(
        (symbol_short!("INTENT"), symbol_short!("FILLED"), id),
        gross_output,
    );
}

/// Emits `("INTENT", "CANCELD")` with the intent id as data.
pub fn intent_cancelled(env: &Env, id: u64) {
    env.events()
        .publish((symbol_short!("INTENT"), symbol_short!("CANCELD")), id);
}

/// Emits `("INTENT", "EXPIRD")` with the intent id as data.
pub fn intent_expired(env: &Env, id: u64) {
    env.events()
        .publish((symbol_short!("INTENT"), symbol_short!("EXPIRD")), id);
}
