import type { ServiceEvent } from "@prisma/client";

export function serializeServiceEvent(event: ServiceEvent) {
  return {
    id: event.id,
    at: event.at.toISOString(),
    type: event.type,
    title: event.title,
    clientVisible: event.clientVisible,
    clientSummary: event.clientSummary,
  };
}
