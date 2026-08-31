import type { PrismaClient } from "@prisma/client";
import { seedFixtures } from "../../prisma/seed-fixtures";

/** Wipes every table (FK-safe, child-first order) and reloads the candidate-pack fixtures. */
export async function resetDatabase(prisma: PrismaClient) {
  await prisma.proofRecord.deleteMany();
  await prisma.clientRequest.deleteMany();
  await prisma.serviceEvent.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.contractItem.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.bookingRequest.deleteMany();
  await prisma.outage.deleteMany();
  await prisma.hold.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.capacityPool.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organisation.deleteMany();
  await prisma.location.deleteMany();
  await prisma.mediaOwner.deleteMany();
  await prisma.idempotencyRecord.deleteMany();

  await seedFixtures(prisma);
}
