import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { ApiError } from "./http";

export function requireIdempotencyKey(request: Request): string {
  const key = request.headers.get("idempotency-key");
  if (!key || key.length < 8) {
    throw new ApiError("VALIDATION_ERROR", "Idempotency-Key header is required and must be at least 8 characters.");
  }
  return key;
}

/**
 * Runs `handler` at most once per (Idempotency-Key, scope): a repeated key
 * replays the cached response instead of re-running the mutation. Only
 * successful outcomes are cached - a failed attempt (handler throws) can be
 * retried with the same key.
 */
export async function withIdempotency(
  request: Request,
  scope: string,
  handler: () => Promise<{ status: number; body: unknown }>,
  options?: { replayStatus?: number },
): Promise<NextResponse> {
  const key = requireIdempotencyKey(request);

  const existing = await prisma.idempotencyRecord.findUnique({ where: { key_scope: { key, scope } } });
  if (existing) {
    return NextResponse.json(JSON.parse(existing.body), { status: options?.replayStatus ?? existing.status });
  }

  const result = await handler();

  try {
    await prisma.idempotencyRecord.create({
      data: { key, scope, status: result.status, body: JSON.stringify(result.body) },
    });
  } catch {
    // Another concurrent request with the same key already cached a result; ignore.
  }

  return NextResponse.json(result.body, { status: result.status });
}
