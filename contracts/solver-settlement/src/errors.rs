//! Error types for the SolverSettlement contract.

use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum SettlementError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    NotAdmin = 3,
    UnregisteredSolver = 4,
    EmptyRoute = 5,
    SlippageExceeded = 6,
    IntentExpired = 7,
    IntentNotOpen = 8,
    InvalidAmount = 9,
    ZeroAddress = 10,
}
