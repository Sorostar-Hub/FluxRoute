#!/usr/bin/env bash
#
# Deploy the FluxRoute contracts (IntentRegistry + SolverSettlement) to the
# Stellar testnet, initialize them, and write the resulting contract IDs to
# both .env (git-ignored) and public/testnet.contracts.json (committed).
#
# Prerequisites:
#   - stellar-cli v26+ on PATH (https://developers.stellar.org/docs/build/)
#   - rust toolchain with the wasm32-unknown-unknown target
#   - TESTNET_SECRET_KEY env var holding an S... secret key funded on testnet
#     (fund via https://stellar.expert/explorer/testnet/faucet)
#
# Usage:
#   TESTNET_SECRET_KEY=S... ./scripts/deploy-contracts.sh
#
set -euo pipefail

# Resolve the repo root from the script location so the script works from any CWD.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS_DIR="${REPO_ROOT}/contracts"
WASM_DIR="${CONTRACTS_DIR}/target/wasm32-unknown-unknown/release"

# ---------------------------------------------------------------------------
# Configuration / environment
# ---------------------------------------------------------------------------
NETWORK="testnet"
RPC_URL="${STELLAR_RPC_URL:-https://soroban-testnet.stellar.org}"
NETWORK_PASSPHRASE="Test SDF Network ; September 2015"

if [[ -z "${TESTNET_SECRET_KEY:-}" ]] && [[ -z "${STELLAR_IDENTITY:-}" ]]; then
  echo "ERROR: Set either TESTNET_SECRET_KEY or STELLAR_IDENTITY env var." >&2
  echo "       Fund a testnet account at https://stellar.expert/explorer/testnet/faucet" >&2
  echo "       then re-run: TESTNET_SECRET_KEY=S... $0" >&2
  echo "       or:         STELLAR_IDENTITY=my-key $0" >&2
  exit 1
fi

if [[ -n "${STELLAR_IDENTITY:-}" ]]; then
  SOURCE_ARG="--source-account ${STELLAR_IDENTITY}"
else
  SOURCE_ARG="--source-account ${TESTNET_SECRET_KEY}"
fi
NETWORK_ARG="--network ${NETWORK} --network-passphrase '${NETWORK_PASSPHRASE}' --rpc-url ${RPC_URL}"

# ---------------------------------------------------------------------------
# 1. Build the contract WASM files (idempotent; Cargo skips if up to date)
# ---------------------------------------------------------------------------
echo "==> Building contract WASM..."
cargo build \
  --manifest-path "${CONTRACTS_DIR}/Cargo.toml" \
  --target wasm32-unknown-unknown \
  --release

INTENT_WASM="${WASM_DIR}/intent_registry.wasm"
SOLVER_WASM="${WASM_DIR}/solver_settlement.wasm"

for wasm in "${INTENT_WASM}" "${SOLVER_WASM}"; do
  if [[ ! -f "${wasm}" ]]; then
    echo "ERROR: expected WASM not found at ${wasm}" >&2
    exit 1
  fi
done

# ---------------------------------------------------------------------------
# 2. Deploy IntentRegistry
# ---------------------------------------------------------------------------
echo "==> Deploying IntentRegistry..."
INTENT_REGISTRY_ID="$(stellar contract deploy \
  ${SOURCE_ARG} \
  --wasm "${INTENT_WASM}" \
  --ignore-checks \
  --network "${NETWORK}" \
  --rpc-url "${RPC_URL}" \
  --network-passphrase "${NETWORK_PASSPHRASE}" \
  | tr -d '[:space:]')"
echo "    IntentRegistry: ${INTENT_REGISTRY_ID}"

# ---------------------------------------------------------------------------
# 3. Deploy SolverSettlement
#
#    Newer Rust toolchains emit WASM with the reference-types proposal, which
#    the Soroban VM on testnet does not yet support. `stellar contract optimize`
#    strips incompatible features so the WASM deploys cleanly.
# ---------------------------------------------------------------------------
echo "==> Optimizing SolverSettlement WASM (strips reference-types)..."
stellar contract optimize --wasm "${SOLVER_WASM}" 2>/dev/null || true
SOLVER_WASM_OPT="${SOLVER_WASM%.wasm}.optimized.wasm"
if [[ -f "${SOLVER_WASM_OPT}" ]]; then
  SOLVER_WASM="${SOLVER_WASM_OPT}"
fi

echo "==> Deploying SolverSettlement..."
SOLVER_SETTLEMENT_ID="$(stellar contract deploy \
  ${SOURCE_ARG} \
  --wasm "${SOLVER_WASM}" \
  --ignore-checks \
  --network "${NETWORK}" \
  --rpc-url "${RPC_URL}" \
  --network-passphrase "${NETWORK_PASSPHRASE}" \
  | tr -d '[:space:]')"
echo "    SolverSettlement: ${SOLVER_SETTLEMENT_ID}"

# ---------------------------------------------------------------------------
# 4. Initialize both contracts.
#    - IntentRegistry: initialize(admin = deployer)
#    - SolverSettlement: initialize(admin, registry, feeRecipient = admin)
#    The deployer's G... address is derived from the secret key so the same
#    identity serves as admin and initial fee recipient.
# ---------------------------------------------------------------------------
echo "==> Deriving deployer address..."
if [[ -n "${STELLAR_IDENTITY:-}" ]]; then
  ADMIN_ADDRESS="$(stellar keys address "${STELLAR_IDENTITY}" 2>/dev/null || echo "")"
else
  ADMIN_ADDRESS="$(python3 - <<PY 2>/dev/null || echo ""
from stellar_sdk import Keypair
import os
print(Keypair.from_secret(os.environ["TESTNET_SECRET_KEY"]).public_key)
PY
)"
fi

echo "    Admin / fee recipient: ${ADMIN_ADDRESS}"

echo "==> Initializing IntentRegistry..."
stellar contract invoke \
  ${SOURCE_ARG} \
  --id "${INTENT_REGISTRY_ID}" \
  --network "${NETWORK}" \
  --rpc-url "${RPC_URL}" \
  --network-passphrase "${NETWORK_PASSPHRASE}" \
  -- initialize --admin "${ADMIN_ADDRESS}"

echo "==> Initializing SolverSettlement..."
stellar contract invoke \
  ${SOURCE_ARG} \
  --id "${SOLVER_SETTLEMENT_ID}" \
  --network "${NETWORK}" \
  --rpc-url "${RPC_URL}" \
  --network-passphrase "${NETWORK_PASSPHRASE}" \
  -- initialize \
    --admin "${ADMIN_ADDRESS}" \
    --registry "${INTENT_REGISTRY_ID}" \
    --fee_recipient "${ADMIN_ADDRESS}"

# ---------------------------------------------------------------------------
# 5. Smoke test: total_intents should return 0 on a fresh registry.
# ---------------------------------------------------------------------------
echo "==> Smoke test: total_intents..."
TOTAL="$(stellar contract invoke \
  ${SOURCE_ARG} \
  --id "${INTENT_REGISTRY_ID}" \
  --network "${NETWORK}" \
  --rpc-url "${RPC_URL}" \
  --network-passphrase "${NETWORK_PASSPHRASE}" \
  -- total_intents | tr -d '[:space:]')"
echo "    total_intents = ${TOTAL}"
if [[ "${TOTAL}" != "0" ]]; then
  echo "WARN: expected total_intents=0, got ${TOTAL}" >&2
fi

# ---------------------------------------------------------------------------
# 6. Persist the contract IDs.
#    - .env (git-ignored) for local tooling
#    - public/testnet.contracts.json (committed) for the frontend
# ---------------------------------------------------------------------------
ENV_FILE="${REPO_ROOT}/.env"
CONTRACTS_JSON="${REPO_ROOT}/public/testnet.contracts.json"

echo "==> Writing ${ENV_FILE} (git-ignored)..."
update_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "${ENV_FILE}" 2>/dev/null; then
    sed -i.bak "s|^${key}=.*|${key}=${val}|" "${ENV_FILE}" && rm -f "${ENV_FILE}.bak"
  else
    printf '%s=%s\n' "${key}" "${val}" >> "${ENV_FILE}"
  fi
}
update_env "INTENT_REGISTRY_CONTRACT_ID" "${INTENT_REGISTRY_ID}"
update_env "SOLVER_SETTLEMENT_CONTRACT_ID" "${SOLVER_SETTLEMENT_ID}"
update_env "NEXT_PUBLIC_INTENT_REGISTRY_CONTRACT_ID" "${INTENT_REGISTRY_ID}"
update_env "NEXT_PUBLIC_SOLVER_SETTLEMENT_CONTRACT_ID" "${SOLVER_SETTLEMENT_ID}"
update_env "NEXT_PUBLIC_STELLAR_NETWORK" "testnet"
update_env "STELLAR_NETWORK" "testnet"
update_env "STELLAR_RPC_URL" "${RPC_URL}"

echo "==> Writing ${CONTRACTS_JSON} (committed)..."
mkdir -p "$(dirname "${CONTRACTS_JSON}")"
cat > "${CONTRACTS_JSON}" <<JSON
{
  "network": "testnet",
  "rpcUrl": "${RPC_URL}",
  "networkPassphrase": "${NETWORK_PASSPHRASE}",
  "contracts": {
    "IntentRegistry": "${INTENT_REGISTRY_ID}",
    "SolverSettlement": "${SOLVER_SETTLEMENT_ID}"
  },
  "admin": "${ADMIN_ADDRESS}",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSON

echo ""
echo "==> Deployment complete."
echo "    IntentRegistry:   https://stellar.expert/explorer/testnet/contract/${INTENT_REGISTRY_ID}"
echo "    SolverSettlement: https://stellar.expert/explorer/testnet/contract/${SOLVER_SETTLEMENT_ID}"
echo "    Contract IDs written to: ${CONTRACTS_JSON}"
