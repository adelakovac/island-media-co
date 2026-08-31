import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/http";
import { requireActingUser } from "@/lib/acting-user";
import { withIdempotency } from "@/lib/idempotency";
import { serializeContract } from "@/lib/contracts";
import { newHistory } from "@/lib/history";
import { now } from "@/lib/fixture-clock";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

interface ContractItemInput {
  id?: unknown;
  productId?: unknown;
  assetId?: unknown;
  capacityPoolId?: unknown;
  quantity?: unknown;
  unitRate?: unknown;
  rateUnit?: unknown;
  lineTotal?: unknown;
}

interface ContractCreateBody {
  organisationId?: unknown;
  bookingRequestId?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  items?: unknown;
  total?: unknown;
}

function parseDateOnly(value: unknown, name: string): Date {
  if (typeof value !== "string" || !DATE_ONLY.test(value)) {
    throw new ApiError("VALIDATION_ERROR", `${name} must be an ISO date (YYYY-MM-DD).`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new ApiError("VALIDATION_ERROR", `${name} is not a valid date.`);
  return date;
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new ApiError("VALIDATION_ERROR", `${name} is required.`);
  }
  return value;
}

async function validateItem(raw: ContractItemInput) {
  const id = requireString(raw.id, "items[].id");
  const productId = requireString(raw.productId, "items[].productId");
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new ApiError("VALIDATION_ERROR", `Unknown items[].productId: ${productId}`);

  const assetId = raw.assetId === null || raw.assetId === undefined ? null : requireString(raw.assetId, "items[].assetId");
  if (assetId) {
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset || asset.productId !== productId) {
      throw new ApiError("VALIDATION_ERROR", `items[].assetId ${assetId} is not valid for product ${productId}.`);
    }
  }

  const capacityPoolId =
    raw.capacityPoolId === null || raw.capacityPoolId === undefined
      ? null
      : requireString(raw.capacityPoolId, "items[].capacityPoolId");
  if (capacityPoolId) {
    const pool = await prisma.capacityPool.findUnique({ where: { id: capacityPoolId } });
    if (!pool || pool.productId !== productId) {
      throw new ApiError("VALIDATION_ERROR", `items[].capacityPoolId ${capacityPoolId} is not valid for product ${productId}.`);
    }
  }

  if (typeof raw.quantity !== "number" || !Number.isInteger(raw.quantity) || raw.quantity < 1) {
    throw new ApiError("VALIDATION_ERROR", "items[].quantity must be a positive integer.");
  }
  const unitRate = raw.unitRate === null || raw.unitRate === undefined ? null : raw.unitRate;
  if (unitRate !== null && typeof unitRate !== "number") {
    throw new ApiError("VALIDATION_ERROR", "items[].unitRate must be a number or null.");
  }
  const rateUnit = raw.rateUnit === null || raw.rateUnit === undefined ? null : raw.rateUnit;
  if (rateUnit !== null && typeof rateUnit !== "string") {
    throw new ApiError("VALIDATION_ERROR", "items[].rateUnit must be a string or null.");
  }
  if (typeof raw.lineTotal !== "number" || !Number.isFinite(raw.lineTotal)) {
    throw new ApiError("VALIDATION_ERROR", "items[].lineTotal must be a number.");
  }

  return { id, productId, assetId, capacityPoolId, quantity: raw.quantity, unitRate, rateUnit, lineTotal: raw.lineTotal };
}

export async function POST(request: Request) {
  try {
    const actingUser = await requireActingUser(request);
    if (actingUser.role !== "manager") {
      throw new ApiError("FORBIDDEN", "Only manager users may create contracts.");
    }

    return await withIdempotency(request, "management.contracts.create", async () => {
      const body = (await request.json().catch(() => {
        throw new ApiError("VALIDATION_ERROR", "Request body must be valid JSON.");
      })) as ContractCreateBody;

      const organisationId = requireString(body.organisationId, "organisationId");
      const bookingRequestId = requireString(body.bookingRequestId, "bookingRequestId");
      const startDate = parseDateOnly(body.startDate, "startDate");
      const endDate = parseDateOnly(body.endDate, "endDate");
      if (endDate <= startDate) throw new ApiError("VALIDATION_ERROR", "endDate must be after startDate.");

      if (!Array.isArray(body.items) || body.items.length === 0) {
        throw new ApiError("VALIDATION_ERROR", "items must be a non-empty array.");
      }
      if (typeof body.total !== "number" || !Number.isFinite(body.total) || body.total < 0) {
        throw new ApiError("VALIDATION_ERROR", "total must be a non-negative number.");
      }

      const organisation = await prisma.organisation.findUnique({ where: { id: organisationId } });
      if (!organisation) throw new ApiError("VALIDATION_ERROR", `Unknown organisationId: ${organisationId}`);

      const bookingRequest = await prisma.bookingRequest.findUnique({ where: { id: bookingRequestId } });
      if (!bookingRequest) throw new ApiError("VALIDATION_ERROR", `Unknown bookingRequestId: ${bookingRequestId}`);
      if (bookingRequest.organisationId !== organisationId) {
        throw new ApiError("VALIDATION_ERROR", "bookingRequestId does not belong to organisationId.");
      }
      if (bookingRequest.status !== "approved") {
        throw new ApiError("INVENTORY_CONFLICT", "Booking request has not been approved.");
      }
      const alreadyContracted = await prisma.contract.findUnique({ where: { bookingRequestId } });
      if (alreadyContracted) {
        throw new ApiError("INVENTORY_CONFLICT", "This booking request already has a contract.");
      }

      const items = await Promise.all(body.items.map((item) => validateItem(item as ContractItemInput)));
      const itemsTotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
      if (Math.abs(itemsTotal - body.total) > 0.01) {
        throw new ApiError("VALIDATION_ERROR", "total does not match the sum of items[].lineTotal.");
      }

      const at = now();
      const created = await prisma.$transaction(async (tx) => {
        const contract = await tx.contract.create({
          data: {
            organisationId,
            bookingRequestId,
            status: "draft",
            version: 1,
            startDate,
            endDate,
            currency: "GBP",
            total: body.total as number,
            history: newHistory({ at: at.toISOString(), actor: "manager", action: "draft_created", note: null }),
            items: { create: items },
          },
          include: { items: true },
        });
        await tx.bookingRequest.update({ where: { id: bookingRequestId }, data: { draftContractId: contract.id } });
        await tx.organisation.update({ where: { id: organisationId }, data: { contractCount: { increment: 1 } } });
        return contract;
      });

      return { status: 201, body: serializeContract(created) };
    });
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    console.error(error);
    return errorResponse(
      new ApiError("SERVICE_UNAVAILABLE", "Please try again. The service is temporarily unavailable."),
    );
  }
}
