import type { Contract, ContractItem, ProofRecord, ClientRequest } from "@prisma/client";
import { prisma } from "./prisma";

export function contractActionRequired(status: string): string | null {
  if (status === "issued") return "Review and accept this contract.";
  if (status === "change_requested") return "Awaiting manager response to your requested changes.";
  return null;
}

export function serializeContractItem(item: ContractItem) {
  return {
    id: item.id,
    productId: item.productId,
    assetId: item.assetId,
    capacityPoolId: item.capacityPoolId,
    quantity: item.quantity,
    unitRate: item.unitRate,
    rateUnit: item.rateUnit,
    lineTotal: item.lineTotal,
  };
}

export function serializeContract(contract: Contract & { items: ContractItem[] }) {
  return {
    id: contract.id,
    organisationId: contract.organisationId,
    bookingRequestId: contract.bookingRequestId,
    status: contract.status,
    version: contract.version,
    startDate: contract.startDate.toISOString().slice(0, 10),
    endDate: contract.endDate.toISOString().slice(0, 10),
    currency: contract.currency,
    total: contract.total,
    items: contract.items.map(serializeContractItem),
    history: JSON.parse(contract.history),
  };
}

export function serializeContractSummary(contract: Contract) {
  return {
    id: contract.id,
    status: contract.status,
    startDate: contract.startDate.toISOString().slice(0, 10),
    endDate: contract.endDate.toISOString().slice(0, 10),
    total: contract.total,
    actionRequired: contractActionRequired(contract.status),
  };
}

/** Resolves productId/assetId/capacityPoolId on each item to their human-readable names, for detail views. */
export async function enrichContractItems<T extends { productId: string; assetId: string | null; capacityPoolId: string | null }>(
  items: T[],
) {
  const [products, assets, capacityPools] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: items.map((item) => item.productId) } } }),
    prisma.asset.findMany({ where: { id: { in: items.flatMap((item) => (item.assetId ? [item.assetId] : [])) } } }),
    prisma.capacityPool.findMany({
      where: { id: { in: items.flatMap((item) => (item.capacityPoolId ? [item.capacityPoolId] : [])) } },
    }),
  ]);
  const productNameById = new Map(products.map((product) => [product.id, product.name]));
  const assetNameById = new Map(assets.map((asset) => [asset.id, asset.name]));
  const capacityPoolNameById = new Map(capacityPools.map((pool) => [pool.id, pool.name]));

  return items.map((item) => ({
    ...item,
    productName: productNameById.get(item.productId) ?? item.productId,
    assetName: item.assetId ? (assetNameById.get(item.assetId) ?? null) : null,
    capacityPoolName: item.capacityPoolId ? (capacityPoolNameById.get(item.capacityPoolId) ?? null) : null,
  }));
}

export function serializeProofRecord(proof: ProofRecord) {
  return {
    id: proof.id,
    workOrderId: proof.workOrderId,
    fileName: proof.fileName,
    previewUrl: proof.previewUrl,
    completionNote: proof.completionNote,
    createdAt: proof.createdAt.toISOString(),
    createdByUserId: proof.createdByUserId,
  };
}

export function serializeClientRequest(clientRequest: ClientRequest) {
  return {
    id: clientRequest.id,
    organisationId: clientRequest.organisationId,
    contractId: clientRequest.contractId,
    type: clientRequest.type,
    status: clientRequest.status,
    createdAt: clientRequest.createdAt.toISOString(),
    summary: clientRequest.summary,
    history: JSON.parse(clientRequest.history),
  };
}
