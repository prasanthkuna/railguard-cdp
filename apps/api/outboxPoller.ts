import { api } from "encore.dev/api"
import { CronJob } from "encore.dev/cron"
import { fetchPendingOutboxEvents, markOutboxPublished } from "./outboxService"

export const publishPendingOutboxEvents = api(
  { expose: false, method: "POST", path: "/internal/publish-outbox" },
  async (): Promise<{ published: number }> => {
    const events = await fetchPendingOutboxEvents(50)
    for (const event of events) {
      await markOutboxPublished(event.id)
    }
    return { published: events.length }
  },
)

new CronJob("publish-outbox-events", {
  title: "Publish pending domain outbox events",
  every: "5m",
  endpoint: publishPendingOutboxEvents,
})
