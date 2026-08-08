import {
  classifyBroadcastResult,
  executionAttemptStatusAfterBroadcast,
  hashProviderResponse,
  shouldRecoverExecutionAttempt,
} from "./cdpExecutionDriver"
import type { ExecutionAttemptStore } from "./executionAttemptStore"
import type { CdpExecutionResult } from "./providers.types"

export type CdpTransferExecutor = (input: {
  organizationID: string
  recipientAddress: string
  amountBaseUnits: string
  chain: string
  paymentIntentId: string
  idempotencyKey: string
  providerIdempotencyKey: string
}) => Promise<CdpExecutionResult>

export async function submitPersistedCdpTransferCore(
  input: {
    organizationId: string
    paymentIntentId: string
    executionId: string
    recipientAddress: string
    amountBaseUnits: string
    chain: string
    idempotencyKey: string
  },
  deps: {
    store: ExecutionAttemptStore
    executeTransfer: CdpTransferExecutor
  },
): Promise<{
  attemptProviderKey: string
  execution: CdpExecutionResult
  broadcastResult: ReturnType<typeof classifyBroadcastResult>
}> {
  const attempt = await deps.store.getOrCreate({
    organizationId: input.organizationId,
    paymentIntentId: input.paymentIntentId,
    executionId: input.executionId,
    recipientAddress: input.recipientAddress,
    amountBaseUnits: input.amountBaseUnits,
    chain: input.chain,
  })

  if (!shouldRecoverExecutionAttempt(attempt) && attempt.status === "SUBMITTED" && attempt.txHash) {
    return {
      attemptProviderKey: attempt.providerIdempotencyKey,
      execution: {
        txHash: attempt.txHash,
        mode: "demo",
      },
      broadcastResult: "BROADCAST_CONFIRMED",
    }
  }

  let execution: CdpExecutionResult
  let dropResponse = false
  try {
    execution = await deps.executeTransfer({
      organizationID: input.organizationId,
      recipientAddress: input.recipientAddress,
      amountBaseUnits: input.amountBaseUnits,
      chain: input.chain,
      paymentIntentId: input.paymentIntentId,
      idempotencyKey: input.idempotencyKey,
      providerIdempotencyKey: attempt.providerIdempotencyKey,
    })
  } catch (error) {
    if (error instanceof Error && error.message === "CDP_RESPONSE_DROPPED") {
      dropResponse = true
      execution = { txHash: "", mode: "demo" }
    } else {
      await deps.store.updateAfterBroadcast({
        organizationId: input.organizationId,
        executionId: input.executionId,
        status: "REJECTED_BEFORE_BROADCAST",
        responseJson: {
          error: error instanceof Error ? error.message : String(error),
        },
        responseHash: hashProviderResponse({
          error: error instanceof Error ? error.message : String(error),
        }),
      })
      throw error
    }
  }

  const broadcastResult = classifyBroadcastResult({
    txHash: execution.txHash || undefined,
    dropResponse,
  })
  const attemptStatus = executionAttemptStatusAfterBroadcast(broadcastResult)
  const responsePayload = {
    txHash: execution.txHash,
    mode: execution.mode,
    accountAddress: execution.accountAddress,
  }

  await deps.store.updateAfterBroadcast({
    organizationId: input.organizationId,
    executionId: input.executionId,
    status: attemptStatus,
    txHash: execution.txHash || undefined,
    providerOperationId: execution.txHash || undefined,
    responseJson: responsePayload,
    responseHash: hashProviderResponse(responsePayload),
  })

  if (broadcastResult === "BROADCAST_UNKNOWN") {
    throw new Error("CDP_RESPONSE_DROPPED")
  }

  return {
    attemptProviderKey: attempt.providerIdempotencyKey,
    execution,
    broadcastResult,
  }
}
