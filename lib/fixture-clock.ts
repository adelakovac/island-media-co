/**
 * The prototype has no real wall clock: every availability, expiry and
 * staleness check is evaluated against this fixed instant instead of
 * `Date.now()`, so the seeded fixture data (holds, bookings, verification
 * timestamps) stays internally consistent no matter when the app is run.
 *
 * To move the prototype's "today" forward, change FIXTURE_CLOCK_ISO (and
 * re-seed if the change should also apply to seeded data).
 */
export const FIXTURE_CLOCK_ISO = "2027-01-15T09:00:00Z";

const FIXTURE_CLOCK = new Date(FIXTURE_CLOCK_ISO);

export function now(): Date {
  return FIXTURE_CLOCK;
}
