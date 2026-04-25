CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  workos_organization_id TEXT UNIQUE,
  approval_threshold_base_units TEXT NOT NULL DEFAULT '5000000000',
  hard_cap_base_units TEXT NOT NULL DEFAULT '100000000000',
  allowed_token TEXT NOT NULL DEFAULT 'usdc',
  allowed_chain TEXT NOT NULL DEFAULT 'base-sepolia',
  amount_review_multiplier DOUBLE PRECISION NOT NULL DEFAULT 3.0,
  wallet_risk_threshold INTEGER NOT NULL DEFAULT 80 CHECK (wallet_risk_threshold >= 0 AND wallet_risk_threshold <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO organizations (id, name)
SELECT organization_id, 'Workspace ' || right(organization_id, 6)
FROM (
  SELECT organization_id FROM vendors
  UNION
  SELECT organization_id FROM invoices
  UNION
  SELECT organization_id FROM policy_runs
  UNION
  SELECT organization_id FROM approvals
  UNION
  SELECT organization_id FROM payment_intents
  UNION
  SELECT organization_id FROM audit_events
) AS orgs
ON CONFLICT (id) DO NOTHING;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  email TEXT NOT NULL,
  workos_user_id TEXT UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'finance', 'approver', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_org_email_idx ON users(organization_id, lower(email));

CREATE TABLE invoice_uploads (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  invoice_id TEXT REFERENCES invoices(id),
  object_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  sha256_hash TEXT NOT NULL,
  scan_status TEXT NOT NULL CHECK (scan_status IN ('pending', 'clean', 'rejected')),
  extraction_status TEXT NOT NULL CHECK (extraction_status IN ('queued', 'processing', 'completed', 'failed')),
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX invoice_uploads_org_created_idx ON invoice_uploads (organization_id, created_at DESC);
CREATE INDEX invoice_uploads_invoice_idx ON invoice_uploads (invoice_id);

CREATE TABLE audit_exports (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  format TEXT NOT NULL CHECK (format IN ('csv', 'pdf')),
  object_key TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  requested_by TEXT NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX audit_exports_org_created_idx ON audit_exports (organization_id, created_at DESC);

ALTER TABLE invoices ADD COLUMN vendor_name_raw TEXT;
ALTER TABLE invoices ADD COLUMN amount_decimal NUMERIC(38, 6);
ALTER TABLE invoices ADD COLUMN invoice_date DATE;
ALTER TABLE invoices ADD COLUMN due_date DATE;
ALTER TABLE invoices ADD COLUMN payment_memo TEXT;
ALTER TABLE invoices ADD COLUMN line_item_summary TEXT;
ALTER TABLE invoices ADD COLUMN wallet_confidence DOUBLE PRECISION;
ALTER TABLE invoices ADD COLUMN extraction_model TEXT;
ALTER TABLE invoices ADD COLUMN extraction_json JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE invoices
SET amount_decimal = (amount_base_units::numeric / 1000000.0)
WHERE amount_decimal IS NULL;

ALTER TABLE invoices ALTER COLUMN amount_decimal SET NOT NULL;

ALTER TABLE payment_intents ADD COLUMN failure_reason TEXT;
ALTER TABLE payment_intents ADD COLUMN executed_at TIMESTAMPTZ;
