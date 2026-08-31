import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/http";
import { requireActingUser } from "@/lib/acting-user";
import { buildClientContractDetail } from "@/lib/client-contract-detail";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actingUser = await requireActingUser(request);
    if (actingUser.role !== "client" || !actingUser.organisationId) {
      throw new ApiError("FORBIDDEN", "Only client users belonging to an organisation may view a contract.");
    }

    const { id } = await params;
    const contract = await prisma.contract.findUnique({ where: { id }, include: { items: true } });
    if (!contract) {
      throw new ApiError("NOT_FOUND", `Contract ${id} was not found.`);
    }
    if (contract.organisationId !== actingUser.organisationId) {
      throw new ApiError("FORBIDDEN", "You cannot access this organisation's record.");
    }

    return NextResponse.json(await buildClientContractDetail(contract));
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    console.error(error);
    return errorResponse(
      new ApiError("SERVICE_UNAVAILABLE", "Please try again. The service is temporarily unavailable."),
    );
  }
}
