import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/http";
import { requireActingUser } from "@/lib/acting-user";
import { withIdempotency } from "@/lib/idempotency";
import { WORK_ORDER_INCLUDE, serializeWorkOrder } from "@/lib/work-orders";
import { newHistory } from "@/lib/history";
import { now } from "@/lib/fixture-clock";

const WORK_ORDER_TYPES = ["survey", "production", "installation", "maintenance", "removal"] as const;

interface WorkOrderCreateBody {
  campaignId?: unknown;
  contractId?: unknown;
  type?: unknown;
  assignedUserId?: unknown;
  assetId?: unknown;
  scheduledStart?: unknown;
  scheduledEnd?: unknown;
  locationLabel?: unknown;
  instructions?: unknown;
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new ApiError("VALIDATION_ERROR", `${name} is required.`);
  }
  return value;
}

function requireDateTime(value: unknown, name: string): Date {
  if (typeof value !== "string") throw new ApiError("VALIDATION_ERROR", `${name} must be an ISO date-time string.`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ApiError("VALIDATION_ERROR", `${name} is not a valid date-time.`);
  return date;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export async function POST(request: Request) {
  try {
    const actingUser = await requireActingUser(request);
    if (actingUser.role !== "manager") {
      throw new ApiError("FORBIDDEN", "Only manager users may create work orders.");
    }

    return await withIdempotency(request, "management.work-orders.create", async () => {
      const body = (await request.json().catch(() => {
        throw new ApiError("VALIDATION_ERROR", "Request body must be valid JSON.");
      })) as WorkOrderCreateBody;

      const campaignId = requireString(body.campaignId, "campaignId");
      const contractId = requireString(body.contractId, "contractId");
      const type = requireString(body.type, "type");
      if (!WORK_ORDER_TYPES.includes(type as (typeof WORK_ORDER_TYPES)[number])) {
        throw new ApiError("VALIDATION_ERROR", `type must be one of: ${WORK_ORDER_TYPES.join(", ")}.`);
      }
      const assignedUserId = requireString(body.assignedUserId, "assignedUserId");
      const assetId = requireString(body.assetId, "assetId");
      const scheduledStart = requireDateTime(body.scheduledStart, "scheduledStart");
      const scheduledEnd = requireDateTime(body.scheduledEnd, "scheduledEnd");
      if (scheduledEnd <= scheduledStart) {
        throw new ApiError("VALIDATION_ERROR", "scheduledEnd must be after scheduledStart.");
      }
      const locationLabel = requireString(body.locationLabel, "locationLabel");
      const instructions = requireString(body.instructions, "instructions");

      const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
      if (!campaign) throw new ApiError("VALIDATION_ERROR", `Unknown campaignId: ${campaignId}`);
      if (campaign.contractId !== contractId) {
        throw new ApiError("VALIDATION_ERROR", "campaignId does not belong to contractId.");
      }
      const contract = await prisma.contract.findUnique({ where: { id: contractId } });
      if (!contract) throw new ApiError("VALIDATION_ERROR", `Unknown contractId: ${contractId}`);
      if (contract.status === "cancelled" || contract.status === "completed") {
        throw new ApiError("INVENTORY_CONFLICT", `Contract is ${contract.status} - work cannot be scheduled against it.`);
      }

      const fitter = await prisma.user.findUnique({ where: { id: assignedUserId } });
      if (!fitter || fitter.role !== "fitter") {
        throw new ApiError("VALIDATION_ERROR", `assignedUserId ${assignedUserId} is not a valid fitter.`);
      }
      const asset = await prisma.asset.findUnique({ where: { id: assetId } });
      if (!asset) throw new ApiError("VALIDATION_ERROR", `Unknown assetId: ${assetId}`);

      const at = now();
      const created = await prisma.$transaction(async (tx) => {
        const workOrder = await tx.workOrder.create({
          data: {
            campaignId,
            contractId,
            organisationId: contract.organisationId,
            type,
            status: "assigned",
            assignedUserId,
            assetId,
            scheduledStart,
            scheduledEnd,
            locationLabel,
            instructions,
            internalNotes: null,
            completionNote: null,
            history: newHistory({ at: at.toISOString(), actor: "manager", action: "assigned", note: `Assigned to ${fitter.name}.` }),
          },
          include: WORK_ORDER_INCLUDE,
        });

        await tx.serviceEvent.create({
          data: {
            organisationId: contract.organisationId,
            contractId,
            campaignId,
            workOrderId: workOrder.id,
            at,
            type: `${type}_scheduled`,
            title: `${capitalize(type)} scheduled`,
            clientVisible: true,
            clientSummary: `${capitalize(type)} is planned for ${scheduledStart.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" })}.`,
          },
        });

        return workOrder;
      });

      return { status: 201, body: serializeWorkOrder(created) };
    });
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    console.error(error);
    return errorResponse(
      new ApiError("SERVICE_UNAVAILABLE", "Please try again. The service is temporarily unavailable."),
    );
  }
}
