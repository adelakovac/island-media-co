# Productionisation

This app is a prototype: three UIs and one API, built to demonstrate the booking-to-installation flow against seeded fixture data. It intentionally skips or fakes several things that real production software needs. This document lists what would have to change, roughly in order of how blocking each one is.

## Authentication

Right now every protected route trusts an `X-Prototype-User-Id` header at face value (`lib/acting-user.ts`). There's no password, no token, no session cookie - the client just tells the server who it is, and the server believes it. This has to go before the app touches real data.

What it needs instead:

- A real auth provider (Auth.js/NextAuth, Clerk, Cognito, or a hand-rolled email+password/OTP flow) issuing signed, expiring session tokens, stored in an `httpOnly` cookie rather than passed as a plain header.
- Server-side session verification on every request, replacing `requireActingUser`'s header lookup with a signed-token check.
- Password/credential storage (if not delegated to a third party) with proper hashing (argon2/bcrypt), not touched anywhere in the current codebase.
- The self-registration flow (`/portal/signup`, `app/api/auth/register`) needs email verification before an account is usable, and rate limiting so it can't be used to enumerate or spam-create organisations.
- The role switcher (`components/RoleSwitcher.tsx`) is a prototype-only concept and should be removed entirely - it's the mechanism that impersonates any user with one click, which is the opposite of what you want once auth is real.

## File storage

Proof-of-completion photos are currently stored as base64-encoded data URIs inline in the `ProofRecord.previewUrl` column (`app/api/mobile/work-orders/[id]/proof/route.ts`). Every upload grows the SQLite file directly and every read pulls the full image through the database.

What it needs instead:

- Direct-to-S3 (or GCS/Azure Blob) upload, typically via a presigned URL the API hands the client, so image bytes never transit the app server.
- `ProofRecord` stores an object key/URL instead of the image itself.
- A CDN in front of the bucket for read performance, and a lifecycle policy for retention/expiry if there's a compliance reason to age out old proof photos.
- Server-side validation of file type and size before issuing an upload URL (currently the only check is "non-empty file").

## Database

SQLite (`dev.db` / `test.db`) is fine for a single-process prototype but doesn't hold up under concurrent writers, has no real backup/replication story, and caps out on write throughput a lot sooner than the traffic this kind of platform would see. Local dev and the test suite still run on SQLite; the deployed app runs against Postgres (Neon) instead, via a separate `prisma/schema.production.prisma` (see README's Deploying section) - Prisma's datasource `provider` is a compile-time literal, so one schema file can't serve both databases, hence the second file. That production schema deliberately keeps the JSON-as-string columns (`history`, `creativeSpec`, `IdempotencyRecord.body`) as `String` rather than native Postgres `Json`, so the exact same application code runs unmodified against either database - real `Json` columns are a reasonable follow-up once SQLite is dropped from local dev entirely, but would otherwise require either duplicating the read/write code paths per environment or giving up SQLite for local dev too.

What it still needs:

- A real migration history for the production schema: it currently has none (see `prisma/schema.production.prisma`'s header) - the app is deployed via `prisma db push`, which has no rollback and no audit trail of schema changes. Generating one requires a `prisma migrate dev` run against a real Postgres instance (a local one, or a scratch Neon branch), which hasn't happened yet.
- A real migration pipeline once that history exists: gated behind CI/CD with a rollback plan, run against a database that isn't also serving live traffic mid-migration.
- Connection pooling: Neon's own pooled connection string is used for `DATABASE_URL` today, which covers basic serverless fan-out; a busier deployment may want PgBouncer or Prisma Accelerate in front of it.
- Automated backups and a tested restore procedure beyond Neon's point-in-time recovery defaults.
- The `IdempotencyRecord` table needs a retention policy (a TTL/cleanup job) - nothing currently deletes old rows, so it grows forever.
- Keeping `prisma/schema.prisma` and `prisma/schema.production.prisma` in sync is currently a manual step with no drift check - worth a CI job that diffs the model definitions if this project outlives the assessment.

## The fixture clock

`lib/fixture-clock.ts` pins "now" to a hardcoded timestamp so demo data stays internally consistent regardless of when the app runs. Production needs `Date.now()` (or a proper injectable clock for testability) everywhere `now()` is currently called, and every piece of logic that depends on relative dates (hold expiry, the 90-day staleness check in `lib/availability.ts`) should be re-validated against real elapsed time rather than a frozen instant.

## Monitoring, logging, error tracking

There's no structured logging or observability beyond `console.error` in each route's catch block, and no request tracing. Before this carries real traffic it needs:

- Structured, correlated logging (request id per request, propagated through to any background work) shipped somewhere queryable (CloudWatch, Datadog, etc.), not stdout.
- Error tracking (Sentry or similar) so a `SERVICE_UNAVAILABLE` response server-side is actually visible to someone, instead of only surfacing as a generic message to the client.
- Basic uptime/latency/error-rate dashboards and alerting on the API routes, especially the mutation paths (booking request submission, contract issue, work order status changes) where a silent failure has business impact.
- Audit logging for management actions (approve/decline a request, issue a contract, cancel a contract) separate from the in-band `history` JSON blobs, since those are user-facing and shouldn't be the only record of who did what.

## Rate limiting and abuse protection

None of the current endpoints are rate limited. `auth/register`, `booking-requests`, and the proof upload endpoint are the most exposed - all three accept unauthenticated or lightly-authenticated writes. Needs standard per-IP and per-account rate limiting (a gateway-level solution like an API gateway or Cloudflare, or middleware backed by Redis) before this is public.

## Other gaps worth flagging

- **CORS/origin policy**: not configured anywhere; fine when the API and UI are the same Next.js app, but relevant the moment any other client is expected to call this API.
- **Input validation**: hand-rolled per-route (see the manual `typeof` checks throughout `app/api/**/route.ts`) rather than schema-validated (Zod or similar) against the OpenAPI spec that's supposed to be the source of truth. Worth generating validation from `api/openapi.yaml` rather than maintaining both by hand.
- **Idempotency-Key** is currently a required header the client is trusted to generate uniquely (`lib/client/api.ts` uses `crypto.randomUUID()`), which is fine, but there's no visibility into idempotency-key reuse across different users/requests bodies - a production version should reject a replayed key whose request body doesn't match what was cached, rather than silently returning the old response.
- **Environment/secrets management**: `.env` currently holds one plaintext `DATABASE_URL`. Production needs a real secrets manager (and separate secrets per environment) once there's an auth provider, a storage bucket, and a hosted database each requiring credentials.
- **Multi-instance deployment**: nothing in the current app assumes more than one running instance (no shared cache, no distributed locking), which is fine on SQLite/single-process but needs re-checking once the app runs behind a load balancer with more than one Next.js process talking to the same Postgres instance.
