CREATE TABLE IF NOT EXISTS execution_attempts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  payment_intent_id TEXT NOT NULL,
  execution_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'cdp',
  provider_idempotency_key TEXT NOT NULL,
  canonical_request_json JSONB NOT NULL,
  request_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'SUBMITTING',
    'SUBMITTED',
    'UNKNOWN',
    'REJECTED_BEFORE_BROADCAST'
  )),
  tx_hash TEXT,
  provider_operation_id TEXT,
  response_json JSONB,
  response_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS execution_attempts_execution_id_idx
  ON execution_attempts (execution_id);

CREATE UNIQUE INDEX IF NOT EXISTS execution_attempts_provider_idempotency_idx
  ON execution_attempts (provider, provider_idempotency_key);

CREATE INDEX IF NOT EXISTS execution_attempts_payment_intent_idx
  ON execution_attempts (organization_id, payment_intent_id);
