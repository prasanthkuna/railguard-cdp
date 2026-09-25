import { describe, expect, test } from "bun:test"
import {
  HsmSignerStub,
  KmsSignerStub,
  LocalDevSigner,
  MpcSignerStub,
  resolveSignerBackend,
} from "./index"

describe("signer backends", () => {
  test("local dev requires key", async () => {
    const prev = process.env.LOCAL_DEV_SIGNER_KEY
    Reflect.deleteProperty(process.env, "LOCAL_DEV_SIGNER_KEY")
    const signer = new LocalDevSigner()
    await expect(signer.sign({ digest: "0xabc", chainId: 84532 })).rejects.toThrow()
    if (prev) process.env.LOCAL_DEV_SIGNER_KEY = prev
  })

  test("kms/hsm stubs sign when configured", async () => {
    process.env.KMS_KEY_ID = "test-key"
    const kms = new KmsSignerStub()
    const r = await kms.sign({ digest: "0xdeadbeef", chainId: 1 })
    expect(r.signerId).toBe("kms-stub")
    Reflect.deleteProperty(process.env, "KMS_KEY_ID")

    process.env.HSM_SLOT_ID = "slot-1"
    const hsm = new HsmSignerStub()
    const h = await hsm.sign({ digest: "0xdeadbeef", chainId: 1 })
    expect(h.signerId).toBe("hsm-stub")
    Reflect.deleteProperty(process.env, "HSM_SLOT_ID")
  })

  test("resolveSignerBackend prefers mpc when URL set", () => {
    const prev = process.env.MPC_COORDINATOR_URL
    process.env.MPC_COORDINATOR_URL = "http://localhost:9999"
    expect(resolveSignerBackend().id).toBe("mpc-stub")
    if (prev) process.env.MPC_COORDINATOR_URL = prev
    else Reflect.deleteProperty(process.env, "MPC_COORDINATOR_URL")
  })

  test("mpc stub signs without coordinator", async () => {
    process.env.MPC_COORDINATOR_URL = "http://127.0.0.1:1"
    const mpc = new MpcSignerStub()
    const r = await mpc.sign({ digest: "0x01", chainId: 84532 })
    expect(r.signature.startsWith("0xmpc_stub_")).toBe(true)
    Reflect.deleteProperty(process.env, "MPC_COORDINATOR_URL")
  })
})
