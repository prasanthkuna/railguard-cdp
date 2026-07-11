ALTER TABLE payment_intents DROP CONSTRAINT IF EXISTS payment_intents_status_check;

ALTER TABLE payment_intents
  ADD CONSTRAINT payment_intents_status_check
  CHECK (status IN ('prepared', 'executing', 'submitted', 'confirmed', 'reverted', 'unknown', 'executed', 'failed'));

ALTER TABLE payment_intents
  ADD COLUMN IF NOT EXISTS execution_id TEXT,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS payment_intents_execution_id_idx
  ON payment_intents (organization_id, execution_id)
  WHERE execution_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS audit_chain_heads (
  organization_id TEXT PRIMARY KEY REFERENCES organizations(id),
  head_event_id TEXT NOT NULL,
  head_event_hash TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
