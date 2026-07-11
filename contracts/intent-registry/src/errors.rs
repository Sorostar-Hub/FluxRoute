//! Error types for the IntentRegistry contract.

use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum IntentRegistryError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    NotAdmin = 3,
    NotSender = 4,
    IntentNotFound = 5,
    InvalidDeadline = 6,
    InvalidAmount = 7,
    SameAsset = 8,
    IntentNotOpen = 9,
    IntentExpired = 10,
    SameSenderRecipient = 11,
}
