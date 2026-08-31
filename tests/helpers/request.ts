import { NextRequest } from "next/server";

interface MakeRequestOptions {
  method?: string;
  userId?: string;
  idempotencyKey?: string;
  body?: unknown;
}

/** Builds a NextRequest for calling an App Router route handler directly in tests, no HTTP server involved. */
export function makeRequest(url: string, options: MakeRequestOptions = {}): NextRequest {
  const headers: Record<string, string> = {};
  if (options.userId) headers["x-prototype-user-id"] = options.userId;
  if (options.idempotencyKey) headers["idempotency-key"] = options.idempotencyKey;
  const isFormData = options.body instanceof FormData;
  if (options.body !== undefined && !isFormData) headers["content-type"] = "application/json";

  return new NextRequest(`http://localhost${url}`, {
    method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
    headers,
    body:
      options.body !== undefined ? (isFormData ? (options.body as FormData) : JSON.stringify(options.body)) : undefined,
  });
}

/** params helper matching Next 15+'s `{ params: Promise<...> }` route signature. */
export function routeParams<T extends object>(params: T): { params: Promise<T> } {
  return { params: Promise.resolve(params) };
}
