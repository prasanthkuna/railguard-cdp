CREATE TABLE IF NOT EXISTS financial_intents (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  payload_json JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'CREATED',
  idempotency_key TEXT NOT NULL,
  payment_intent_id TEXT REFERENCES payment_intents(id),
  authorization_grant_json JSONB,
  execution_id TEXT,
  evidence_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_financial_intents_org_status
  ON financial_intents (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_financial_intents_execution
  ON financial_intents (execution_id);
