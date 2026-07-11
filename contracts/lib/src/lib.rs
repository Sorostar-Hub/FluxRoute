//! FluxRoute shared contract library.
//!
//! Re-exports the shared types and the cross-contract interface so both
//! contracts depend on this crate for their common vocabulary.

#![no_std]
#![allow(dead_code)]

pub mod types;

pub use types::{
    Asset, Intent, IntentRegistryInterface, IntentStatus, RouteStep, SettlementResult,
    TTL_EXTEND_LEDGERS, TTL_THRESHOLD_LEDGERS,
};
