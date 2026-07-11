-- FluxRoute indexer schema migrations.
--
-- Creates the tables for intents, settlements, and solver statistics. Run
-- this against the indexer's PostgreSQL database before starting the indexer:
--   psql "$DATABASE_URL" -f packages/indexer/src/schema/migrations.sql

CREATE TABLE IF NOT EXISTS intents (
  id              BIGINT PRIMARY KEY,
  sender          TEXT NOT NULL,
  recipient       TEXT NOT NULL,
  input_asset     JSONB NOT NULL,
  output_asset    JSONB NOT NULL,
  input_amount    NUMERIC NOT NULL,
  min_output_amount NUMERIC NOT NULL,
  deadline        BIGINT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'Open',
  filled_by       TEXT,
  solver_fee_bps  INTEGER NOT NULL DEFAULT 0,
  created_at_ledger BIGINT NOT NULL,
  created_tx_hash  TEXT,
  filled_tx_hash   TEXT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settlements (
  id              BIGSERIAL PRIMARY KEY,
  intent_id       BIGINT NOT NULL REFERENCES intents(id),
  solver          TEXT NOT NULL,
  gross_output    NUMERIC NOT NULL,
  solver_fee      NUMERIC NOT NULL,
  net_output      NUMERIC NOT NULL,
  ledger          BIGINT NOT NULL,
  tx_hash         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS solvers (
  address             TEXT PRIMARY KEY,
  intents_filled_total INTEGER NOT NULL DEFAULT 0,
  success_rate         REAL NOT NULL DEFAULT 1.0,
  is_online            BOOLEAN NOT NULL DEFAULT true,
  last_seen_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Event idempotency: track which ledger sequences have been processed so a
-- restart does not re-ingest already-handled events.
CREATE TABLE IF NOT EXISTS processed_ledgers (
  ledger          BIGINT PRIMARY KEY,
  contract_id     TEXT NOT NULL,
  processed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common query patterns.
CREATE INDEX IF NOT EXISTS idx_intents_sender ON intents(sender);
CREATE INDEX IF NOT EXISTS idx_intents_status ON intents(status);
CREATE INDEX IF NOT EXISTS idx_intents_created_ledger ON intents(created_at_ledger);
CREATE INDEX IF NOT EXISTS idx_settlements_intent ON settlements(intent_id);
CREATE INDEX IF NOT EXISTS idx_settlements_solver ON settlements(solver);
