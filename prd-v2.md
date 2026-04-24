# PRD v2 - Railguard

## 1. Product Name

**Railguard**

## 2. One-Liner

Pre-payment risk, approval, and audit layer for teams paying vendors in USDC.

## 3. Core Thesis

Stablecoin payments are fast, global, and irreversible. That is powerful for crypto-native teams, but dangerous when invoice intake, vendor verification, wallet changes, and approvals still happen across Slack, email, Telegram, spreadsheets, and multisigs.

Railguard makes onchain payments safer before money moves.

The product starts with invoice-to-USDC payment safety because this has a clear month-2 revenue path. The technical architecture is intentionally aligned with Coinbase Developer Platform, AgentKit, CDP Server Wallet v2, Base, and x402 so the project also demonstrates strong Coinbase hiring fit.

## 4. Target Customer

### Initial ICP

- Crypto startups paying vendors, contractors, or contributors in USDC
- DAOs with recurring contributor payouts
- Web3 agencies paying freelancers globally
- Small onchain infra teams using Base, Ethereum, Solana, multisigs, or Coinbase CDP

### Buyer

- Founder
- Ops lead
- Finance lead
- DAO treasurer
- Engineering founder handling payments manually

### Urgent Pain

- "Did we pay the right wallet?"
- "Did this invoice already get paid?"
- "Who approved this?"
- "Why did this payment go out?"
- "Can we prove what happened later?"

## 5. Positioning

### External Positioning

Railguard is the safety checklist and audit trail before stablecoin vendor payments.

### Coinbase-Aligned Positioning

Railguard is a business-policy control plane above Coinbase wallet execution. Coinbase CDP secures and executes wallet operations; Railguard verifies invoice, vendor, approval, and payment intent before execution.

### Hiring Signal

Railguard demonstrates:

- CDP Server Wallet v2 integration
- Base USDC payment preparation and execution
- AgentKit-compatible payment intent flow
- Deterministic policy engine
- Auditability and compliance-aware design
- Production backend thinking: idempotency, RBAC, tenant isolation, replay protection, observability

## 6. Why Now

Onchain payment rails are becoming easier through Coinbase CDP, Base, stablecoins, AgentKit, and x402. The next bottleneck is not just execution. It is trust before execution.

Teams need a reliable way to verify payment intent, vendor identity, wallet history, duplicate invoices, approval policy, and audit evidence before funds leave a wallet.

## 7. Product Strategy

### Revenue MVP

Railguard starts as pre-payment verification plus approvals and audit trail. Customers can use it even if final payment still happens through a multisig, exchange account, wallet app, or manual transfer.

This allows revenue in month 2.

### Coinbase Demo Layer

Railguard also includes a demo-grade CDP execution path:

- Prepare a Base Sepolia USDC payment intent
- Re-run policy evaluation against the exact payload
- Execute via CDP Server Wallet v2 only after approval
- Store transaction hash and audit event

This proves the product can become a wallet execution layer without making early customers change payment infrastructure immediately.

## 8. Success Criteria

### Business Success

- 3 pilot customers by end of month 1
- 1 paying customer by end of month 2
- At least 50 invoices processed across pilots
- At least 5 real risk events detected: duplicate invoice, wallet change, new vendor, amount spike, missing approval

### Product Success

- Upload invoice and extract structured fields under 30 seconds
- Block duplicate invoice with deterministic evidence
- Detect vendor wallet change before payment
- Generate exportable audit trail for every payment decision
- Prepare CDP-compatible payment intent after approval

### Hiring Success

- Public repo with professional README, architecture, API docs, threat model, and demo video
- Clean end-to-end demo showing allow, block, escalate, approve, and execute flows
- Clear explanation of how Railguard complements Coinbase CDP Policy Engine instead of duplicating it

## 9. v1 Scope

### Must Ship

- Organization workspace
- Invoice upload
- AI invoice extraction
- Vendor registry
- Wallet registry and wallet history
- Duplicate invoice detection
- Deterministic policy engine
- Approval workflow
- Payment intent builder
- Audit ledger
- CSV/PDF audit export
- Demo CDP Server Wallet v2 execution on Base Sepolia

### Should Ship

- Slack/email notification for approvals
- Manual vendor onboarding checklist
- Policy simulation before enabling a rule
- Basic risk dashboard

### Explicitly Not v1

- Full accounting sync
- Production custody replacement
- Tax reporting
- Multi-chain production execution
- Full DAO governance integration
- Autonomous x402 agent payments

## 10. Core User Flows

### Flow 1: Safe Existing Vendor Payment

1. User uploads invoice.
2. Railguard extracts vendor, amount, token, due date, invoice number, wallet address.
3. Vendor and wallet match historical records.
4. No duplicate invoice found.
5. Amount is below approval threshold.
6. Policy result is `allow`.
7. Payment intent is prepared.
8. Audit event is written.

### Flow 2: Wallet Changed

1. User uploads invoice.
2. Railguard detects that vendor wallet differs from prior approved wallet.
3. Policy result is `block`.
4. User sees prior wallet, new wallet, first seen date, and recommended verification steps.
5. Audit event is written.

### Flow 3: Duplicate Invoice

1. User uploads invoice.
2. Railguard computes invoice fingerprint.
3. Invoice number, vendor, amount, or document hash matches previous paid invoice.
4. Policy result is `block`.
5. User sees matching historical payment.

### Flow 4: Large Amount Escalation

1. User uploads invoice.
2. Amount is over threshold or 3x vendor average.
3. Policy result is `escalate`.
4. Required approver is notified.
5. Payment intent cannot execute until approval is captured.

### Flow 5: CDP Demo Execution

1. Invoice passes policy and approval.
2. Railguard builds exact transaction payload.
3. Railguard re-runs policy against the final payload.
4. CDP Server Wallet v2 executes on Base Sepolia.
5. Transaction hash is stored in audit log.

## 11. Policy Engine

### Principles

- LLMs can extract and summarize.
- LLMs cannot approve, block, or execute payments.
- Every payment decision must be deterministic and explainable.
- Every decision must produce evidence for audit.

### Policy Results

- `allow`: Payment can be prepared or executed.
- `block`: Payment cannot proceed until issue is resolved.
- `escalate`: Payment needs human approval.

### v1 Policies

#### Vendor Policies

- New vendor requires onboarding approval.
- Vendor must have an approved wallet before payment.
- Vendor wallet change blocks payment.

#### Invoice Policies

- Duplicate invoice blocks payment.
- Missing invoice number escalates.
- Low extraction confidence escalates.
- Invoice currency must match allowed token.

#### Amount Policies

- Amount above workspace threshold escalates.
- Amount above vendor historical average by configured multiplier escalates.
- Amount above hard cap blocks payment.

#### Wallet Policies

- Wallet must be valid for target chain.
- Wallet must be in vendor wallet registry.
- Wallet risk score above threshold blocks payment.

#### Chain and Token Policies

- v1 supports USDC.
- Coinbase demo supports Base Sepolia.
- Production roadmap prioritizes Base USDC, then Ethereum/Solana.

## 12. AI Extraction

### Extracted Fields

- Vendor name
- Invoice number
- Invoice date
- Due date
- Amount
- Currency/token
- Wallet address
- Chain/network if present
- Line item summary
- Payment memo/reference

### Confidence Rules

- Field confidence below 80% escalates.
- Wallet address extraction below 95% escalates.
- Missing amount, vendor, or wallet blocks payment preparation.

### AI Boundary

AI extraction output is treated as untrusted input. Railguard validates extracted fields through deterministic checks before any payment intent is created.

## 13. Payment Execution Boundary

Railguard has two operating modes.

### Verification Mode

Railguard evaluates invoices, vendors, wallets, approvals, and audit trails. The user executes payment outside Railguard.

This is the initial revenue mode.

### Execution Mode

Railguard executes only after:

- Invoice extraction is complete.
- Required fields are validated.
- Vendor wallet is approved.
- Duplicate checks pass.
- Policy result is `allow`.
- Required approvals are captured.
- Final payload is re-evaluated.

v1 execution mode is demo-first using CDP Server Wallet v2 on Base Sepolia.

## 14. Coinbase Integration

### CDP Server Wallet v2

Used for demo wallet account creation, transaction preparation, signing, and sending.

### AgentKit

Used to demonstrate how an AI agent can prepare a payment request while Railguard enforces deterministic controls before execution.

### CDP Policy Engine

Railguard does not replace CDP Policy Engine.

Railguard handles business-level policies:

- Vendor approval
- Invoice duplicate detection
- Wallet history
- Approval workflow
- Audit evidence

CDP Policy Engine handles wallet-level enforcement:

- Destination allowlists
- Transaction limits
- Network restrictions
- Token contract restrictions

### x402 Roadmap

After invoice payments, the same policy engine can protect autonomous agent payments over x402:

- Session budgets
- Merchant allowlists
- Duplicate replay checks
- Metadata PII filtering
- Agent payment audit trail

## 15. Data Model

### organizations

- id
- name
- workos_organization_id
- created_at

### users

- id
- organization_id
- email
- workos_user_id
- role
- created_at

### vendors

- id
- organization_id
- name
- status
- risk_score
- created_at

### vendor_wallets

- id
- vendor_id
- chain
- address
- status
- first_seen_at
- approved_at
- approved_by

### invoices

- id
- organization_id
- vendor_id
- invoice_number
- invoice_hash
- amount_decimal
- amount_base_units
- token
- chain
- wallet_address
- extraction_confidence
- status
- created_at

### policy_runs

- id
- organization_id
- invoice_id
- result
- triggered_rules_json
- evidence_json
- created_at

### approvals

- id
- organization_id
- invoice_id
- required_role
- approver_user_id
- decision
- reason
- created_at

### payment_intents

- id
- organization_id
- invoice_id
- chain
- token_address
- recipient_address
- amount_base_units
- payload_json
- status
- idempotency_key
- tx_hash
- created_at

### audit_events

- id
- organization_id
- entity_type
- entity_id
- actor_type
- actor_id
- event_type
- event_json
- previous_hash
- event_hash
- created_at

## 16. API Surface

### POST /api/invoices/upload

Upload invoice and start extraction.

### GET /api/invoices

List invoices by status.

### GET /api/invoices/:id

Get invoice detail, extraction result, policy result, approvals, and audit events.

### POST /api/vendors

Create or onboard vendor.

### POST /api/vendors/:id/wallets

Add wallet to vendor registry.

### POST /api/policy/evaluate

Evaluate invoice, vendor, wallet, amount, and workspace rules.

### POST /api/approvals/:invoice_id

Approve or reject escalated invoice.

### POST /api/payment-intents

Create payment intent after policy and approval checks.

### POST /api/payment-intents/:id/execute

Execute approved payment intent in CDP demo mode.

### GET /api/audit/:entity_type/:entity_id

Return audit trail.

## 17. Security Requirements

- Tenant isolation on every query.
- WorkOS-backed authentication with organization membership, invites, and session management.
- RBAC for owner, finance, approver, viewer.
- MFA-ready auth from day 1, with SSO and directory sync as expansion path for larger customers.
- Idempotency keys for payment intent creation and execution.
- Payment payload re-validation immediately before execution.
- No private key handling by Railguard.
- CDP secrets stored only in environment/secret manager.
- Audit events are append-only.
- Audit events are hash chained.
- File uploads are scanned and size limited.
- Webhook signatures verified where applicable.
- Sensitive invoice data is not sent to logs.

## 18. UX Screens

### Dashboard

```text
Railguard Dashboard

Invoices pending review: 12
Blocked: 3
Needs approval: 5
Ready to pay: 4
Total protected this month: 18,420 USDC
Risk events detected: 7
```

### Invoice Inbox

```text
Vendor       Amount      Status       Reason
Acme Dev     1,200 USDC  ESCALATE     Amount spike
Design Co      300 USDC  READY        All checks passed
Audit Inc    5,000 USDC  BLOCKED      Wallet changed
```

### Invoice Detail

```text
Invoice #INV-2231

Vendor: Acme Dev
Amount: 1,200 USDC
Wallet: 0xABC...
AI confidence: 92%

Policy result: ESCALATE
Reason: Amount is 3.1x vendor average

[Approve] [Reject] [Request vendor verification]
```

### Vendor Wallet History

```text
Vendor: Acme Dev

Approved wallet:
0xOLD... first seen Jan 12, 2026

New invoice wallet:
0xNEW... first seen today

Result: BLOCK
Recommended action: verify out-of-band before approving wallet change.
```

### Payment Intent

```text
Payment ready

Send: 1,200 USDC
Network: Base Sepolia
Recipient: 0xABC...

Pre-execution policy check: PASSED

[Execute via CDP Demo Wallet]
```

### Audit Trail

```text
Invoice uploaded
AI extraction completed
Policy evaluated: ESCALATE
Approved by finance owner
Payment intent created
Pre-execution policy check passed
Transaction sent
Tx hash: 0xHASH
```

## 19. Monetization

### Month-2 Offer

Concierge-backed SaaS for crypto teams:

- Vendor wallet registry
- Invoice risk checks
- Duplicate detection
- Approval capture
- Audit export
- Optional payment preparation

### Pricing

- Starter: $199/month for up to 50 invoices
- Pro: $499/month for up to 250 invoices
- Setup: $500-$2,000 for vendor import and policy setup

### Manual Services Allowed

In month 1 and month 2, some verification can be manual behind the scenes. The product must still capture structured data and audit events so manual work gradually becomes software.

## 20. GTM Plan

### Week 1

- Build landing page.
- Publish demo video.
- Create sample audit report.
- DM 50 crypto founders, DAO operators, agency owners, and Web3 finance leads.

### Week 2

- Run 5 discovery calls.
- Offer free risk review of last 10 vendor payments.
- Onboard 2 pilot teams.

### Week 3

- Process real invoices in verification mode.
- Capture risk events and testimonials.
- Improve policies based on real workflow.

### Week 4

- Convert first pilot to paid.
- Publish case study without sensitive customer data.
- Ship CDP demo execution flow for Coinbase-facing portfolio.

## 21. Demo Script For Coinbase

1. Upload invoice for known vendor.
2. Show AI extraction output.
3. Show deterministic policy result.
4. Upload duplicate invoice and show block.
5. Upload wallet-changed invoice and show block.
6. Upload large invoice and show escalation.
7. Approve escalated invoice.
8. Prepare Base Sepolia USDC payment intent.
9. Re-run pre-execution policy check.
10. Execute via CDP Server Wallet v2 demo account.
11. Show transaction hash and hash-chained audit trail.

## 22. Architecture

```text
[Invoice Upload / Email Forward]
          |
          v
[AI Extraction Service]
          |
          v
[Validation + Normalization]
          |
          v
[Vendor + Wallet Registry]
          |
          v
[Deterministic Policy Engine]
          |
    +-----+-----+
    |     |     |
 BLOCK ESCALATE ALLOW
    |     |     |
    | [Approval Workflow]
    |     |
    +-----+-----+
          |
          v
[Payment Intent Builder]
          |
          v
[Pre-Execution Policy Check]
          |
          v
[CDP Server Wallet v2 Demo Execution]
          |
          v
[Audit Ledger]
```

## 23. Technical Stack

### Suggested Implementation

- Frontend: Next.js
- Backend: Encore.ts
- Runtime and package manager: Bun
- Database: Postgres
- Queue: Redis or managed queue
- Storage: S3-compatible object storage
- Authentication and organization identity: WorkOS AuthKit
- AI extraction: GPT or Gemini with structured output
- Onchain demo: CDP Server Wallet v2, Base Sepolia
- Observability: structured logs, request IDs, audit event IDs

### Stack Rationale

- Next.js handles the operator UI: inbox, approvals, vendors, audit trail, and settings.
- Encore.ts provides typed backend services, background jobs, and cleaner service boundaries for policy, approvals, and payments.
- Bun keeps local development, installs, and scripts fast while staying in a TypeScript-first stack.
- WorkOS fits the product shape better than Better Auth because Railguard is organization-centric and likely to need invites, MFA, and SSO readiness before it needs deep auth customization.
- Better Auth remains a valid fallback only if minimizing vendor spend is more important than enterprise auth features in v1.

### Repo Modules

```text
apps/web
apps/api
workers/extraction
workers/payments
packages/policy
packages/audit
packages/cdp
packages/auth
packages/db
docs
```

### Backend Service Boundaries

- `invoice`: upload, extraction kickoff, normalization, status transitions
- `vendor`: vendor registry, wallet registry, wallet history
- `policy`: deterministic rules, simulation, evidence generation
- `approval`: approval requests, approver actions, notification hooks
- `payment`: payment intent build, idempotency, pre-execution validation, CDP execution
- `audit`: append-only event ledger, hash chaining, export generation
- `auth`: WorkOS user sync, organization membership, session and role mapping

## 24. Key Risks

### Risk: Coinbase already has Policy Engine

Mitigation: Railguard owns business workflow policy. CDP Policy Engine owns wallet-level transaction enforcement.

### Risk: Customers are not ready for CDP execution

Mitigation: Start with verification mode. Execution mode is optional.

### Risk: AI extraction errors

Mitigation: Treat AI output as untrusted. Require confidence thresholds and deterministic validation.

### Risk: Hard to sell to DAOs

Mitigation: Start with small crypto startups and agencies where buyer is clear and payment ops pain is immediate.

### Risk: Product becomes too broad

Mitigation: v1 focuses only on vendor invoice payments in USDC.

## 25. Final 10x Framing

Railguard is not just an invoice app.

It is a policy and audit layer for money-moving agents and teams.

The first paid wedge is safe invoice-to-USDC vendor payments. The long-term platform is deterministic control for autonomous payments across CDP wallets, AgentKit agents, and x402 machine commerce.

## 26. Reference Links

- Coinbase Developer Platform: https://docs.cdp.coinbase.com/
- CDP Server Wallet v2: https://docs.cdp.coinbase.com/server-wallets/v2/introduction/welcome
- AgentKit: https://docs.cdp.coinbase.com/agent-kit
- CDP Policy Engine: https://docs.cdp.coinbase.com/api-reference/v2/rest-api/policy-engine/policy-engine
- x402: https://docs.cdp.coinbase.com/x402/welcome
