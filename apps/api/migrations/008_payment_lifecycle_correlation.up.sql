ALTER TABLE payment_intents DROP CONSTRAINT IF EXISTS payment_intents_status_check;

ALTER TABLE payment_intents
  ADD CONSTRAINT payment_intents_status_check
  CHECK (status IN (
    'prepared',
    'executing',
    'submitted',
    'confirmed',
    'reverted',
    'unknown',
    'reconciliation_required',
    'executed',
    'failed'
  ));

ALTER TABLE payment_intents
  ADD COLUMN IF NOT EXISTS payment_identifier TEXT,
  ADD COLUMN IF NOT EXISTS guard_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS guard_authorization_id TEXT,
  ADD COLUMN IF NOT EXISTS guard_receipt_id TEXT,
  ADD COLUMN IF NOT EXISTS guard_status TEXT
    CHECK (guard_status IS NULL OR guard_status IN ('reserved', 'committed', 'released', 'frozen')),
  ADD COLUMN IF NOT EXISTS expected_chain_id TEXT,
  ADD COLUMN IF NOT EXISTS expected_token TEXT,
  ADD COLUMN IF NOT EXISTS expected_sender TEXT,
  ADD COLUMN IF NOT EXISTS expected_recipient TEXT,
  ADD COLUMN IF NOT EXISTS expected_amount TEXT,
  ADD COLUMN IF NOT EXISTS settlement_status TEXT
    CHECK (settlement_status IS NULL OR settlement_status IN (
      'pending',
      'confirmed',
      'reverted',
      'reconciliation_required'
    )),
  ADD COLUMN IF NOT EXISTS reconciliation_attempts INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS payment_intents_reconcile_idx
  ON payment_intents (status, tx_hash)
  WHERE status IN ('submitted', 'unknown', 'reconciliation_required') AND tx_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS payment_intents_guard_auth_idx
  ON payment_intents (guard_authorization_id)
  WHERE guard_authorization_id IS NOT NULL;
