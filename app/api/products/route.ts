import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/http";
import { requireDateRange } from "@/lib/dates";
import { computeProductAvailability, PRODUCT_INCLUDE, serializeProductSearchResult } from "@/lib/products";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const { startDate, endDate } = requireDateRange(searchParams.get("startDate"), searchParams.get("endDate"));
    const mediaType = searchParams.get("mediaType");
    const locationId = searchParams.get("locationId");

    let maxMonthlyBudget: number | null = null;
    const maxMonthlyBudgetRaw = searchParams.get("maxMonthlyBudget");
    if (maxMonthlyBudgetRaw !== null) {
      const parsed = Number(maxMonthlyBudgetRaw);
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new ApiError("VALIDATION_ERROR", "maxMonthlyBudget must be a non-negative number.");
      }
      maxMonthlyBudget = parsed;
    }

    const where: Prisma.ProductWhereInput = {};
    if (mediaType) where.mediaType = mediaType;
    if (locationId) where.locations = { some: { id: locationId } };
    // Products with no known monthly-equivalent rate ("price on request") are
    // excluded once a budget filter is applied, since affordability can't be
    // confirmed - this comparison naturally drops NULL rates at the SQL level.
    if (maxMonthlyBudget !== null) where.rateMonthlyEquivalent = { lte: maxMonthlyBudget };

    const products = await prisma.product.findMany({
      where,
      include: PRODUCT_INCLUDE,
      orderBy: { id: "asc" },
    });

    const items = products.map((product) => {
      const { summary } = computeProductAvailability(product, startDate, endDate);
      return serializeProductSearchResult(product, summary);
    });

    return NextResponse.json({
      query: {
        startDate: searchParams.get("startDate"),
        endDate: searchParams.get("endDate"),
        mediaType: mediaType ?? null,
        locationId: locationId ?? null,
        maxMonthlyBudget,
      },
      items,
    });
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    console.error(error);
    return errorResponse(
      new ApiError("SERVICE_UNAVAILABLE", "Please try again. The service is temporarily unavailable."),
    );
  }
}
