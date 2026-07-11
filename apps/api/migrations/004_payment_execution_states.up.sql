ALTER TABLE payment_intents DROP CONSTRAINT IF EXISTS payment_intents_status_check;

ALTER TABLE payment_intents
  ADD CONSTRAINT payment_intents_status_check
  CHECK (status IN ('prepared', 'executing', 'submitted', 'unknown', 'executed', 'failed'));
