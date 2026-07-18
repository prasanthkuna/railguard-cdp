.PHONY: setup test failure-lab e2e

setup:
	cd ../x402-guard && npm install && npm run build
	bun install

test:
	bun test apps/api/payment-state.test.ts apps/api/payment-lifecycle.test.ts apps/api/reconcile.test.ts apps/api/execution-claim.test.ts packages/settlement/src/index.test.ts packages/policy/src/index.test.ts packages/cdp/src/index.test.ts

failure-lab: test

e2e:
	bun run verify:demo
