# Submission template

## Candidate

- Name: Adela Kovač
- Upwork profile: https://www.upwork.com/freelancers/~01f8a65fd29d294384?mp_source=share
- Accountable delivery lead: Adela Kovač
- Other contributors and exact contribution: None, I did this alone. Used Claude Code throughout as my coding assistant.

## Links

- Private repository: https://github.com/adelakovac/island-media-co
- Confirm @niko-frameworks has access: Yes, invited as collaborator
- Deployed preview: https://island-media-co-two.vercel.app
- Walkthrough video: https://www.loom.com/share/d75f4952fe834fde96ce9697911a7cbc

## Prototype access

- Management user or switcher option: Morgan Reed, via the role switcher (Manager)
- Fitter user or switcher option: Casey Morgan, via the role switcher (Fitter)
- Existing client user or switcher option: Avery Stone (Silverline Fitness), Jordan Ellis (Lighthouse Learning), or Taylor Quinn (Oak Legal), via the role switcher (Existing client)
- New-client registration route: /portal/signup, or "New client signup..." in the switcher

## Setup and checks

- Required runtime: Node 20+
- Install command: npm install
- Seed or reset command: npm run seed (additive), or npx prisma migrate reset --force for a clean reseed
- Development command: npm run dev
- Test command: npm test
- Production build command: npx prisma generate --schema=prisma/schema.production.prisma && next build

## Active time

- Active working time: Around 20-25 hours
- Unattended agent elapsed time: A few hours total, spread across the session while I was reviewing output and planning next steps
- Delivery started: 29 August 2026, ~20:47
- Delivery submitted: 31 August 2026

## What works

### Scenario A: signup and product discovery
No login needed to browse the catalogue at /portal - filters for dates, media type, location, and budget. Each product shows live availability with a reason (available/unavailable/confirmation required). A new client can sign up at /portal/signup, or pick an existing one from the switcher. Shortlisting and submitting a non-binding booking request both work from there.

### Scenario B: management request to contract and campaign
Managers review requests at /manager/booking-requests, with an approve/request-info/decline decision panel. Approving lets you allocate an asset and create a draft contract, which can then be issued. The client sees it at /portal/contracts/[id] and can accept, request changes, or request cancellation.

### Scenario C: management creates and assigns field work
Once a client accepts, the manager dashboard flags that a work order is needed. From the contract page, the manager assigns a fitter, sets the schedule and instructions.

### Scenario D: fitter completion updates management and client service visibility
The fitter sees the job at /fitter, moves it through assigned → travelling → on site → completed (requires a note and a proof photo) or blocked (requires a reason). Completion shows up on the client's timeline with the photo attached. Cancelling a contract cascades properly - the campaign, work order, and underlying booking all get cancelled together, not just the contract.

## Deliberate exclusions and known limitations

Covered in more detail in PRODUCTIONISATION.md and the README. Main ones: there's no real login, just the role switcher and a header that identifies who's acting. Proof photos are stored as base64 in the database instead of real file storage. The /api/dev/reset endpoint is documented in the API spec but doesn't exist - use prisma migrate reset instead. The fitter dropdown on the manager side is hardcoded to the one seeded fitter. No pagination anywhere yet.

## Assumptions

- Booking requests don't hold inventory - only an accepted contract actually creates a confirmed booking.
- A manager can approve a request without picking a specific asset yet, to sort out later once something's free.
- Cancelling a contract should cancel everything downstream too (work order, campaign, booking) rather than leaving them in a stale state.
- Clients need to see their pending request status too, not just their signed contracts - otherwise there's no way for them to know a manager is waiting on more info from them.

## Shared data model

Users belong to an Organisation, or none if they're internal (manager/fitter). Products are sold either through specific Assets or a shared CapacityPool. A BookingRequest is non-binding; once approved it turns into a Contract with line items, and accepting it activates a Campaign and creates real Bookings that actually block the calendar. WorkOrders sit under a Campaign and generate ServiceEvents and ProofRecords as the fitter works through them.

## Contract behaviour

Contracts go draft → issued → accepted/change_requested → active → completed/cancelled. Issuing creates the campaign in a waiting-for-acceptance state. The client can accept (activates everything), request changes (creates a pending request, doesn't touch the contract itself), or request cancellation (also needs manager sign-off before anything actually cancels).

## Mobile and field-work behaviour

The fitter side is a responsive mobile-first web view, not a real packaged app - big touch targets, single column, nothing fancy. Photos go up as base64 and sit in the database directly; in a real version that'd be S3 or similar with a presigned upload URL instead. There's no offline support or retry queue right now - if a request fails the fitter just has to try again.

## Visual consistency

- Colour and typography: navy and teal, default Tailwind font stack
- Applied consistently across all three interfaces through shared components (Button, Card, Field, Modal, StatusBadge)
- No external or generated assets used - everything's built from Tailwind and text/icons

## Access boundaries

Every client-facing route filters by the acting user's organisation, resolved server-side from the header - so nobody can read or touch another org's data. Manager and fitter routes check role and reject anything that doesn't match, with a 403. In production this header would be replaced by a real session token, but the same scoping logic underneath would stay basically the same.

## Persistence

Everything important lives in the database, SQLite locally and Postgres on Vercel. The selected role/user in the switcher is kept in a cookie so it survives a refresh. The shortlist is just client-side state and resets on reload. Real auth would replace the cookie-based prototype identity with an actual session.

## Architecture and productionisation note

See PRODUCTIONISATION.md in the repo, and the Architectural decisions section of the README for the fixture clock, idempotency, availability logic, cancellation cascade, and the role switcher.

## AI and development tools

| Tool | Contribution | How you verified the output |
|---|---|---|
| Claude Code | Wrote most of the implementation - schema, API routes, UI, tests, docs - based on my instructions and the assessment brief | Went through every scenario manually multiple times across all three interfaces, ran the full test suite (50 tests), and used the Claude in Chrome extension to actually click through features live before accepting anything as done |

## Representative prompts or agent instructions

Early on: "I have fixtures/island-media-fixtures.json and api/openapi.yaml in this project - please read both files carefully first. Based on EXACTLY what's in these two files (not invented data), please rewrite prisma/schema.prisma to match the entities in the fixtures and the schemas in openapi.yaml precisely... write prisma/seed.ts that loads fixtures/island-media-fixtures.json and inserts all records, preserving all IDs exactly as given..."

Later, during manual QA: "Found another issue: on the contract detail page, client requests are displayed but there's no way for the manager to respond to or resolve them. Please add a way for the manager to review and resolve a client request, similar to how booking-request decisions work. Test live in Chrome, run the full test suite afterward."

## AI-generated mistake or unsafe assumption

- What the tool generated or assumed: The proof upload endpoint accepted the fitter's photo but never actually stored it - previewUrl was hardcoded to null.
- Why it was wrong or unsafe: The completion flow looked like it worked fine end to end, but no photo ever actually reached the client. Nothing errored, nothing warned anyone.
- How you noticed: I clicked the proof photo link myself on the client side and nothing happened.
- What you changed: Fixed the endpoint to actually persist the image, and made the thumbnail clickable so it opens the full photo.
- What check proved the correction: Re-tested live in Chrome (upload as fitter, open as client, photo displays), and it's now covered by a test.

## One useful improvement

After the four scenarios were working, I added a dashboard item that flags when a contract's been accepted but no work order exists yet. Before that, there was no signal at all that a campaign was sitting there waiting - it just looked "approved" with nothing telling the manager to act. Helps management specifically, since it turns something that was silently falling through the cracks into something visible.

## What I would do next

1. Real authentication instead of the role switcher.
2. Move proof photos to real object storage (S3 or similar).
3. Generate an actual Postgres migration history - right now it's deployed via db push, no rollback or audit trail.
4. Add proper error tracking (Sentry or similar) - right now errors just go to console.error.
5. Add pagination to the list endpoints before real data volume makes them impractical.
