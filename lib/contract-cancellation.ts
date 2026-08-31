import type { Contract, ContractItem, Prisma } from "@prisma/client";
import { appendHistory } from "./history";

/**
 * Cancels a contract and cascades the cancellation through everything derived
 * from it: in-flight work orders, the campaign, and the booking(s) that were
 * holding inventory against it. A no-op if the contract is already
 * completed/cancelled, so callers can invoke it without re-checking status.
 *
 * Booking rows have no FK back to the contract (see
 * app/api/client/contracts/[id]/actions/route.ts, where one is created per
 * contract item at acceptance time), so they're matched on the same fields
 * they were created from.
 */
export async function cancelContract(
  tx: Prisma.TransactionClient,
  contract: Contract & { items: ContractItem[] },
  note: string | null,
  at: Date,
) {
  if (contract.status === "completed" || contract.status === "cancelled") return;

  await tx.contract.update({
    where: { id: contract.id },
    data: {
      status: "cancelled",
      history: appendHistory(contract.history, { at: at.toISOString(), actor: "manager", action: "cancelled", note }),
    },
  });

  const campaign = await tx.campaign.findUnique({ where: { contractId: contract.id } });
  if (campaign) {
    await tx.campaign.update({
      where: { id: campaign.id },
      data: { status: "cancelled", currentStage: "cancelled" },
    });
  }

  const openWorkOrders = await tx.workOrder.findMany({
    where: { contractId: contract.id, status: { notIn: ["completed", "cancelled"] } },
  });
  for (const workOrder of openWorkOrders) {
    await tx.workOrder.update({
      where: { id: workOrder.id },
      data: {
        status: "cancelled",
        history: appendHistory(workOrder.history, {
          at: at.toISOString(),
          actor: "manager",
          action: "cancelled",
          note: note ?? "The contract was cancelled.",
        }),
      },
    });
  }

  for (const item of contract.items) {
    if (!item.assetId && !item.capacityPoolId) continue;
    await tx.booking.updateMany({
      where: {
        productId: item.productId,
        assetId: item.assetId,
        capacityPoolId: item.capacityPoolId,
        startDate: contract.startDate,
        endDate: contract.endDate,
        status: "confirmed",
      },
      data: { status: "cancelled" },
    });
  }

  await tx.serviceEvent.create({
    data: {
      organisationId: contract.organisationId,
      contractId: contract.id,
      campaignId: campaign?.id ?? null,
      at,
      type: "contract_cancelled",
      title: "Contract cancelled",
      clientVisible: true,
      clientSummary: "Your contract has been cancelled.",
    },
  });
}
