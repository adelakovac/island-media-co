import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/http";
import { requireActingUser } from "@/lib/acting-user";
import { WORK_ORDER_INCLUDE } from "@/lib/work-orders";
import { serializeFitterWorkOrder } from "@/lib/fitter-work-orders";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actingUser = await requireActingUser(request);
    if (actingUser.role !== "fitter") {
      throw new ApiError("FORBIDDEN", "Only fitter users may view a work order.");
    }

    const { id } = await params;
    const workOrder = await prisma.workOrder.findUnique({ where: { id }, include: WORK_ORDER_INCLUDE });
    if (!workOrder) {
      throw new ApiError("NOT_FOUND", `Work order ${id} was not found.`);
    }
    if (workOrder.assignedUserId !== actingUser.id) {
      throw new ApiError("FORBIDDEN", "You cannot access this organisation's record.");
    }

    return NextResponse.json(await serializeFitterWorkOrder(workOrder));
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    console.error(error);
    return errorResponse(
      new ApiError("SERVICE_UNAVAILABLE", "Please try again. The service is temporarily unavailable."),
    );
  }
}
