//! Validation helpers for the SolverSettlement contract.

use fluxroute_lib::{Intent, IntentStatus};

use crate::errors::SettlementError;

/// Compute the solver fee taken from the gross output.
///
/// `fee = gross_output * fee_bps / 10_000`. Uses checked multiplication so an
/// overflow returns the maximum representable fee rather than panicking.
pub fn compute_fee(gross_output: i128, fee_bps: u32) -> i128 {
    let bps = i128::from(fee_bps);
    let product = gross_output.checked_mul(bps).unwrap_or(i128::MAX);
    product / 10_000
}

/// Validate that an intent is fillable right now.
pub fn validate_intent_for_fill(
    intent: &Intent,
    current_ledger: u64,
) -> Result<(), SettlementError> {
    if intent.status != IntentStatus::Open && intent.status != IntentStatus::Pending {
        return Err(SettlementError::IntentNotOpen);
    }
    if current_ledger > intent.deadline {
        return Err(SettlementError::IntentExpired);
    }
    Ok(())
}

/// Enforce the slippage floor: the gross output must meet or exceed the
/// recipient's minimum.
pub fn check_slippage(gross_output: i128, min_output_amount: i128) -> Result<(), SettlementError> {
    if gross_output < min_output_amount {
        return Err(SettlementError::SlippageExceeded);
    }
    Ok(())
}
