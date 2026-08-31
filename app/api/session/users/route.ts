import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/http";

// Public and unauthenticated by design, like /session/switch: this is the
// prototype's own account switcher listing who it's possible to switch to
// (seeded users and anyone who has since self-registered via /auth/register),
// not a real user directory.
export async function GET() {
  try {
    const users = await prisma.user.findMany({
      where: { status: "active" },
      orderBy: { name: "asc" },
    });
    const organisations = await prisma.organisation.findMany({
      where: { id: { in: users.flatMap((user) => (user.organisationId ? [user.organisationId] : [])) } },
    });
    const organisationNameById = new Map(organisations.map((organisation) => [organisation.id, organisation.name]));

    return NextResponse.json({
      items: users.map((user) => ({
        id: user.id,
        name: user.name,
        role: user.role,
        organisationId: user.organisationId,
        organisationName: user.organisationId ? (organisationNameById.get(user.organisationId) ?? null) : null,
      })),
    });
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    console.error(error);
    return errorResponse(
      new ApiError("SERVICE_UNAVAILABLE", "Please try again. The service is temporarily unavailable."),
    );
  }
}
