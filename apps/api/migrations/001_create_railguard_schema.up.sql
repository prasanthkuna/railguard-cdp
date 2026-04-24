CREATE TABLE vendors (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'blocked')),
  risk_score INTEGER NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, lower(name))
);

CREATE TABLE vendor_wallets (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  vendor_id TEXT NOT NULL REFERENCES vendors(id),
  chain TEXT NOT NULL,
  address TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'blocked')),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  UNIQUE (organization_id, vendor_id, chain, lower(address))
);

CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  vendor_id TEXT NOT NULL REFERENCES vendors(id),
  invoice_number TEXT,
  invoice_hash TEXT NOT NULL,
  amount_base_units TEXT NOT NULL,
  token TEXT NOT NULL,
  chain TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  extraction_confidence DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('received', 'ready', 'needs_approval', 'blocked', 'approved', 'rejected', 'payment_intent_created', 'executed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX invoices_org_status_idx ON invoices(organization_id, status);
CREATE INDEX invoices_duplicate_idx ON invoices(organization_id, vendor_id, invoice_number, invoice_hash);

CREATE TABLE policy_runs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  result TEXT NOT NULL CHECK (result IN ('allow', 'block', 'escalate')),
  triggered_rules_json JSONB NOT NULL,
  evidence_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE approvals (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  required_role TEXT NOT NULL,
  approver_user_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX approvals_invoice_idx ON approvals(organization_id, invoice_id, created_at DESC);

CREATE TABLE payment_intents (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  chain TEXT NOT NULL,
  token_address TEXT NOT NULL,
  recipient_address TEXT NOT NULL,
  amount_base_units TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('prepared', 'executed', 'failed')),
  idempotency_key TEXT NOT NULL,
  tx_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, idempotency_key)
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_json JSONB NOT NULL,
  previous_hash TEXT,
  event_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_entity_idx ON audit_events(organization_id, entity_type, entity_id, created_at);
