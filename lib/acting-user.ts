import { prisma } from "./prisma";
import { ApiError } from "./http";

const HEADER = "x-prototype-user-id";

/**
 * Resolves the X-Prototype-User-Id header against seeded Users. Throws
 * ApiError(FORBIDDEN) if the header is missing or names an unknown user -
 * production authentication is explicitly out of scope for this prototype.
 */
export async function requireActingUser(request: Request) {
  const userId = request.headers.get(HEADER);
  if (!userId) {
    throw new ApiError("FORBIDDEN", "X-Prototype-User-Id header is required.");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new ApiError("FORBIDDEN", `Unknown prototype user id: ${userId}`);
  }

  return user;
}
