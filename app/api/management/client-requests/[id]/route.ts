import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/http";
import { requireActingUser } from "@/lib/acting-user";
import { serializeClientRequest } from "@/lib/contracts";
import { cancelContract } from "@/lib/contract-cancellation";
import { appendHistory } from "@/lib/history";
import { now } from "@/lib/fixture-clock";

const ACTIONS = ["acknowledge", "decline"] as const;

interface ClientRequestDecisionBody {
  action?: unknown;
  note?: unknown;
}

async function requireManager(request: Request) {
  const actingUser = await requireActingUser(request);
  if (actingUser.role !== "manager") {
    throw new ApiError("FORBIDDEN", "Only manager users may access this record.");
  }
  return actingUser;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireManager(request);
    const { id } = await params;

    const clientRequest = await prisma.clientRequest.findUnique({ where: { id } });
    if (!clientRequest) {
      throw new ApiError("NOT_FOUND", `Client request ${id} was not found.`);
    }

    const body = (await request.json().catch(() => {
      throw new ApiError("VALIDATION_ERROR", "Request body must be valid JSON.");
    })) as ClientRequestDecisionBody;

    if (typeof body.action !== "string" || !ACTIONS.includes(body.action as (typeof ACTIONS)[number])) {
      throw new ApiError("VALIDATION_ERROR", `action must be one of: ${ACTIONS.join(", ")}.`);
    }
    const note =
      body.note === null || body.note === undefined
        ? null
        : typeof body.note === "string"
          ? body.note
          : (() => {
              throw new ApiError("VALIDATION_ERROR", "note must be a string or null.");
            })();

    const action = body.action as (typeof ACTIONS)[number];
    if (clientRequest.status !== "submitted") {
      throw new ApiError("INVENTORY_CONFLICT", "This client request has already been resolved.");
    }
    if (action === "decline" && !note) {
      throw new ApiError("VALIDATION_ERROR", "note is required when declining a client request.");
    }

    const at = now();
    const nextStatus = action === "acknowledge" ? "resolved" : "declined";

    await prisma.$transaction(async (tx) => {
      await tx.clientRequest.update({
        where: { id },
        data: {
          status: nextStatus,
          history: appendHistory(clientRequest.history, {
            at: at.toISOString(),
            actor: "manager",
            action: nextStatus,
            note,
          }),
        },
      });

      if (clientRequest.contractId) {
        const contract = await tx.contract.findUnique({ where: { id: clientRequest.contractId } });

        // A "contract change" request can have put the contract itself into
        // change_requested (see app/api/client/contracts/[id]/actions/route.ts) - clear
        // that back out regardless of whether the change is accepted or declined, since
        // either way the contract is no longer awaiting a manager response.
        if (contract && clientRequest.type === "contract_change" && contract.status === "change_requested") {
          // No prior-status column exists, but acceptedAt is only ever set once a client
          // has accepted - use it to tell which state the contract was in before the
          // change request bumped it to change_requested.
          const restoredStatus = contract.acceptedAt ? "accepted" : "issued";
          await tx.contract.update({
            where: { id: contract.id },
            data: {
              status: restoredStatus,
              history: appendHistory(contract.history, {
                at: at.toISOString(),
                actor: "manager",
                action: action === "acknowledge" ? "change_request_resolved" : "change_request_declined",
                note,
              }),
            },
          });
        }

        // A cancellation request never changes contract.status by itself (see the client
        // actions route) - it stays pending review. Approving it here is the actual
        // decision point: "acknowledge" executes the cancellation (and everything that
        // cascades from it - work orders, campaign, freed inventory); "decline" leaves
        // the contract running untouched.
        if (contract && clientRequest.type === "cancellation" && action === "acknowledge") {
          const contractWithItems = await tx.contract.findUniqueOrThrow({
            where: { id: contract.id },
            include: { items: true },
          });
          await cancelContract(tx, contractWithItems, note, at);
        }
      }
    });

    const updated = await prisma.clientRequest.findUniqueOrThrow({ where: { id } });
    return NextResponse.json(serializeClientRequest(updated));
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    console.error(error);
    return errorResponse(
      new ApiError("SERVICE_UNAVAILABLE", "Please try again. The service is temporarily unavailable."),
    );
  }
}
