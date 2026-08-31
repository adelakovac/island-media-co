import { Prisma } from "@prisma/client";
import {
  assetAvailability,
  capacityPoolAvailability,
  rollupExclusiveAssetAvailability,
  type AvailabilitySummary,
} from "./availability";

export const PRODUCT_INCLUDE = {
  mediaOwner: true,
  locations: true,
  assets: { include: { bookings: true, holds: true, outages: true } },
  capacityPool: { include: { bookings: true, holds: true } },
} satisfies Prisma.ProductInclude;

export type ProductWithRelations = Prisma.ProductGetPayload<{ include: typeof PRODUCT_INCLUDE }>;

const noInventory: AvailabilitySummary = {
  state: "unavailable",
  reason: "No inventory is configured for this product.",
  calculatedAt: new Date().toISOString(),
  availableAssetCount: null,
  availableCapacity: null,
  totalCapacity: null,
  freshestVerificationAt: null,
};

export function computeProductAvailability(
  product: ProductWithRelations,
  queryStart: Date,
  queryEnd: Date,
): {
  summary: AvailabilitySummary;
  assetSummaries: Array<{ asset: ProductWithRelations["assets"][number]; summary: AvailabilitySummary }>;
} {
  if (product.allocationModel === "capacity_pool") {
    if (!product.capacityPool) {
      return { summary: noInventory, assetSummaries: [] };
    }
    return { summary: capacityPoolAvailability(product.capacityPool, queryStart, queryEnd), assetSummaries: [] };
  }

  const assetSummaries = product.assets.map((asset) => ({
    asset,
    summary: assetAvailability(asset, queryStart, queryEnd),
  }));
  const summary = rollupExclusiveAssetAvailability(assetSummaries.map((entry) => entry.summary));
  return { summary, assetSummaries };
}

export function serializeIndicativeRate(product: ProductWithRelations) {
  return {
    currency: product.rateCurrency,
    amount: product.rateAmount,
    unit: product.rateUnit,
    monthlyEquivalent: product.rateMonthlyEquivalent,
    label: product.rateLabel,
  };
}

export function serializeProductSearchResult(product: ProductWithRelations, availability: AvailabilitySummary) {
  return {
    id: product.id,
    name: product.name,
    mediaOwnerName: product.mediaOwner.name,
    mediaType: product.mediaType,
    locationNames: product.locations.map((location) => location.name),
    allocationModel: product.allocationModel,
    indicativeRate: serializeIndicativeRate(product),
    minimumTermDays: product.minimumTermDays,
    availability,
  };
}

function serializeAssetOption(
  asset: ProductWithRelations["assets"][number],
  availability: AvailabilitySummary,
) {
  return {
    id: asset.id,
    name: asset.name,
    status: asset.status,
    verifiedAt: asset.verifiedAt ? asset.verifiedAt.toISOString() : null,
    verificationSource: asset.verificationSource,
    note: asset.note,
    availability,
  };
}

export function serializeProductDetail(
  product: ProductWithRelations,
  availability: AvailabilitySummary,
  assetSummaries: Array<{ asset: ProductWithRelations["assets"][number]; summary: AvailabilitySummary }>,
) {
  return {
    ...serializeProductSearchResult(product, availability),
    description: product.description,
    creativeSpec: product.creativeSpec ? JSON.parse(product.creativeSpec) : null,
    assetOptions: assetSummaries.map(({ asset, summary }) => serializeAssetOption(asset, summary)),
  };
}
