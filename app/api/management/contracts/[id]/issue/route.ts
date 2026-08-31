import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/http";
import { requireActingUser } from "@/lib/acting-user";
import { withIdempotency } from "@/lib/idempotency";
import { serializeContract } from "@/lib/contracts";
import { appendHistory } from "@/lib/history";
import { now } from "@/lib/fixture-clock";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actingUser = await requireActingUser(request);
    if (actingUser.role !== "manager") {
      throw new ApiError("FORBIDDEN", "Only manager users may issue contracts.");
    }

    const { id } = await params;

    return await withIdempotency(request, "management.contracts.issue", async () => {
      const contract = await prisma.contract.findUnique({ where: { id }, include: { items: true } });
      if (!contract) {
        throw new ApiError("NOT_FOUND", `Contract ${id} was not found.`);
      }
      if (contract.status !== "draft") {
        throw new ApiError("INVENTORY_CONFLICT", "Only a draft contract can be issued.");
      }

      const at = now();
      const organisation = await prisma.organisation.findUniqueOrThrow({ where: { id: contract.organisationId } });

      const updated = await prisma.$transaction(async (tx) => {
        const issued = await tx.contract.update({
          where: { id: contract.id },
          data: {
            status: "issued",
            issuedAt: at,
            history: appendHistory(contract.history, {
              at: at.toISOString(),
              actor: "manager",
              action: "issued",
              note: "Issued for client review.",
            }),
          },
          include: { items: true },
        });

        let campaign = await tx.campaign.findUnique({ where: { contractId: contract.id } });
        if (!campaign) {
          campaign = await tx.campaign.create({
            data: {
              organisationId: contract.organisationId,
              contractId: contract.id,
              bookingId: null,
              name: `${organisation.name} campaign`,
              status: "awaiting_contract_acceptance",
              currentStage: "contract_issued",
              clientVisible: true,
            },
          });
        }

        await tx.serviceEvent.create({
          data: {
            organisationId: contract.organisationId,
            contractId: contract.id,
            campaignId: campaign.id,
            at,
            type: "contract_issued",
            title: "Contract ready for review",
            clientVisible: true,
            clientSummary: "Your contract is ready to review.",
          },
        });

        return issued;
      });

      return { status: 200, body: serializeContract(updated) };
    });
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    console.error(error);
    return errorResponse(
      new ApiError("SERVICE_UNAVAILABLE", "Please try again. The service is temporarily unavailable."),
    );
  }
}
