import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/http";
import { requireActingUser } from "@/lib/acting-user";
import { withIdempotency } from "@/lib/idempotency";
import { WORK_ORDER_INCLUDE } from "@/lib/work-orders";
import { serializeFitterWorkOrder } from "@/lib/fitter-work-orders";
import { appendHistory } from "@/lib/history";
import { markWorkOrderCompleted } from "@/lib/work-order-completion";
import { now } from "@/lib/fixture-clock";

const STATUSES = ["assigned", "travelling", "on_site", "blocked", "completed"] as const;

interface WorkOrderStatusUpdateBody {
  status?: unknown;
  note?: unknown;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actingUser = await requireActingUser(request);
    if (actingUser.role !== "fitter") {
      throw new ApiError("FORBIDDEN", "Only fitter users may update work order status.");
    }

    const { id } = await params;

    return await withIdempotency(request, "mobile.work-orders.status", async () => {
      const workOrder = await prisma.workOrder.findUnique({ where: { id } });
      if (!workOrder) {
        throw new ApiError("NOT_FOUND", `Work order ${id} was not found.`);
      }
      if (workOrder.assignedUserId !== actingUser.id) {
        throw new ApiError("FORBIDDEN", "You cannot access this organisation's record.");
      }
      if (workOrder.status === "completed") {
        throw new ApiError("INVENTORY_CONFLICT", "Work order is already completed.");
      }
      if (workOrder.status === "cancelled") {
        throw new ApiError("INVENTORY_CONFLICT", "Work order was cancelled and can no longer be updated.");
      }

      const body = (await request.json().catch(() => {
        throw new ApiError("VALIDATION_ERROR", "Request body must be valid JSON.");
      })) as WorkOrderStatusUpdateBody;

      if (typeof body.status !== "string" || !STATUSES.includes(body.status as (typeof STATUSES)[number])) {
        throw new ApiError("VALIDATION_ERROR", `status must be one of: ${STATUSES.join(", ")}.`);
      }
      const note =
        body.note === null || body.note === undefined
          ? null
          : typeof body.note === "string"
            ? body.note
            : (() => {
                throw new ApiError("VALIDATION_ERROR", "note must be a string or null.");
              })();
      const status = body.status as (typeof STATUSES)[number];
      if (status === "blocked" && !note) {
        throw new ApiError("VALIDATION_ERROR", "note is required when reporting a blocker.");
      }
      if (status === "completed") {
        const existingProof = await prisma.proofRecord.findFirst({ where: { workOrderId: workOrder.id } });
        if (!existingProof) {
          throw new ApiError(
            "VALIDATION_ERROR",
            "Completion requires a proof attachment. Use the proof upload to complete this job.",
          );
        }
      }

      const at = now();
      const updated = await prisma.$transaction(async (tx) => {
        if (status === "completed") {
          await markWorkOrderCompleted(tx, workOrder, note, at);
        } else {
          await tx.workOrder.update({
            where: { id: workOrder.id },
            data: {
              status,
              history: appendHistory(workOrder.history, { at: at.toISOString(), actor: "fitter", action: status, note }),
            },
          });
        }
        return tx.workOrder.findUniqueOrThrow({ where: { id: workOrder.id }, include: WORK_ORDER_INCLUDE });
      });

      return { status: 200, body: await serializeFitterWorkOrder(updated) };
    });
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    console.error(error);
    return errorResponse(
      new ApiError("SERVICE_UNAVAILABLE", "Please try again. The service is temporarily unavailable."),
    );
  }
}
