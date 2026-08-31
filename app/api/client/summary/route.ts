import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/http";
import { requireActingUser } from "@/lib/acting-user";
import { serializeOrganisation } from "@/lib/session";
import { contractActionRequired, serializeContractSummary } from "@/lib/contracts";
import { serializeServiceEvent } from "@/lib/service-events";

export async function GET(request: NextRequest) {
  try {
    const actingUser = await requireActingUser(request);
    if (actingUser.role !== "client" || !actingUser.organisationId) {
      throw new ApiError("FORBIDDEN", "Only client users belonging to an organisation may view the client summary.");
    }

    const organisation = await prisma.organisation.findUnique({
      where: { id: actingUser.organisationId },
      include: {
        contracts: { orderBy: { startDate: "asc" } },
        serviceEvents: { where: { clientVisible: true }, orderBy: { at: "desc" }, take: 10 },
      },
    });

    if (!organisation) {
      throw new ApiError("FORBIDDEN", "The selected user's organisation could not be found.");
    }

    const attentionItems = organisation.contracts
      .filter((contract) => contractActionRequired(contract.status) !== null)
      .map((contract) => ({
        type: "contract_action_required",
        contractId: contract.id,
        status: contract.status,
        message: contractActionRequired(contract.status),
      }));

    return NextResponse.json({
      organisation: serializeOrganisation(organisation),
      contracts: organisation.contracts.map(serializeContractSummary),
      attentionItems,
      recentServiceEvents: organisation.serviceEvents.map(serializeServiceEvent),
    });
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    console.error(error);
    return errorResponse(
      new ApiError("SERVICE_UNAVAILABLE", "Please try again. The service is temporarily unavailable."),
    );
  }
}
