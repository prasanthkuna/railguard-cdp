-- v4 §3 purchases / quotes, §17 fulfilments, §21 outbox, §7 budget scopes

CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  business_idempotency_key TEXT NOT NULL,
  merchant_id TEXT,
  status TEXT NOT NULL CHECK (status IN (
    'CREATED', 'QUOTED', 'APPROVED', 'PAID', 'FULFILLED', 'CLOSED'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, business_idempotency_key)
);

CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES purchases(id),
  version INTEGER NOT NULL,
  merchant TEXT NOT NULL,
  resource TEXT NOT NULL,
  method TEXT NOT NULL,
  request_body_hash TEXT NOT NULL,
  network TEXT NOT NULL,
  token TEXT NOT NULL,
  recipient TEXT NOT NULL,
  amount TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'SUPERSEDED', 'EXPIRED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (purchase_id, version)
);

CREATE TABLE IF NOT EXISTS fulfilments (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES purchases(id),
  merchant_id TEXT NOT NULL,
  fulfilment_id TEXT NOT NULL,
  payment_identifier TEXT NOT NULL,
  settlement_receipt TEXT,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
  result_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (merchant_id, fulfilment_id)
);

CREATE TABLE IF NOT EXISTS outbox_events (
  id TEXT PRIMARY KEY,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS outbox_events_unpublished_idx
  ON outbox_events (created_at)
  WHERE published_at IS NULL;

ALTER TABLE payment_intents
  ADD COLUMN IF NOT EXISTS purchase_id TEXT REFERENCES purchases(id);

ALTER TABLE x402_guard_budget_authorizations
  ADD COLUMN IF NOT EXISTS scope_type TEXT NOT NULL DEFAULT 'agent',
  ADD COLUMN IF NOT EXISTS scope_id TEXT;

UPDATE x402_guard_budget_authorizations
SET scope_id = agent_id
WHERE scope_id IS NULL;

CREATE TABLE IF NOT EXISTS settlement_observations (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  transaction_hash TEXT NOT NULL,
  block_number BIGINT,
  block_hash TEXT,
  receipt_status TEXT,
  observed_transfer_facts JSONB,
  confidence TEXT CHECK (confidence IS NULL OR confidence IN ('PROVISIONAL', 'SAFE', 'FINALIZED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (transaction_hash)
);
