import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../helpers/reset-db";
import { makeRequest } from "../helpers/request";
import { GET as managementDashboard } from "@/app/api/management/dashboard/route";
import { GET as managementBookingRequests } from "@/app/api/management/booking-requests/route";
import { GET as fitterWorkOrders } from "@/app/api/mobile/work-orders/route";
import { GET as clientContracts } from "@/app/api/client/contracts/route";

beforeEach(async () => {
  await resetDatabase(prisma);
});

describe("check 10: role-based access is enforced correctly", () => {
  it("a fitter cannot open the management dashboard", async () => {
    const response = await managementDashboard(makeRequest("/api/management/dashboard", { userId: "user-fitter-01" }));
    expect(response.status).toBe(403);
  });

  it("a client cannot list management booking requests", async () => {
    const response = await managementBookingRequests(
      makeRequest("/api/management/booking-requests", { userId: "user-client-lighthouse" }),
    );
    expect(response.status).toBe(403);
  });

  it("a manager cannot open the fitter's mobile work-order list", async () => {
    const response = await fitterWorkOrders(makeRequest("/api/mobile/work-orders", { userId: "user-manager-01" }));
    expect(response.status).toBe(403);
  });

  it("a fitter cannot read client-portal contract data", async () => {
    const response = await clientContracts(makeRequest("/api/client/contracts", { userId: "user-fitter-01" }));
    expect(response.status).toBe(403);
  });

  it("an unauthenticated request (no X-Prototype-User-Id) is rejected", async () => {
    const response = await managementDashboard(makeRequest("/api/management/dashboard"));
    expect(response.status).toBe(403);
  });

  it("an unknown user id is rejected", async () => {
    const response = await managementDashboard(makeRequest("/api/management/dashboard", { userId: "not-a-real-user" }));
    expect(response.status).toBe(403);
  });

  it("the correct role for each surface is let through", async () => {
    const manager = await managementDashboard(makeRequest("/api/management/dashboard", { userId: "user-manager-01" }));
    expect(manager.status).toBe(200);

    const fitter = await fitterWorkOrders(makeRequest("/api/mobile/work-orders", { userId: "user-fitter-01" }));
    expect(fitter.status).toBe(200);

    const client = await clientContracts(makeRequest("/api/client/contracts", { userId: "user-client-lighthouse" }));
    expect(client.status).toBe(200);
  });
});
