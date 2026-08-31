"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { useSession } from "@/lib/client/session";
import { apiFetch, ApiClientError } from "@/lib/client/api";
import { formatTime, formatDateTime, isSameUtcDay } from "@/lib/client/dates";
import { now as fixtureNow } from "@/lib/fixture-clock";
import { workOrderTone } from "@/lib/status-tone";
import type { FitterWorkOrder } from "@/lib/client/fitter-types";

function JobRow({ job, showDate }: { job: FitterWorkOrder; showDate?: boolean }) {
  return (
    <li>
      <Link
        href={`/fitter/work-orders/${job.id}`}
        className="block rounded-lg border border-brand-navy-900/10 bg-white p-4 active:bg-brand-navy-900/5"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-base font-semibold capitalize text-brand-navy-900">{job.type}</span>
          <StatusBadge label={job.status} tone={workOrderTone(job.status)} />
        </div>
        <p className="mt-1 text-sm text-brand-navy-800/70">{job.organisationName}</p>
        <div className="mt-3 flex items-center justify-between text-sm text-brand-navy-800/60">
          <span>{showDate ? formatDateTime(job.scheduledStart) : formatTime(job.scheduledStart)}</span>
          <span className="truncate pl-2">{job.locationLabel}</span>
        </div>
      </Link>
    </li>
  );
}

export default function FitterJobListPage() {
  const { user, loading: sessionLoading } = useSession();
  const [jobs, setJobs] = useState<FitterWorkOrder[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ items: FitterWorkOrder[] }>("/api/mobile/work-orders", { userId: user.id });
      setJobs(data.items);
    } catch (err) {
      setJobs(null);
      setError(err instanceof ApiClientError ? err.message : "Could not load your jobs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (sessionLoading) return;
    // A non-fitter session renders the "sign in as a fitter" message below
    // unconditionally (see the early return further down), so there is no
    // point making a doomed, 403-logging request for it - including right
    // after switching away from a fitter account via the role switcher.
    if (!user || user.role !== "fitter") return;
    // Fetch-on-mount: load() sets loading/error state itself.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading, user?.id]);

  if (!sessionLoading && (!user || user.role !== "fitter")) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
        <Card className="p-4 text-sm text-brand-navy-800">
          Sign in as a fitter to view your jobs. Use the account switcher above.
        </Card>
      </main>
    );
  }

  const today = fixtureNow();
  const active = (jobs ?? []).filter((job) => job.status !== "completed" && job.status !== "cancelled");
  const completed = (jobs ?? []).filter((job) => job.status === "completed");
  const cancelled = (jobs ?? []).filter((job) => job.status === "cancelled");
  const todaysJobs = active.filter((job) => isSameUtcDay(new Date(job.scheduledStart), today));
  const upcomingJobs = active.filter((job) => !isSameUtcDay(new Date(job.scheduledStart), today));

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
      <h1 className="text-lg font-semibold text-brand-navy-900">
        {user ? `Hi ${user.name.split(" ")[0]}` : "My jobs"}
      </h1>
      <p className="mb-5 text-sm text-brand-navy-800/60">Your assigned installation and service jobs.</p>

      {(loading || sessionLoading) && <p className="text-sm text-brand-navy-800/60">Loading…</p>}
      {error && <p className="text-sm text-brand-red-600">{error}</p>}

      {jobs && !loading && (
        <div className="flex flex-col gap-6">
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-navy-800/50">Today</h2>
            {todaysJobs.length === 0 ? (
              <p className="text-sm text-brand-navy-800/60">No jobs scheduled for today.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {todaysJobs.map((job) => (
                  <JobRow key={job.id} job={job} />
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-navy-800/50">Upcoming</h2>
            {upcomingJobs.length === 0 ? (
              <p className="text-sm text-brand-navy-800/60">Nothing else scheduled.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {upcomingJobs.map((job) => (
                  <JobRow key={job.id} job={job} showDate />
                ))}
              </ul>
            )}
          </section>

          {completed.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-navy-800/50">Completed</h2>
              <ul className="flex flex-col gap-3">
                {completed.map((job) => (
                  <JobRow key={job.id} job={job} />
                ))}
              </ul>
            </section>
          )}

          {cancelled.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-navy-800/50">Cancelled</h2>
              <ul className="flex flex-col gap-3">
                {cancelled.map((job) => (
                  <JobRow key={job.id} job={job} showDate />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
