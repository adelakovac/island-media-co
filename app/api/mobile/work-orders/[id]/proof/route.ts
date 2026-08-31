import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/http";
import { requireActingUser } from "@/lib/acting-user";
import { withIdempotency } from "@/lib/idempotency";
import { markWorkOrderCompleted } from "@/lib/work-order-completion";
import { now } from "@/lib/fixture-clock";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actingUser = await requireActingUser(request);
    if (actingUser.role !== "fitter") {
      throw new ApiError("FORBIDDEN", "Only fitter users may attach completion proof.");
    }

    const { id } = await params;

    return await withIdempotency(request, "mobile.work-orders.proof", async () => {
      const workOrder = await prisma.workOrder.findUnique({ where: { id } });
      if (!workOrder) {
        throw new ApiError("NOT_FOUND", `Work order ${id} was not found.`);
      }
      if (workOrder.assignedUserId !== actingUser.id) {
        throw new ApiError("FORBIDDEN", "You cannot access this organisation's record.");
      }

      const formData = await request.formData().catch(() => {
        throw new ApiError("VALIDATION_ERROR", "Request body must be multipart/form-data.");
      });

      const file = formData.get("file");
      if (!(file instanceof File) || file.size === 0) {
        throw new ApiError("VALIDATION_ERROR", "file is required.");
      }
      const completionNote = formData.get("completionNote");
      if (typeof completionNote !== "string" || completionNote.length < 3) {
        throw new ApiError("VALIDATION_ERROR", "completionNote must be at least 3 characters.");
      }

      const fileBuffer = Buffer.from(await file.arrayBuffer());
      const previewUrl = `data:${file.type || "application/octet-stream"};base64,${fileBuffer.toString("base64")}`;

      const at = now();
      const created = await prisma.$transaction(async (tx) => {
        const proof = await tx.proofRecord.create({
          data: {
            workOrderId: workOrder.id,
            fileName: file.name,
            previewUrl,
            completionNote,
            createdAt: at,
            createdByUserId: actingUser.id,
          },
        });
        await tx.workOrder.update({ where: { id: workOrder.id }, data: { completionNote } });
        await markWorkOrderCompleted(tx, workOrder, completionNote, at);
        return proof;
      });

      return {
        status: 201,
        body: {
          id: created.id,
          workOrderId: created.workOrderId,
          fileName: created.fileName,
          previewUrl: created.previewUrl,
          completionNote: created.completionNote,
          createdAt: created.createdAt.toISOString(),
          createdByUserId: created.createdByUserId,
        },
      };
    });
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    console.error(error);
    return errorResponse(
      new ApiError("SERVICE_UNAVAILABLE", "Please try again. The service is temporarily unavailable."),
    );
  }
}
