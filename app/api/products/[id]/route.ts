import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/http";
import { requireDateRange } from "@/lib/dates";
import { computeProductAvailability, PRODUCT_INCLUDE, serializeProductDetail } from "@/lib/products";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const { startDate, endDate } = requireDateRange(searchParams.get("startDate"), searchParams.get("endDate"));

    const product = await prisma.product.findUnique({ where: { id }, include: PRODUCT_INCLUDE });
    if (!product) {
      throw new ApiError("NOT_FOUND", `Product ${id} was not found.`);
    }

    const { summary, assetSummaries } = computeProductAvailability(product, startDate, endDate);
    return NextResponse.json(serializeProductDetail(product, summary, assetSummaries));
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    console.error(error);
    return errorResponse(
      new ApiError("SERVICE_UNAVAILABLE", "Please try again. The service is temporarily unavailable."),
    );
  }
}
