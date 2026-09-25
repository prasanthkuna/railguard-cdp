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

export function resolveSignerBackend(): SignerBackend {
  if (process.env.KMS_KEY_ID?.trim()) return new KmsSignerStub()
  return new LocalDevSigner()
}
