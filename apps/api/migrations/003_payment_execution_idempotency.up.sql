ALTER TABLE payment_intents ADD COLUMN execution_idempotency_key TEXT;

CREATE UNIQUE INDEX payment_intents_execution_idempotency_idx
  ON payment_intents (organization_id, execution_idempotency_key)
  WHERE execution_idempotency_key IS NOT NULL;
