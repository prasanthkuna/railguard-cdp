import type { ExecutionAttemptStore } from "./executionAttemptStore"
import { submitPersistedCdpTransferCore } from "./cdpRecoveryScenario"
import { executeCdpTransfer } from "./providers"

let defaultExecutionAttemptStore: ExecutionAttemptStore | undefined

function resolveExecutionAttemptStore(store?: ExecutionAttemptStore): ExecutionAttemptStore {
  if (store) {
    return store
  }
  if (!defaultExecutionAttemptStore) {
    const { createDbExecutionAttemptStore } = require("./executionAttempts") as typeof import("./executionAttempts")
    defaultExecutionAttemptStore = createDbExecutionAttemptStore()
  }
  return defaultExecutionAttemptStore
}

export async function submitPersistedCdpTransfer(
  input: {
    organizationId: string
    paymentIntentId: string
    executionId: string
    recipientAddress: string
    amountBaseUnits: string
    chain: string
    idempotencyKey: string
  },
  store?: ExecutionAttemptStore,
) {
  return submitPersistedCdpTransferCore(input, {
    store: resolveExecutionAttemptStore(store),
    executeTransfer: executeCdpTransfer,
  })
}

export { submitPersistedCdpTransferCore } from "./cdpRecoveryScenario"
