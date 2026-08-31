import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/http";
import { serializeSession } from "@/lib/session";

interface SessionSwitchBody {
  userId?: unknown;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => {
      throw new ApiError("VALIDATION_ERROR", "Request body must be valid JSON.");
    })) as SessionSwitchBody;

    if (typeof body.userId !== "string" || body.userId.length === 0) {
      throw new ApiError("VALIDATION_ERROR", "userId is required.");
    }

    const user = await prisma.user.findUnique({ where: { id: body.userId } });
    if (!user) {
      throw new ApiError("NOT_FOUND", `User ${body.userId} was not found.`);
    }

    const organisation = user.organisationId
      ? await prisma.organisation.findUnique({ where: { id: user.organisationId } })
      : null;

    return NextResponse.json(serializeSession(user, organisation));
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    console.error(error);
    return errorResponse(
      new ApiError("SERVICE_UNAVAILABLE", "Please try again. The service is temporarily unavailable."),
    );
  }
}
