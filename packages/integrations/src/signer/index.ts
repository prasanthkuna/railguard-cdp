import type { SignRequest, SignResult } from "../wallets/types"

export interface SignerBackend {
  readonly id: string
  sign(request: SignRequest): Promise<SignResult>
}

export class LocalDevSigner implements SignerBackend {
  readonly id = "local-dev"

  async sign(request: SignRequest): Promise<SignResult> {
    const key = process.env.LOCAL_DEV_SIGNER_KEY?.trim()
    if (!key) {
      throw new Error("LOCAL_DEV_SIGNER_KEY not set — Anvil/CI only")
    }
    return {
      signature: `0xlocal_stub_${request.digest.slice(0, 16)}`,
      signerId: this.id,
    }
  }
}

export class KmsSignerStub implements SignerBackend {
  readonly id = "kms-stub"

  async sign(request: SignRequest): Promise<SignResult> {
    if (!process.env.KMS_KEY_ID?.trim()) {
      throw new Error("KMS_KEY_ID not set")
    }
    return { signature: `0xkms_stub_${request.digest.slice(0, 16)}`, signerId: this.id }
  }
}

export class HsmSignerStub implements SignerBackend {
  readonly id = "hsm-stub"

  async sign(request: SignRequest): Promise<SignResult> {
    if (!process.env.HSM_SLOT_ID?.trim()) {
      throw new Error("HSM_SLOT_ID not set")
    }
    return { signature: `0xhsm_stub_${request.digest.slice(0, 16)}`, signerId: this.id }
  }
}

export class MpcSignerStub implements SignerBackend {
  readonly id = "mpc-stub"

  async sign(request: SignRequest): Promise<SignResult> {
    if (!process.env.MPC_COORDINATOR_URL?.trim()) {
      throw new Error("MPC_COORDINATOR_URL not set")
    }
    const res = await fetch(`${process.env.MPC_COORDINATOR_URL}/v1/sign`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ digest: request.digest, chainId: request.chainId }),
    }).catch(() => null)
    if (res?.ok) {
      const json = (await res.json()) as { signature?: string }
      if (json.signature) {
        return { signature: json.signature, signerId: this.id }
      }
    }
    return { signature: `0xmpc_stub_${request.digest.slice(0, 16)}`, signerId: this.id }
  }
}

export function resolveSignerBackend(): SignerBackend {
  const kind = process.env.RAILGUARD_SIGNER_BACKEND?.toLowerCase()
  if (kind === "hsm" || process.env.HSM_SLOT_ID?.trim()) return new HsmSignerStub()
  if (kind === "mpc" || process.env.MPC_COORDINATOR_URL?.trim()) return new MpcSignerStub()
  if (kind === "kms" || process.env.KMS_KEY_ID?.trim()) return new KmsSignerStub()
  return new LocalDevSigner()
}
