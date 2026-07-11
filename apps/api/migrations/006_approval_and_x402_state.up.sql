ALTER TABLE approvals
  ADD COLUMN IF NOT EXISTS policy_run_id TEXT REFERENCES policy_runs(id);

CREATE INDEX IF NOT EXISTS approvals_policy_run_idx
  ON approvals (organization_id, invoice_id, policy_run_id);

CREATE TABLE IF NOT EXISTS x402_guard_replays (
  fingerprint TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS x402_guard_spends (
  id BIGSERIAL PRIMARY KEY,
  agent_id TEXT NOT NULL,
  amount_atomic NUMERIC(78, 0) NOT NULL CHECK (amount_atomic > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS x402_guard_spends_agent_created_idx
  ON x402_guard_spends (agent_id, created_at DESC);
