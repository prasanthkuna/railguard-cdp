CREATE TABLE IF NOT EXISTS x402_guard_budget_authorizations (
  authorization_id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  amount_atomic NUMERIC(78, 0) NOT NULL CHECK (amount_atomic > 0),
  status TEXT NOT NULL CHECK (status IN ('reserved', 'committed', 'released')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS x402_guard_budget_authorizations_agent_status_created_idx
  ON x402_guard_budget_authorizations (agent_id, status, created_at DESC);

ALTER TABLE approvals
  ADD COLUMN IF NOT EXISTS policy_snapshot_hash TEXT;

CREATE INDEX IF NOT EXISTS approvals_policy_snapshot_idx
  ON approvals (organization_id, invoice_id, policy_snapshot_hash);
