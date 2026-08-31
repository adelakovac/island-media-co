import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { WORK_ORDER_INCLUDE, serializeWorkOrder } from "./work-orders";

type WorkOrderWithProof = Prisma.WorkOrderGetPayload<{ include: typeof WORK_ORDER_INCLUDE }>;

/** Same shape as serializeWorkOrder, plus organisationName - which client the job is for. */
export async function serializeFitterWorkOrders(workOrders: WorkOrderWithProof[]) {
  const organisations = await prisma.organisation.findMany({
    where: { id: { in: workOrders.map((workOrder) => workOrder.organisationId) } },
  });
  const nameById = new Map(organisations.map((organisation) => [organisation.id, organisation.name]));
  return workOrders.map((workOrder) => ({
    ...serializeWorkOrder(workOrder),
    organisationName: nameById.get(workOrder.organisationId) ?? workOrder.organisationId,
  }));
}

export async function serializeFitterWorkOrder(workOrder: WorkOrderWithProof) {
  const [result] = await serializeFitterWorkOrders([workOrder]);
  return result;
}
