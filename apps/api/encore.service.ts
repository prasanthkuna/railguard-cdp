import { Service } from "encore.dev/service"

// Railguard API owns vendor payment verification, approval gates, payment intents,
// and the append-only audit trail for the MVP backend.
export default new Service("api")
