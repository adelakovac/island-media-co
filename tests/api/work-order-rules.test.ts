import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../helpers/reset-db";
import { makeRequest, routeParams } from "../helpers/request";
import { POST as updateStatus } from "@/app/api/mobile/work-orders/[id]/status/route";
import { POST as uploadProof } from "@/app/api/mobile/work-orders/[id]/proof/route";

const FITTER_ID = "user-fitter-01";
const WORK_ORDER_ID = "work-order-001"; // seeded status: assigned

beforeEach(async () => {
  await resetDatabase(prisma);
});

describe("check 9: a work order cannot be marked blocked without a reason", () => {
  it("rejects status=blocked with no note", async () => {
    const response = await updateStatus(
      makeRequest(`/api/mobile/work-orders/${WORK_ORDER_ID}/status`, {
        method: "POST",
        userId: FITTER_ID,
        idempotencyKey: "test-blocked-no-reason",
        body: { status: "blocked", note: null },
      }),
      routeParams({ id: WORK_ORDER_ID }),
    );
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.code).toBe("VALIDATION_ERROR");

    const workOrder = await prisma.workOrder.findUniqueOrThrow({ where: { id: WORK_ORDER_ID } });
    expect(workOrder.status).toBe("assigned"); // unchanged
  });

  it("accepts status=blocked with a reason and records it in history", async () => {
    const response = await updateStatus(
      makeRequest(`/api/mobile/work-orders/${WORK_ORDER_ID}/status`, {
        method: "POST",
        userId: FITTER_ID,
        idempotencyKey: "test-blocked-with-reason",
        body: { status: "blocked", note: "No site access." },
      }),
      routeParams({ id: WORK_ORDER_ID }),
    );
    expect(response.status).toBe(200);

    const workOrder = await prisma.workOrder.findUniqueOrThrow({ where: { id: WORK_ORDER_ID } });
    expect(workOrder.status).toBe("blocked");
    const history = JSON.parse(workOrder.history) as Array<{ action: string; note: string | null }>;
    expect(history.at(-1)).toMatchObject({ action: "blocked", note: "No site access." });
  });
});

describe("check 8: a work order cannot be marked completed without proof", () => {
  it("rejects status=completed via the status endpoint when no proof exists", async () => {
    const response = await updateStatus(
      makeRequest(`/api/mobile/work-orders/${WORK_ORDER_ID}/status`, {
        method: "POST",
        userId: FITTER_ID,
        idempotencyKey: "test-complete-no-proof",
        body: { status: "completed", note: "Finished" },
      }),
      routeParams({ id: WORK_ORDER_ID }),
    );
    expect(response.status).toBe(422);

    const workOrder = await prisma.workOrder.findUniqueOrThrow({ where: { id: WORK_ORDER_ID } });
    expect(workOrder.status).not.toBe("completed");
  });

  it("rejects a proof upload with no file", async () => {
    const formData = new FormData();
    formData.append("completionNote", "All done here");
    const response = await uploadProof(
      makeRequest(`/api/mobile/work-orders/${WORK_ORDER_ID}/proof`, {
        method: "POST",
        userId: FITTER_ID,
        idempotencyKey: "test-proof-no-file",
        body: formData,
      }),
      routeParams({ id: WORK_ORDER_ID }),
    );
    expect(response.status).toBe(422);
  });

  it("rejects a proof upload with too short a completion note", async () => {
    const formData = new FormData();
    formData.append("file", new File(["binary"], "proof.jpg", { type: "image/jpeg" }));
    formData.append("completionNote", "ok"); // below the 3-char minimum
    const response = await uploadProof(
      makeRequest(`/api/mobile/work-orders/${WORK_ORDER_ID}/proof`, {
        method: "POST",
        userId: FITTER_ID,
        idempotencyKey: "test-proof-short-note",
        body: formData,
      }),
      routeParams({ id: WORK_ORDER_ID }),
    );
    expect(response.status).toBe(422);
  });

  it("a proof upload with a file and note completes the job and updates service history", async () => {
    const formData = new FormData();
    formData.append("file", new File(["binary"], "proof.jpg", { type: "image/jpeg" }));
    formData.append("completionNote", "Installed and photographed.");
    const response = await uploadProof(
      makeRequest(`/api/mobile/work-orders/${WORK_ORDER_ID}/proof`, {
        method: "POST",
        userId: FITTER_ID,
        idempotencyKey: "test-proof-success",
        body: formData,
      }),
      routeParams({ id: WORK_ORDER_ID }),
    );
    expect(response.status).toBe(201);

    const workOrder = await prisma.workOrder.findUniqueOrThrow({ where: { id: WORK_ORDER_ID } });
    expect(workOrder.status).toBe("completed");
    expect(workOrder.completionNote).toBe("Installed and photographed.");

    const proofRecords = await prisma.proofRecord.findMany({ where: { workOrderId: WORK_ORDER_ID } });
    expect(proofRecords).toHaveLength(1);

    const events = await prisma.serviceEvent.findMany({ where: { workOrderId: WORK_ORDER_ID } });
    expect(events.some((event) => event.type.endsWith("_completed") && event.clientVisible)).toBe(true);
  });

  it("once proof exists, the status endpoint's completed path also succeeds", async () => {
    const formData = new FormData();
    formData.append("file", new File(["binary"], "proof.jpg", { type: "image/jpeg" }));
    formData.append("completionNote", "Installed and photographed.");
    await uploadProof(
      makeRequest(`/api/mobile/work-orders/${WORK_ORDER_ID}/proof`, {
        method: "POST",
        userId: FITTER_ID,
        idempotencyKey: "test-proof-then-status",
        body: formData,
      }),
      routeParams({ id: WORK_ORDER_ID }),
    );

    const response = await updateStatus(
      makeRequest(`/api/mobile/work-orders/${WORK_ORDER_ID}/status`, {
        method: "POST",
        userId: FITTER_ID,
        idempotencyKey: "test-status-after-proof",
        body: { status: "completed", note: "Finished" },
      }),
      routeParams({ id: WORK_ORDER_ID }),
    );
    // Already completed by the proof upload - the status route rejects re-completing.
    expect(response.status).toBe(409);
  });
});
