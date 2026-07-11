//! Token-transfer logic for the SolverSettlement contract.
//!
//! The settlement contract acts as an atomic escrow for the output leg:
//!   1. the solver deposits the gross output into the contract,
//!   2. the contract pays the net output to the recipient,
//!   3. the contract pays the fee to the configured fee recipient,
//!   4. the sender's input asset is released to the solver.
//!
//! Because Soroban transactions are atomic, if any step panics (e.g.
//! insufficient allowance/balance) all prior state changes — including the
//! `mark_filled` call made by `execute_settlement` before this function — are
//! reverted.

use soroban_sdk::{token::Client as TokenClient, Address, Env};

use fluxroute_lib::Intent;

/// Execute the four token movements that settle an intent. Returns nothing on
/// success; panics (reverting the transaction) on any token failure.
#[allow(clippy::too_many_arguments)]
pub fn execute_transfers(
    env: &Env,
    intent: &Intent,
    solver: &Address,
    gross_output: i128,
    net_output: i128,
    fee: i128,
    input_token: &Address,
    output_token: &Address,
    fee_recipient: &Address,
) {
    let contract = env.current_contract_address();
    let input_client = TokenClient::new(env, input_token);
    let output_client = TokenClient::new(env, output_token);

    // 1. Solver deposits the gross output into the settlement contract.
    output_client.transfer_from(&contract, solver, &contract, &gross_output);

    // 2. Contract pays the recipient the net output.
    output_client.transfer(&contract, &intent.recipient, &net_output);

    // 3. Contract pays the fee (solver compensation / protocol cut).
    if fee > 0 {
        output_client.transfer(&contract, fee_recipient, &fee);
    }

    // 4. Sender's input asset is released to the solver.
    input_client.transfer_from(&contract, &intent.sender, solver, &intent.input_amount);
}
