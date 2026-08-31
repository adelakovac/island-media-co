import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/http";
import { requireActingUser } from "@/lib/acting-user";
import { buildBookingRequestDetail } from "@/lib/booking-request-detail";
import { computeProductAvailability, PRODUCT_INCLUDE } from "@/lib/products";
import { appendHistory } from "@/lib/history";
import { now } from "@/lib/fixture-clock";

const ACTIONS = ["request_information", "approve", "decline"] as const;

interface ManagementDecisionBody {
  action?: unknown;
  note?: unknown;
  selectedAssetId?: unknown;
}

async function requireManager(request: Request) {
  const actingUser = await requireActingUser(request);
  if (actingUser.role !== "manager") {
    throw new ApiError("FORBIDDEN", "Only manager users may access this record.");
  }
  return actingUser;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireManager(request);
    const { id } = await params;

    const bookingRequest = await prisma.bookingRequest.findUnique({ where: { id } });
    if (!bookingRequest) {
      throw new ApiError("NOT_FOUND", `Booking request ${id} was not found.`);
    }

    return NextResponse.json(await buildBookingRequestDetail(bookingRequest));
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    console.error(error);
    return errorResponse(
      new ApiError("SERVICE_UNAVAILABLE", "Please try again. The service is temporarily unavailable."),
    );
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireManager(request);
    const { id } = await params;

    const bookingRequest = await prisma.bookingRequest.findUnique({ where: { id } });
    if (!bookingRequest) {
      throw new ApiError("NOT_FOUND", `Booking request ${id} was not found.`);
    }

    const body = (await request.json().catch(() => {
      throw new ApiError("VALIDATION_ERROR", "Request body must be valid JSON.");
    })) as ManagementDecisionBody;

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
    const selectedAssetId =
      body.selectedAssetId === null || body.selectedAssetId === undefined
        ? null
        : typeof body.selectedAssetId === "string"
          ? body.selectedAssetId
          : (() => {
              throw new ApiError("VALIDATION_ERROR", "selectedAssetId must be a string or null.");
            })();

    const action = body.action as (typeof ACTIONS)[number];
    const at = now();
    const terminal = bookingRequest.status === "approved" || bookingRequest.status === "declined";

    if (action === "request_information") {
      if (terminal) {
        throw new ApiError("INVENTORY_CONFLICT", "This request has already been decided.");
      }
      if (!note) {
        throw new ApiError("VALIDATION_ERROR", "note is required when requesting information.");
      }
      await prisma.bookingRequest.update({
        where: { id },
        data: {
          status: "information_required",
          history: appendHistory(bookingRequest.history, {
            at: at.toISOString(),
            actor: "manager",
            action: "information_required",
            note,
          }),
        },
      });
    } else if (action === "approve") {
      if (terminal) {
        throw new ApiError("INVENTORY_CONFLICT", "This request has already been decided.");
      }

      if (selectedAssetId) {
        const asset = await prisma.asset.findUnique({ where: { id: selectedAssetId } });
        if (!asset || asset.productId !== bookingRequest.productId) {
          throw new ApiError("VALIDATION_ERROR", `selectedAssetId ${selectedAssetId} is not a valid asset for this product.`);
        }
      }

      const product = await prisma.product.findUniqueOrThrow({
        where: { id: bookingRequest.productId },
        include: PRODUCT_INCLUDE,
      });
      const { summary, assetSummaries } = computeProductAvailability(
        product,
        bookingRequest.startDate,
        bookingRequest.endDate,
      );
      const targetAssetId = selectedAssetId ?? bookingRequest.requestedAssetId;

      if (product.allocationModel === "capacity_pool") {
        // No specific unit to defer allocation of - the shared pool itself must have room.
        if (summary.state === "unavailable") {
          throw new ApiError("INVENTORY_CONFLICT", "No suitable inventory remains for the requested dates.");
        }
      } else if (targetAssetId) {
        // A specific asset is being committed to (chosen now, or carried over from the
        // client's original ask) - that asset must actually be free.
        const targetAvailability = assetSummaries.find((entry) => entry.asset.id === targetAssetId)?.summary;
        if (targetAvailability?.state === "unavailable") {
          throw new ApiError("INVENTORY_CONFLICT", "No suitable inventory remains for the requested dates.");
        }
      }
      // else: approved "in principle" with no asset allocated yet - nothing is being
      // committed against inventory, so allocation (and its availability check) happens
      // later, when a specific asset is assigned to the draft contract.

      await prisma.bookingRequest.update({
        where: { id },
        data: {
          status: "approved",
          requestedAssetId: selectedAssetId ?? bookingRequest.requestedAssetId,
          history: appendHistory(bookingRequest.history, {
            at: at.toISOString(),
            actor: "manager",
            action: "approved",
            note,
          }),
        },
      });
    } else {
      if (terminal) {
        throw new ApiError("INVENTORY_CONFLICT", "This request has already been decided.");
      }
      await prisma.bookingRequest.update({
        where: { id },
        data: {
          status: "declined",
          history: appendHistory(bookingRequest.history, {
            at: at.toISOString(),
            actor: "manager",
            action: "declined",
            note,
          }),
        },
      });
    }

    const updated = await prisma.bookingRequest.findUniqueOrThrow({ where: { id } });
    return NextResponse.json(await buildBookingRequestDetail(updated));
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    console.error(error);
    return errorResponse(
      new ApiError("SERVICE_UNAVAILABLE", "Please try again. The service is temporarily unavailable."),
    );
  }
}
