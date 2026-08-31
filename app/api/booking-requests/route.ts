import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/http";
import { requireActingUser } from "@/lib/acting-user";
import { now } from "@/lib/fixture-clock";
import { serializeBookingRequest } from "@/lib/booking-requests";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

interface BookingRequestCreateBody {
  productId?: unknown;
  requestedAssetId?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  budget?: unknown;
  objective?: unknown;
  notes?: unknown;
}

function parseDateOnly(value: unknown, name: string): Date {
  if (typeof value !== "string" || !DATE_ONLY.test(value)) {
    throw new ApiError("VALIDATION_ERROR", `${name} must be an ISO date (YYYY-MM-DD).`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError("VALIDATION_ERROR", `${name} is not a valid date.`);
  }
  return date;
}

export async function POST(request: NextRequest) {
  try {
    const actingUser = await requireActingUser(request);
    if (actingUser.role !== "client" || !actingUser.organisationId) {
      throw new ApiError("FORBIDDEN", "Only client users belonging to an organisation may submit booking requests.");
    }

    const idempotencyKey = request.headers.get("idempotency-key");
    if (!idempotencyKey || idempotencyKey.length < 8) {
      throw new ApiError("VALIDATION_ERROR", "Idempotency-Key header is required and must be at least 8 characters.");
    }

    const existing = await prisma.bookingRequest.findUnique({ where: { idempotencyKey } });
    if (existing) {
      return NextResponse.json(serializeBookingRequest(existing), { status: 200 });
    }

    const body = (await request.json().catch(() => {
      throw new ApiError("VALIDATION_ERROR", "Request body must be valid JSON.");
    })) as BookingRequestCreateBody;

    if (typeof body.productId !== "string" || body.productId.length === 0) {
      throw new ApiError("VALIDATION_ERROR", "productId is required.");
    }
    const requestedAssetId =
      body.requestedAssetId === null || body.requestedAssetId === undefined
        ? null
        : typeof body.requestedAssetId === "string"
          ? body.requestedAssetId
          : (() => {
              throw new ApiError("VALIDATION_ERROR", "requestedAssetId must be a string or null.");
            })();
    const startDate = parseDateOnly(body.startDate, "startDate");
    const endDate = parseDateOnly(body.endDate, "endDate");
    if (endDate <= startDate) {
      throw new ApiError("VALIDATION_ERROR", "endDate must be after startDate.");
    }
    if (typeof body.budget !== "number" || !Number.isFinite(body.budget) || body.budget < 0) {
      throw new ApiError("VALIDATION_ERROR", "budget must be a non-negative number.");
    }
    if (typeof body.objective !== "string" || body.objective.length < 5) {
      throw new ApiError("VALIDATION_ERROR", "objective must be at least 5 characters.");
    }
    const notes =
      body.notes === null || body.notes === undefined
        ? null
        : typeof body.notes === "string"
          ? body.notes
          : (() => {
              throw new ApiError("VALIDATION_ERROR", "notes must be a string or null.");
            })();

    const product = await prisma.product.findUnique({ where: { id: body.productId } });
    if (!product) {
      throw new ApiError("VALIDATION_ERROR", `Unknown productId: ${body.productId}`);
    }

    if (requestedAssetId) {
      const asset = await prisma.asset.findUnique({ where: { id: requestedAssetId } });
      if (!asset || asset.productId !== product.id) {
        throw new ApiError("VALIDATION_ERROR", `requestedAssetId ${requestedAssetId} is not a valid asset for this product.`);
      }
    }

    const organisation = await prisma.organisation.findUniqueOrThrow({ where: { id: actingUser.organisationId } });
    const createdAt = now();

    const created = await prisma.bookingRequest.create({
      data: {
        idempotencyKey,
        organisationId: organisation.id,
        advertiserName: organisation.name,
        advertiserContactName: actingUser.name,
        advertiserEmail: actingUser.email,
        productId: product.id,
        requestedAssetId,
        startDate,
        endDate,
        budget: body.budget,
        objective: body.objective,
        notes,
        status: "submitted",
        createdAt,
        history: JSON.stringify([{ at: createdAt.toISOString(), actor: "advertiser", action: "submitted", note: null }]),
      },
    });

    return NextResponse.json(serializeBookingRequest(created), { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    console.error(error);
    return errorResponse(
      new ApiError("SERVICE_UNAVAILABLE", "Please try again. The service is temporarily unavailable."),
    );
  }
}
