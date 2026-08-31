export interface ApiErrorBody {
  code: string;
  message: string;
  details?: Record<string, unknown> | null;
}

export class ApiClientError extends Error {
  status: number;
  code: string;
  details: Record<string, unknown> | null;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.status = status;
    this.code = body.code;
    this.details = body.details ?? null;
  }
}

interface RequestOptions {
  method?: string;
  userId?: string | null;
  idempotencyKey?: string;
  body?: unknown;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {};
  // FormData sets its own multipart Content-Type (with boundary) - never override it.
  if (options.body !== undefined && !isFormData) headers["Content-Type"] = "application/json";
  if (options.userId) headers["X-Prototype-User-Id"] = options.userId;
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

  const response = await fetch(path, {
    method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
    headers,
    body: options.body !== undefined ? (isFormData ? (options.body as FormData) : JSON.stringify(options.body)) : undefined,
  });

  const text = await response.text();
  const json = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiClientError(response.status, json ?? { code: "UNKNOWN", message: "Request failed." });
  }
  return json as T;
}

export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `key-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
