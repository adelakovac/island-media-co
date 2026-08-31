import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../helpers/reset-db";
import { makeRequest, routeParams } from "../helpers/request";
import { GET as getContract } from "@/app/api/client/contracts/[id]/route";
import { POST as contractAction } from "@/app/api/client/contracts/[id]/actions/route";
import { GET as listContracts } from "@/app/api/client/contracts/route";

beforeEach(async () => {
  await resetDatabase(prisma);
});

describe("check 7: a client cannot view another organisation's contract or booking data", () => {
  // contract-001 belongs to org-lighthouse; user-client-oaklegal belongs to org-oak-legal.
  it("returns FORBIDDEN when reading another organisation's contract detail", async () => {
    const response = await getContract(
      makeRequest("/api/client/contracts/contract-001", { userId: "user-client-oaklegal" }),
      routeParams({ id: "contract-001" }),
    );
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe("FORBIDDEN");
  });

  it("returns FORBIDDEN when attempting to act on another organisation's contract", async () => {
    const response = await contractAction(
      makeRequest("/api/client/contracts/contract-001/actions", {
        method: "POST",
        userId: "user-client-oaklegal",
        idempotencyKey: "test-cross-org-action-1",
        body: { action: "accept", note: null },
      }),
      routeParams({ id: "contract-001" }),
    );
    expect(response.status).toBe(403);

    // Confirm the contract was genuinely untouched.
    const contract = await prisma.contract.findUniqueOrThrow({ where: { id: "contract-001" } });
    expect(contract.status).toBe("issued");
  });

  it("the rightful owner can read their own contract", async () => {
    const response = await getContract(
      makeRequest("/api/client/contracts/contract-001", { userId: "user-client-lighthouse" }),
      routeParams({ id: "contract-001" }),
    );
    expect(response.status).toBe(200);
  });

  it("a contract list never includes another organisation's contracts", async () => {
    const response = await listContracts(makeRequest("/api/client/contracts", { userId: "user-client-oaklegal" }));
    expect(response.status).toBe(200);
    const body = await response.json();
    const ids = body.items.map((item: { id: string }) => item.id);
    expect(ids).toContain("contract-002"); // org-oak-legal's own contract
    expect(ids).not.toContain("contract-001"); // belongs to org-lighthouse
  });
});
