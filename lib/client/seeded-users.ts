// The prototype has no "list fitters" API, so the fitter-assignment dropdown
// (see app/manager/contracts/[id]/page.tsx) works from the known seeded fitter
// instead. If the fixture data changes, update this to match. The role
// switcher itself no longer uses this file - it lists live users from
// /api/session/users, which also picks up self-registered clients.
export interface SeededUserOption {
  id: string;
  name: string;
  role: "manager" | "fitter" | "client";
  organisationName?: string;
}

export const SEEDED_FITTERS: SeededUserOption[] = [{ id: "user-fitter-01", name: "Casey Morgan", role: "fitter" }];
