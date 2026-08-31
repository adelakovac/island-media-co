import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/http";
import { withIdempotency } from "@/lib/idempotency";
import { serializeSession } from "@/lib/session";
import { now } from "@/lib/fixture-clock";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface RegisterInputBody {
  organisationName?: unknown;
  contactName?: unknown;
  email?: unknown;
}

export async function POST(request: Request) {
  try {
    return await withIdempotency(
      request,
      "auth.register",
      async () => {
        const body = (await request.json().catch(() => {
          throw new ApiError("VALIDATION_ERROR", "Request body must be valid JSON.");
        })) as RegisterInputBody;

        if (typeof body.organisationName !== "string" || body.organisationName.length < 2) {
          throw new ApiError("VALIDATION_ERROR", "organisationName must be at least 2 characters.");
        }
        if (typeof body.contactName !== "string" || body.contactName.length < 2) {
          throw new ApiError("VALIDATION_ERROR", "contactName must be at least 2 characters.");
        }
        if (typeof body.email !== "string" || !EMAIL_RE.test(body.email)) {
          throw new ApiError("VALIDATION_ERROR", "email must be a valid email address.");
        }

        const existingUser = await prisma.user.findUnique({ where: { email: body.email } });
        if (existingUser) {
          throw new ApiError("VALIDATION_ERROR", `email ${body.email} is already registered.`);
        }

        const createdAt = now();
        const { user, organisation } = await prisma.$transaction(async (tx) => {
          const organisation = await tx.organisation.create({
            data: { name: body.organisationName as string, createdAt, contractCount: 0 },
          });
          const user = await tx.user.create({
            data: {
              name: body.contactName as string,
              email: body.email as string,
              role: "client",
              organisationId: organisation.id,
              status: "active",
            },
          });
          return { user, organisation };
        });

        return { status: 201, body: serializeSession(user, organisation) };
      },
      { replayStatus: 200 },
    );
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    console.error(error);
    return errorResponse(
      new ApiError("SERVICE_UNAVAILABLE", "Please try again. The service is temporarily unavailable."),
    );
  }
}
