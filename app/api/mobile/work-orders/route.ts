import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/http";
import { requireActingUser } from "@/lib/acting-user";
import { WORK_ORDER_INCLUDE } from "@/lib/work-orders";
import { serializeFitterWorkOrders } from "@/lib/fitter-work-orders";

export async function GET(request: NextRequest) {
  try {
    const actingUser = await requireActingUser(request);
    if (actingUser.role !== "fitter") {
      throw new ApiError("FORBIDDEN", "Only fitter users may list assigned work orders.");
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const workOrders = await prisma.workOrder.findMany({
      where: { assignedUserId: actingUser.id, status: status ?? undefined },
      include: WORK_ORDER_INCLUDE,
      orderBy: { scheduledStart: "asc" },
    });

    return NextResponse.json({ items: await serializeFitterWorkOrders(workOrders) });
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    console.error(error);
    return errorResponse(
      new ApiError("SERVICE_UNAVAILABLE", "Please try again. The service is temporarily unavailable."),
    );
  }
}
