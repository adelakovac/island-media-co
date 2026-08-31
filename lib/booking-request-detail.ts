import type { BookingRequest } from "@prisma/client";
import { prisma } from "./prisma";
import { PRODUCT_INCLUDE, computeProductAvailability, serializeProductDetail } from "./products";
import { assetAvailability } from "./availability";
import { serializeOrganisation } from "./session";
import { serializeBookingRequest } from "./booking-requests";

/**
 * `product.availability` is the rolled-up availability across all of the
 * product's inventory for the requested dates. `currentAvailability` is
 * availability for the SPECIFIC thing being requested: the requested asset's
 * own availability when requestedAssetId is set, otherwise the same rollup.
 * This lets a manager see both "is anything available" and "is the thing the
 * advertiser actually asked for available" - relevant e.g. for request-002,
 * where door-a is cleanly available but the specifically requested door-b
 * needs owner confirmation.
 */
export async function buildBookingRequestDetail(request: BookingRequest) {
  const [organisation, product, contract] = await Promise.all([
    prisma.organisation.findUniqueOrThrow({ where: { id: request.organisationId } }),
    prisma.product.findUniqueOrThrow({ where: { id: request.productId }, include: PRODUCT_INCLUDE }),
    prisma.contract.findUnique({ where: { bookingRequestId: request.id } }),
  ]);

  const { summary, assetSummaries } = computeProductAvailability(product, request.startDate, request.endDate);

  let currentAvailability = summary;
  if (request.requestedAssetId) {
    const match = assetSummaries.find((entry) => entry.asset.id === request.requestedAssetId);
    if (match) {
      currentAvailability = match.summary;
    } else {
      const asset = await prisma.asset.findUnique({
        where: { id: request.requestedAssetId },
        include: { bookings: true, holds: true, outages: true },
      });
      currentAvailability = asset ? assetAvailability(asset, request.startDate, request.endDate) : summary;
    }
  }

  return {
    ...serializeBookingRequest(request),
    draftContractId: contract?.id ?? request.draftContractId,
    contractStatus: contract?.status ?? null,
    organisation: serializeOrganisation(organisation),
    product: { ...serializeProductDetail(product, summary, assetSummaries), capacityPoolId: product.capacityPool?.id ?? null },
    currentAvailability,
  };
}
