import { Topic } from "encore.dev/pubsub"
import { Bucket } from "encore.dev/storage/objects"

export const invoiceDocumentsBucket = new Bucket("invoice-documents", {
  versioned: true,
})

export const auditExportsBucket = new Bucket("audit-exports", {
  versioned: true,
})

export interface ExtractionRequestedMessage {
  uploadID: string
  organizationID: string
  actorUserID: string
}

export interface AuditExportRequestedMessage {
  exportID: string
  organizationID: string
  actorUserID: string
}

export interface NotificationRequestedMessage {
  organizationID: string
  channel: "email" | "slack"
  subject: string
  body: string
  recipient?: string
}

export const extractionRequestedTopic = new Topic<ExtractionRequestedMessage>(
  "invoice-extraction-requested",
  { deliveryGuarantee: "at-least-once" },
)

export const auditExportRequestedTopic = new Topic<AuditExportRequestedMessage>(
  "audit-export-requested",
  { deliveryGuarantee: "at-least-once" },
)

export const notificationRequestedTopic = new Topic<NotificationRequestedMessage>(
  "notification-requested",
  { deliveryGuarantee: "at-least-once" },
)
