import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/http";
import { requireActingUser } from "@/lib/acting-user";
import { serializeBookingRequestSummary } from "@/lib/booking-requests";

const STATUSES = ["submitted", "information_required", "approved", "declined"] as const;

export async function GET(request: NextRequest) {
  try {
    const actingUser = await requireActingUser(request);
    if (actingUser.role !== "manager") {
      throw new ApiError("FORBIDDEN", "Only manager users may list booking requests.");
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    if (status && !STATUSES.includes(status as (typeof STATUSES)[number])) {
      throw new ApiError("VALIDATION_ERROR", `status must be one of: ${STATUSES.join(", ")}.`);
    }

    const requests = await prisma.bookingRequest.findMany({
      where: status ? { status } : undefined,
      include: { organisation: true, product: true },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ items: requests.map(serializeBookingRequestSummary) });
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    console.error(error);
    return errorResponse(
      new ApiError("SERVICE_UNAVAILABLE", "Please try again. The service is temporarily unavailable."),
    );
  }
}
