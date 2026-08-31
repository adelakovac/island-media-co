# Island Media Co

A prototype booking platform for advertising space across transport, digital and street media. Built for the Frameworks connected-assessment brief: a single Next.js app that plays three roles (advertiser client, media owner manager, install fitter) against one shared Prisma/SQLite database and one documented API (`api/openapi.yaml`).

There's no real login. A role switcher in the header lets you act as any seeded user, or sign up as a new client, so you can walk the whole booking-to-installation flow without setting up auth.

## Interfaces and routes

### Client portal (`/portal`)
Advertisers browse the product catalogue, submit non-binding booking requests, and manage their contracts once one is issued.

- `/portal` - catalogue, shortlist, and the client's booking requests
- `/portal/products/[id]` - product detail with live availability
- `/portal/contracts/[id]` - contract detail, accept/change-request actions, service timeline
- `/portal/signup` - self-registration (creates a new organisation and client user)

### Management (`/manager`)
Media owner staff triage booking requests, turn approved requests into contracts, issue them, and schedule work orders.

- `/manager` - dashboard: attention counts and recent activity
- `/manager/booking-requests` and `/manager/booking-requests/[id]` - request review and decisions
- `/manager/contracts/[id]` - contract detail, issue action, work order scheduling

### Fitter (`/fitter`)
Install crew view their assigned work orders on a mobile-first layout, update status, and attach completion proof.

- `/fitter` - assigned job list
- `/fitter/work-orders/[id]` - job detail: status transitions, blocked-reason capture, proof upload

### API
All three interfaces sit on top of the same REST API under `app/api/`, documented in full in `api/openapi.yaml`. Broad groups:

- `auth/register`, `session/switch`, `session/users` - prototype identity
- `products`, `products/[id]` - public catalogue and availability
- `booking-requests` - request submission
- `client/*` - portal-scoped reads and contract actions
- `management/*` - request decisions, contract creation/issue, work order creation
- `mobile/work-orders/*` - fitter job list, status updates, proof upload

Protected routes expect an `X-Prototype-User-Id` header identifying the acting user (see Architectural decisions below). Mutating routes expect an `Idempotency-Key` header.

## Tech stack

- Next.js 16 (App Router), React 19
- Prisma 5 against SQLite (`dev.db` for local use, `test.db` for the test suite)
- Tailwind CSS 4
- Vitest for tests, tsx for running TypeScript scripts directly
- TypeScript throughout, no separate backend process - API routes live in the same Next.js app

## Setup

Requires Node 20+.

```bash
npm install
npx prisma migrate deploy   # apply migrations to dev.db
npm run seed                # load fixtures/island-media-fixtures.json
npm run dev                 # http://localhost:3000
```

`npm run seed` runs `prisma/seed.ts`, which inserts the fixture rows as-is. It's additive - it doesn't clear existing data first, so running it against a database that already has fixture rows in it will fail on unique-constraint collisions. To get back to an exact, pristine fixture state (for example after manual QA has added extra clients, requests, or contracts), wipe and reseed instead:

```bash
npx prisma migrate reset --force
```

This drops the SQLite file, reapplies all migrations, and runs the seed script automatically.

## Running tests

```bash
npm test          # single run
npm run test:watch
```

Tests run against `prisma/test.db`, which is separate from the `dev.db` you use for manual testing - running the suite never touches your dev data. `tests/global-setup.ts` rebuilds the test database schema once before the whole run, and each test resets and reseeds it via `tests/helpers/reset-db.ts` (the same `seedFixtures` function the CLI seed script uses), so tests don't leak state into each other. Because tests share one SQLite file, the suite runs with `fileParallelism: false` in `vitest.config.mts` - tests are not safe to run concurrently.

Coverage: access control, cross-org isolation, idempotency replay, the full connected booking-to-install journey, contract lifecycle, cancellation cascade, work order rules, and the availability engine's unit logic.

## Architectural decisions

### Fixture clock
There's no real wall clock in the prototype. Every date comparison (hold expiry, verification staleness, "is this booking active") is evaluated against a fixed instant, `FIXTURE_CLOCK_ISO` in `lib/fixture-clock.ts` (currently `2027-01-15T09:00:00Z`), instead of `Date.now()`. This keeps the seeded fixture data internally consistent regardless of when you actually run the app - a hold that "expires in 2 hours" in the fixtures stays that way whether you load the app today or next month. To move the prototype's "today" forward, change the constant and re-seed if the change should also apply to seeded data.

### Idempotency
Mutating endpoints require an `Idempotency-Key` header (min 8 characters). `lib/idempotency.ts` caches the first successful response for a given `(key, scope)` pair in an `IdempotencyRecord` row; a repeated request with the same key on the same scope replays the cached response instead of re-running the mutation. Failed attempts (handler throws) aren't cached, so a client can safely retry with the same key after a transient failure. This is what makes it safe for the client UI to retry a "submit booking request" or "attach proof" call without risking a duplicate.

### Availability engine
`lib/availability.ts` computes a per-asset or per-pool availability state (`available` / `unavailable` / `confirmation_required`) for a requested date range, without persisting a cached answer anywhere - it's recomputed from bookings, holds, and outages on every read.

- Exclusive-asset products check the asset's own bookings, active (non-expired) holds, and confirmed outages for date overlap.
- Capacity-pool products run a sweep-line peak-concurrent-usage calculation (`peakConcurrentUsage`) across overlapping bookings and holds to work out remaining capacity for the requested window.
- Either path can additionally return `confirmation_required`: either because the asset/pool carries an explicit fixture note, or because its `verifiedAt` timestamp is more than 90 days stale relative to the fixture clock. This was an explicit modelling choice (see the comment in `lib/availability.ts`) to distinguish "actually booked" from "probably fine but nobody's checked lately."

### Cancellation cascade
Cancelling a contract (`lib/contract-cancellation.ts`) doesn't just flip the contract's status. In one transaction it also cancels the linked campaign, cancels every work order on the contract that isn't already completed or cancelled, cancels the bookings that were holding inventory for it, and writes a client-visible service event recording the cancellation. Bookings have no foreign key back to the contract (they're created per contract item at acceptance time), so they're matched back by product/asset/pool/date instead. The function is a no-op if the contract is already completed or cancelled, so callers don't need to check status before calling it.

### Dynamic role switcher
Because there's no real auth, `components/RoleSwitcher.tsx` fetches the live list of selectable users from `/api/session/users` (not a static seed list) and lets you switch into any of them. Switching calls `/api/session/switch`, which resolves the user's session and their organisation if they have one; the client stores the chosen user id in `localStorage` and restores it on reload. Every subsequent API call from the browser sends that user id as the `X-Prototype-User-Id` header (`lib/client/api.ts`), and `lib/acting-user.ts` resolves it server-side and rejects unknown ids. Because the user list is live, a client who just self-registered through `/portal/signup` shows up in the switcher immediately, without a page reload.

## Known limitations

This is a prototype for the assessment brief, not production software. Specifically:

- **No real authentication.** The `X-Prototype-User-Id` header is trusted as-is; anyone who knows a user id can act as that user. See Productionisation below.
- **No real file storage.** Proof-of-completion uploads (`app/api/mobile/work-orders/[id]/proof/route.ts`) are stored as base64 data URIs directly in the SQLite `ProofRecord` row, not on disk or in object storage. Fine for small demo images, not viable at any real volume.
- **`/dev/reset` is documented but not implemented.** `api/openapi.yaml` describes an optional `POST /api/dev/reset` helper to restore fixture state; there's no corresponding route under `app/api/`. Use `npx prisma migrate reset --force` instead (see Running tests / Setup above).
- **The fitter-assignment dropdown is hardcoded.** There's no "list fitters" endpoint, so `lib/client/seeded-users.ts` hardcodes the one seeded fitter for the manager's work-order assignment UI. It will need to change alongside the fixture data if the fitter roster changes.
- **SQLite, single file, no concurrent writers assumed.** Fine for a prototype; see Productionisation for what a real datastore would need to look like.
- **No pagination** on list endpoints (booking requests, contracts, work orders) - fixture data volumes are small enough that it hasn't mattered.
