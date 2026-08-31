import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/http";
import { requireActingUser } from "@/lib/acting-user";
import { withIdempotency } from "@/lib/idempotency";
import { buildClientContractDetail } from "@/lib/client-contract-detail";
import { appendHistory, newHistory } from "@/lib/history";
import { now } from "@/lib/fixture-clock";
import { assetAvailability, capacityPoolAvailability } from "@/lib/availability";

interface ClientContractActionBody {
  action?: unknown;
  note?: unknown;
}

const ACTIONS = ["accept", "request_changes", "request_cancellation"] as const;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actingUser = await requireActingUser(request);
    if (actingUser.role !== "client" || !actingUser.organisationId) {
      throw new ApiError("FORBIDDEN", "Only client users belonging to an organisation may act on a contract.");
    }

    const { id } = await params;

    return await withIdempotency(request, "client.contracts.actions", async () => {
      const contract = await prisma.contract.findUnique({ where: { id }, include: { items: true } });
      if (!contract) {
        throw new ApiError("NOT_FOUND", `Contract ${id} was not found.`);
      }
      if (contract.organisationId !== actingUser.organisationId) {
        throw new ApiError("FORBIDDEN", "You cannot access this organisation's record.");
      }

      const body = (await request.json().catch(() => {
        throw new ApiError("VALIDATION_ERROR", "Request body must be valid JSON.");
      })) as ClientContractActionBody;

      if (typeof body.action !== "string" || !ACTIONS.includes(body.action as (typeof ACTIONS)[number])) {
        throw new ApiError("VALIDATION_ERROR", `action must be one of: ${ACTIONS.join(", ")}.`);
      }
      const note =
        body.note === null || body.note === undefined
          ? null
          : typeof body.note === "string"
            ? body.note
            : (() => {
                throw new ApiError("VALIDATION_ERROR", "note must be a string or null.");
              })();

      const action = body.action as (typeof ACTIONS)[number];
      const at = now();

      if (action === "accept") {
        if (contract.status !== "issued") {
          throw new ApiError("INVENTORY_CONFLICT", "Contract is not awaiting acceptance.");
        }

        // Re-check inventory at acceptance time, not just at approval time: an
        // asset/pool can be claimed by another contract in between.
        for (const item of contract.items) {
          if (item.assetId) {
            const asset = await prisma.asset.findUniqueOrThrow({
              where: { id: item.assetId },
              include: { bookings: true, holds: true, outages: true },
            });
            const availability = assetAvailability(asset, contract.startDate, contract.endDate);
            if (availability.state === "unavailable") {
              throw new ApiError("INVENTORY_CONFLICT", `Asset for item ${item.id} is no longer available: ${availability.reason}`);
            }
          } else if (item.capacityPoolId) {
            const pool = await prisma.capacityPool.findUniqueOrThrow({
              where: { id: item.capacityPoolId },
              include: { bookings: true, holds: true },
            });
            const availability = capacityPoolAvailability(pool, contract.startDate, contract.endDate);
            if (availability.state === "unavailable" || (availability.availableCapacity ?? 0) < item.quantity) {
              throw new ApiError("INVENTORY_CONFLICT", `Capacity pool for item ${item.id} no longer has room: ${availability.reason}`);
            }
          }
        }

        await prisma.$transaction(async (tx) => {
          await tx.contract.update({
            where: { id: contract.id },
            data: {
              status: "accepted",
              acceptedAt: at,
              history: appendHistory(contract.history, { at: at.toISOString(), actor: "client", action: "accepted", note }),
            },
          });

          let campaign = await tx.campaign.findUnique({ where: { contractId: contract.id } });
          if (!campaign) {
            const organisation = await tx.organisation.findUniqueOrThrow({ where: { id: contract.organisationId } });
            campaign = await tx.campaign.create({
              data: {
                organisationId: contract.organisationId,
                contractId: contract.id,
                bookingId: null,
                name: `${organisation.name} campaign`,
                status: "active",
                currentStage: "awaiting_installation",
                clientVisible: true,
              },
            });
          }

          let firstBookingId: string | null = null;
          for (const item of contract.items) {
            const booking = await tx.booking.create({
              data: {
                campaignName: campaign.name,
                productId: item.productId,
                assetId: item.assetId,
                capacityPoolId: item.capacityPoolId,
                capacityUnits: item.capacityPoolId ? item.quantity : null,
                startDate: contract.startDate,
                endDate: contract.endDate,
                status: "confirmed",
              },
            });
            firstBookingId = firstBookingId ?? booking.id;
          }

          await tx.campaign.update({
            where: { id: campaign.id },
            data: { status: "active", currentStage: "awaiting_installation", bookingId: firstBookingId },
          });

          await tx.serviceEvent.create({
            data: {
              organisationId: contract.organisationId,
              contractId: contract.id,
              campaignId: campaign.id,
              at,
              type: "contract_accepted",
              title: "Contract accepted",
              clientVisible: true,
              clientSummary: "Your advertising contract has been accepted.",
            },
          });
        });
      } else if (action === "request_changes") {
        if (contract.status !== "issued" && contract.status !== "accepted") {
          throw new ApiError("INVENTORY_CONFLICT", "Contract is not in a state where changes can be requested.");
        }
        await prisma.$transaction([
          prisma.contract.update({
            where: { id: contract.id },
            data: {
              status: "change_requested",
              history: appendHistory(contract.history, {
                at: at.toISOString(),
                actor: "client",
                action: "change_requested",
                note,
              }),
            },
          }),
          prisma.clientRequest.create({
            data: {
              organisationId: contract.organisationId,
              contractId: contract.id,
              type: "contract_change",
              status: "submitted",
              createdAt: at,
              summary: note ?? "Client requested contract changes.",
              history: newHistory({ at: at.toISOString(), actor: "client", action: "submitted", note }),
            },
          }),
        ]);
      } else {
        if (contract.status === "completed" || contract.status === "cancelled") {
          throw new ApiError("INVENTORY_CONFLICT", "Contract is already completed or cancelled.");
        }
        await prisma.$transaction([
          prisma.contract.update({
            where: { id: contract.id },
            data: {
              history: appendHistory(contract.history, {
                at: at.toISOString(),
                actor: "client",
                action: "cancellation_requested",
                note,
              }),
            },
          }),
          prisma.clientRequest.create({
            data: {
              organisationId: contract.organisationId,
              contractId: contract.id,
              type: "cancellation",
              status: "submitted",
              createdAt: at,
              summary: note ?? "Client requested cancellation.",
              history: newHistory({ at: at.toISOString(), actor: "client", action: "submitted", note }),
            },
          }),
        ]);
      }

      const updated = await prisma.contract.findUniqueOrThrow({ where: { id: contract.id }, include: { items: true } });
      return { status: 200, body: await buildClientContractDetail(updated) };
    });
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    console.error(error);
    return errorResponse(
      new ApiError("SERVICE_UNAVAILABLE", "Please try again. The service is temporarily unavailable."),
    );
  }
}
