import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/http";
import { requireActingUser } from "@/lib/acting-user";
import { serializeContractSummary } from "@/lib/contracts";

export async function GET(request: NextRequest) {
  try {
    const actingUser = await requireActingUser(request);
    if (actingUser.role !== "client" || !actingUser.organisationId) {
      throw new ApiError("FORBIDDEN", "Only client users belonging to an organisation may list contracts.");
    }

    const contracts = await prisma.contract.findMany({
      where: { organisationId: actingUser.organisationId },
      orderBy: { startDate: "asc" },
    });

    return NextResponse.json({ items: contracts.map(serializeContractSummary) });
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    console.error(error);
    return errorResponse(
      new ApiError("SERVICE_UNAVAILABLE", "Please try again. The service is temporarily unavailable."),
    );
  }
}
