/** Signer boundary — plan §3 P0 (LocalDev → KMS/HSM/MPC). */

export interface SignRequest {
  digest: string
  chainId: number
  metadata?: Record<string, unknown>
}

export interface SignResult {
  signature: string
  signerId: string
}

export interface WalletProviderAdapter {
  readonly provider: "privy" | "turnkey" | "safe" | "zerodev" | "local"
  getAddress(): Promise<string>
  sign(request: SignRequest): Promise<SignResult>
}
