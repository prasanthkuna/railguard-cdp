.PHONY: setup test failure-lab e2e

setup:
	cd vendor/x402-guard/packages/core && npm run build || true
	bun install

test:
	bun test apps/api/payment-state.test.ts apps/api/payment-lifecycle.test.ts apps/api/cdpExecutionDriver.test.ts apps/api/cdpExecutionSubmit.test.ts apps/api/reconcile.test.ts apps/api/execution-claim.test.ts packages/kernel/src/kernel.test.ts packages/settlement/src/index.test.ts packages/policy/src/index.test.ts packages/cdp/src/index.test.ts packages/cdp/src/cdpRequest.test.ts

failure-lab: test

e2e:
	bun run verify:demo
