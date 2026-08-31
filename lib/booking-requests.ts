import type { BookingRequest, Organisation, Product } from "@prisma/client";
import type { HistoryEntry } from "./history";

export function serializeBookingRequest(request: BookingRequest) {
  return {
    id: request.id,
    organisationId: request.organisationId,
    productId: request.productId,
    requestedAssetId: request.requestedAssetId,
    startDate: request.startDate.toISOString().slice(0, 10),
    endDate: request.endDate.toISOString().slice(0, 10),
    budget: request.budget,
    objective: request.objective,
    notes: request.notes,
    status: request.status,
    createdAt: request.createdAt.toISOString(),
    draftContractId: request.draftContractId,
    history: JSON.parse(request.history),
  };
}

/**
 * A booking request needs management's attention when it's freshly submitted,
 * or when the client has just answered a manager's information request (the
 * status is still `information_required` but the latest history entry shows
 * the ball is back in the manager's court).
 */
export function bookingRequestAttentionReason(request: BookingRequest): string | null {
  if (request.status === "submitted") return "New request awaiting review.";
  if (request.status === "information_required") {
    const history = JSON.parse(request.history) as HistoryEntry[];
    const last = history.at(-1);
    if (last?.actor === "client") return "Client has supplied requested information.";
  }
  return null;
}

export function serializeBookingRequestSummary(request: BookingRequest & { organisation: Organisation; product: Product }) {
  return {
    id: request.id,
    organisationName: request.organisation.name,
    productName: request.product.name,
    startDate: request.startDate.toISOString().slice(0, 10),
    endDate: request.endDate.toISOString().slice(0, 10),
    status: request.status,
    createdAt: request.createdAt.toISOString(),
    attentionReason: bookingRequestAttentionReason(request),
  };
}

/**
 * Client-facing view of one of the client's own booking requests: enough to
 * show status and the manager's messages (e.g. an information_required note)
 * without exposing the full management detail (availability, other assets).
 */
export function serializeClientBookingRequestSummary(request: BookingRequest & { product: Product }) {
  return {
    id: request.id,
    productId: request.productId,
    productName: request.product.name,
    startDate: request.startDate.toISOString().slice(0, 10),
    endDate: request.endDate.toISOString().slice(0, 10),
    budget: request.budget,
    objective: request.objective,
    notes: request.notes,
    status: request.status,
    createdAt: request.createdAt.toISOString(),
    history: JSON.parse(request.history) as HistoryEntry[],
  };
}
