import { randomUUID } from "node:crypto"
import type { OutboxEvent } from "@railguard/kernel/domain"
import { db } from "./db"

export async function enqueueOutboxEvent(input: {
  aggregateType: string
  aggregateId: string
  eventType: string
  payload: Record<string, unknown>
}): Promise<OutboxEvent> {
  const id = `obx_${randomUUID()}`
  const createdAt = new Date()
  await db.exec`
    INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload_json, created_at)
    VALUES (
      ${id},
      ${input.aggregateType},
      ${input.aggregateId},
      ${input.eventType},
      ${JSON.stringify(input.payload)},
      ${createdAt}
    )
  `
  return {
    id,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    eventType: input.eventType,
    payload: input.payload,
    createdAt: createdAt.toISOString(),
  }
}

export async function fetchPendingOutboxEvents(limit = 50): Promise<OutboxEvent[]> {
  const rows = await db.query<{
    id: string
    aggregate_type: string
    aggregate_id: string
    event_type: string
    payload_json: Record<string, unknown>
    created_at: Date
    published_at: Date | null
  }>`
    SELECT * FROM outbox_events
    WHERE published_at IS NULL
    ORDER BY created_at ASC
    LIMIT ${limit}
  `
  return rows.map((row) => ({
    id: row.id,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    eventType: row.event_type,
    payload: row.payload_json,
    createdAt: row.created_at.toISOString(),
    publishedAt: row.published_at?.toISOString(),
  }))
}

export async function markOutboxPublished(id: string): Promise<void> {
  await db.exec`
    UPDATE outbox_events SET published_at = NOW() WHERE id = ${id}
  `
}
