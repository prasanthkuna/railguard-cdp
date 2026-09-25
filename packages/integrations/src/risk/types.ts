/** External risk signals — plan §16 (Blockaid, Hypernative, GoPlus, CRE). */

export type RiskSignalLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "UNKNOWN"

export interface RiskSignalInput {
  chainId: number
  from?: string
  to: string
  amount: string
  calldata?: string
  txHash?: string
}

export interface RiskSignalResult {
  provider: string
  level: RiskSignalLevel
  labels: string[]
  raw?: Record<string, unknown>
}

export interface RiskSignalProvider {
  readonly name: string
  evaluate(input: RiskSignalInput): Promise<RiskSignalResult>
}
