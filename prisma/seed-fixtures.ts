import type { PrismaClient } from "@prisma/client";
import fixtures from "../fixtures/island-media-fixtures.json";

type HistoryEntry = {
  at: string;
  actor: string;
  action: string;
  note: string | null;
};

function date(value: string): Date {
  return new Date(value);
}

/** Loads the candidate-pack fixtures into `prisma`. Shared by the CLI seed script and the test suite's DB reset. */
export async function seedFixtures(prisma: PrismaClient) {
  for (const owner of fixtures.mediaOwners) {
    await prisma.mediaOwner.create({ data: { id: owner.id, name: owner.name } });
  }

  for (const location of fixtures.locations) {
    await prisma.location.create({ data: { id: location.id, name: location.name } });
  }

  for (const org of fixtures.organisations) {
    await prisma.organisation.create({
      data: {
        id: org.id,
        name: org.name,
        createdAt: date(org.createdAt),
        contractCount: org.contractCount,
      },
    });
  }

  for (const user of fixtures.users) {
    await prisma.user.create({
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organisationId: user.organisationId,
        status: user.status,
      },
    });
  }

  for (const product of fixtures.products) {
    await prisma.product.create({
      data: {
        id: product.id,
        name: product.name,
        mediaOwnerId: product.mediaOwnerId,
        mediaType: product.mediaType,
        locations: { connect: product.locationIds.map((id) => ({ id })) },
        allocationModel: product.allocationModel,
        description: product.description,
        rateCurrency: product.indicativeRate.currency,
        rateAmount: product.indicativeRate.amount,
        rateUnit: product.indicativeRate.unit,
        rateMonthlyEquivalent: product.indicativeRate.monthlyEquivalent,
        rateLabel: product.indicativeRate.label,
        minimumTermDays: product.minimumTermDays,
        creativeSpec: product.creativeSpec ? JSON.stringify(product.creativeSpec) : null,
      },
    });
  }

  for (const pool of fixtures.capacityPools) {
    await prisma.capacityPool.create({
      data: {
        id: pool.id,
        productId: pool.productId,
        name: pool.name,
        locationId: pool.locationId,
        capacity: pool.capacity,
        status: pool.status,
        verifiedAt: date(pool.verifiedAt),
        verificationSource: pool.verificationSource,
      },
    });
  }

  for (const asset of fixtures.assets) {
    await prisma.asset.create({
      data: {
        id: asset.id,
        productId: asset.productId,
        name: asset.name,
        locationId: asset.locationId,
        status: asset.status,
        verifiedAt: asset.verifiedAt ? date(asset.verifiedAt) : null,
        verificationSource: asset.verificationSource ?? null,
        note: "note" in asset ? ((asset as { note?: string }).note ?? null) : null,
      },
    });
  }

  for (const booking of fixtures.bookings) {
    await prisma.booking.create({
      data: {
        id: booking.id,
        campaignName: booking.campaignName,
        productId: booking.productId,
        assetId: (booking as { assetId?: string }).assetId ?? null,
        capacityPoolId: (booking as { capacityPoolId?: string }).capacityPoolId ?? null,
        capacityUnits: (booking as { capacityUnits?: number }).capacityUnits ?? null,
        startDate: date(booking.startDate),
        endDate: date(booking.endDate),
        status: booking.status,
      },
    });
  }

  for (const hold of fixtures.holds) {
    await prisma.hold.create({
      data: {
        id: hold.id,
        productId: hold.productId,
        assetId: (hold as { assetId?: string }).assetId ?? null,
        capacityPoolId: (hold as { capacityPoolId?: string }).capacityPoolId ?? null,
        capacityUnits: (hold as { capacityUnits?: number }).capacityUnits ?? null,
        startDate: date(hold.startDate),
        endDate: date(hold.endDate),
        expiresAt: date(hold.expiresAt),
        status: hold.status,
      },
    });
  }

  for (const outage of fixtures.outages) {
    await prisma.outage.create({
      data: {
        id: outage.id,
        assetId: outage.assetId,
        startDate: date(outage.startDate),
        endDate: date(outage.endDate),
        reason: outage.reason,
        status: outage.status,
      },
    });
  }

  for (const request of fixtures.bookingRequests) {
    await prisma.bookingRequest.create({
      data: {
        id: request.id,
        idempotencyKey: request.idempotencyKey,
        organisationId: request.organisationId,
        advertiserName: request.advertiser.name,
        advertiserContactName: request.advertiser.contactName,
        advertiserEmail: request.advertiser.email,
        productId: request.productId,
        requestedAssetId: request.requestedAssetId,
        startDate: date(request.startDate),
        endDate: date(request.endDate),
        budget: request.budget,
        objective: request.objective,
        notes: request.notes,
        status: request.status,
        createdAt: date(request.createdAt),
        history: JSON.stringify(request.history as HistoryEntry[]),
      },
    });
  }

  for (const contract of fixtures.contracts) {
    await prisma.contract.create({
      data: {
        id: contract.id,
        organisationId: contract.organisationId,
        bookingRequestId: contract.bookingRequestId,
        status: contract.status,
        version: contract.version,
        startDate: date(contract.startDate),
        endDate: date(contract.endDate),
        currency: contract.currency,
        total: contract.total,
        issuedAt: contract.issuedAt ? date(contract.issuedAt) : null,
        acceptedAt: contract.acceptedAt ? date(contract.acceptedAt) : null,
        activatedAt: contract.activatedAt ? date(contract.activatedAt) : null,
        history: JSON.stringify(contract.history as HistoryEntry[]),
        items: {
          create: contract.items.map((item) => ({
            id: item.id,
            productId: item.productId,
            assetId: (item as { assetId?: string }).assetId ?? null,
            capacityPoolId: (item as { capacityPoolId?: string }).capacityPoolId ?? null,
            quantity: item.quantity,
            unitRate: item.unitRate,
            rateUnit: item.rateUnit,
            lineTotal: item.lineTotal,
          })),
        },
      },
    });
  }

  for (const campaign of fixtures.campaigns) {
    await prisma.campaign.create({
      data: {
        id: campaign.id,
        organisationId: campaign.organisationId,
        contractId: campaign.contractId,
        bookingId: campaign.bookingId,
        name: campaign.name,
        status: campaign.status,
        currentStage: campaign.currentStage,
        clientVisible: campaign.clientVisible,
      },
    });
  }

  for (const workOrder of fixtures.workOrders) {
    await prisma.workOrder.create({
      data: {
        id: workOrder.id,
        campaignId: workOrder.campaignId,
        contractId: workOrder.contractId,
        organisationId: workOrder.organisationId,
        type: workOrder.type,
        status: workOrder.status,
        assignedUserId: workOrder.assignedUserId,
        assetId: workOrder.assetId,
        scheduledStart: date(workOrder.scheduledStart),
        scheduledEnd: date(workOrder.scheduledEnd),
        locationLabel: workOrder.locationLabel,
        instructions: workOrder.instructions,
        internalNotes: workOrder.internalNotes,
        completionNote: workOrder.completionNote,
        history: JSON.stringify(workOrder.history as HistoryEntry[]),
      },
    });
  }

  for (const event of fixtures.serviceEvents) {
    await prisma.serviceEvent.create({
      data: {
        id: event.id,
        organisationId: event.organisationId,
        contractId: event.contractId,
        campaignId: event.campaignId,
        workOrderId: event.workOrderId,
        at: date(event.at),
        type: event.type,
        title: event.title,
        clientVisible: event.clientVisible,
        clientSummary: event.clientSummary,
      },
    });
  }

  for (const clientRequest of fixtures.clientRequests) {
    await prisma.clientRequest.create({
      data: {
        id: clientRequest.id,
        organisationId: clientRequest.organisationId,
        contractId: clientRequest.contractId,
        type: clientRequest.type,
        status: clientRequest.status,
        createdAt: date(clientRequest.createdAt),
        summary: clientRequest.summary,
        history: JSON.stringify(clientRequest.history as HistoryEntry[]),
      },
    });
  }

  for (const proof of fixtures.proofRecords as Array<{
    id: string;
    workOrderId: string;
    fileName: string;
    previewUrl?: string | null;
    completionNote: string;
    createdAt: string;
    createdByUserId: string;
  }>) {
    await prisma.proofRecord.create({
      data: {
        id: proof.id,
        workOrderId: proof.workOrderId,
        fileName: proof.fileName,
        previewUrl: proof.previewUrl ?? null,
        completionNote: proof.completionNote,
        createdAt: date(proof.createdAt),
        createdByUserId: proof.createdByUserId,
      },
    });
  }
}
