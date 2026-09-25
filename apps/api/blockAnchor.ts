import type { Hash } from "viem"
import { createPublicClientForEvmChain } from "../../packages/settlement/src/evm-chain"
import { readBlockAnchorForTx } from "../../packages/settlement/src/reorg"
import { db } from "./db"

export async function attachBlockAnchorForPaymentIntent(input: {
  organizationId: string
  paymentIntentId: string
  txHash: string
  chain: string
}): Promise<void> {
  const client = await createPublicClientForEvmChain(input.chain)
  const anchor = await readBlockAnchorForTx(client, input.txHash as Hash)
  if (!anchor) return

  await db.exec`
    UPDATE execution_attempts
    SET block_number = ${anchor.blockNumber},
        block_hash = ${anchor.blockHash}
    WHERE organization_id = ${input.organizationId}
      AND payment_intent_id = ${input.paymentIntentId}
      AND tx_hash = ${input.txHash}
  `
}
