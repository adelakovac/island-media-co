-- CreateTable
CREATE TABLE "MediaOwner" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Organisation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "contractCount" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "organisationId" TEXT,
    "status" TEXT NOT NULL,
    CONSTRAINT "User_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "mediaOwnerId" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "allocationModel" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rateCurrency" TEXT NOT NULL,
    "rateAmount" REAL,
    "rateUnit" TEXT,
    "rateMonthlyEquivalent" REAL,
    "rateLabel" TEXT NOT NULL,
    "minimumTermDays" INTEGER NOT NULL,
    "creativeSpec" TEXT,
    CONSTRAINT "Product_mediaOwnerId_fkey" FOREIGN KEY ("mediaOwnerId") REFERENCES "MediaOwner" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "verifiedAt" DATETIME,
    "verificationSource" TEXT,
    "note" TEXT,
    CONSTRAINT "Asset_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Asset_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CapacityPool" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "verifiedAt" DATETIME,
    "verificationSource" TEXT,
    CONSTRAINT "CapacityPool_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CapacityPool_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignName" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "assetId" TEXT,
    "capacityPoolId" TEXT,
    "capacityUnits" INTEGER,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    CONSTRAINT "Booking_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Booking_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Booking_capacityPoolId_fkey" FOREIGN KEY ("capacityPoolId") REFERENCES "CapacityPool" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Hold" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "assetId" TEXT,
    "capacityPoolId" TEXT,
    "capacityUnits" INTEGER,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    CONSTRAINT "Hold_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Hold_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Hold_capacityPoolId_fkey" FOREIGN KEY ("capacityPoolId") REFERENCES "CapacityPool" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Outage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    CONSTRAINT "Outage_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BookingRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "idempotencyKey" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "advertiserName" TEXT NOT NULL,
    "advertiserContactName" TEXT NOT NULL,
    "advertiserEmail" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "requestedAssetId" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "budget" REAL NOT NULL,
    "objective" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "draftContractId" TEXT,
    "history" TEXT NOT NULL,
    CONSTRAINT "BookingRequest_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BookingRequest_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BookingRequest_requestedAssetId_fkey" FOREIGN KEY ("requestedAssetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "bookingRequestId" TEXT,
    "status" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "currency" TEXT NOT NULL,
    "total" REAL NOT NULL,
    "issuedAt" DATETIME,
    "acceptedAt" DATETIME,
    "activatedAt" DATETIME,
    "history" TEXT NOT NULL,
    CONSTRAINT "Contract_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Contract_bookingRequestId_fkey" FOREIGN KEY ("bookingRequestId") REFERENCES "BookingRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContractItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "assetId" TEXT,
    "capacityPoolId" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitRate" REAL,
    "rateUnit" TEXT,
    "lineTotal" REAL NOT NULL,
    CONSTRAINT "ContractItem_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ContractItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ContractItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ContractItem_capacityPoolId_fkey" FOREIGN KEY ("capacityPoolId") REFERENCES "CapacityPool" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "contractId" TEXT,
    "bookingId" TEXT,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentStage" TEXT NOT NULL,
    "clientVisible" BOOLEAN NOT NULL,
    CONSTRAINT "Campaign_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Campaign_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Campaign_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "assignedUserId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "scheduledStart" DATETIME NOT NULL,
    "scheduledEnd" DATETIME NOT NULL,
    "locationLabel" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "internalNotes" TEXT,
    "completionNote" TEXT,
    "history" TEXT NOT NULL,
    CONSTRAINT "WorkOrder_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkOrder_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkOrder_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkOrder_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkOrder_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ServiceEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "contractId" TEXT,
    "campaignId" TEXT,
    "workOrderId" TEXT,
    "at" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "clientVisible" BOOLEAN NOT NULL,
    "clientSummary" TEXT,
    CONSTRAINT "ServiceEvent_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ServiceEvent_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ServiceEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ServiceEvent_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClientRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "contractId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "summary" TEXT NOT NULL,
    "history" TEXT NOT NULL,
    CONSTRAINT "ClientRequest_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ClientRequest_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProofRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workOrderId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "previewUrl" TEXT,
    "completionNote" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    CONSTRAINT "ProofRecord_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProofRecord_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_LocationToProduct" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_LocationToProduct_A_fkey" FOREIGN KEY ("A") REFERENCES "Location" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_LocationToProduct_B_fkey" FOREIGN KEY ("B") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CapacityPool_productId_key" ON "CapacityPool"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingRequest_idempotencyKey_key" ON "BookingRequest"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "BookingRequest_draftContractId_key" ON "BookingRequest"("draftContractId");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_bookingRequestId_key" ON "Contract"("bookingRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_contractId_key" ON "Campaign"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_bookingId_key" ON "Campaign"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "_LocationToProduct_AB_unique" ON "_LocationToProduct"("A", "B");

-- CreateIndex
CREATE INDEX "_LocationToProduct_B_index" ON "_LocationToProduct"("B");
