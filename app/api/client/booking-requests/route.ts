import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/http";
import { requireActingUser } from "@/lib/acting-user";
import { serializeClientBookingRequestSummary } from "@/lib/booking-requests";

export async function GET(request: NextRequest) {
  try {
    const actingUser = await requireActingUser(request);
    if (actingUser.role !== "client" || !actingUser.organisationId) {
      throw new ApiError("FORBIDDEN", "Only client users belonging to an organisation may view their booking requests.");
    }

    const requests = await prisma.bookingRequest.findMany({
      where: { organisationId: actingUser.organisationId },
      include: { product: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ items: requests.map(serializeClientBookingRequestSummary) });
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    console.error(error);
    return errorResponse(
      new ApiError("SERVICE_UNAVAILABLE", "Please try again. The service is temporarily unavailable."),
    );
  }
}
