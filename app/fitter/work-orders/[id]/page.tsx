"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/StatusBadge";
import { BlockedReasonModal } from "@/components/fitter/BlockedReasonModal";
import { CompleteJobModal } from "@/components/fitter/CompleteJobModal";
import { useSession } from "@/lib/client/session";
import { apiFetch, ApiClientError, newIdempotencyKey } from "@/lib/client/api";
import { formatDateTime } from "@/lib/client/dates";
import { workOrderTone } from "@/lib/status-tone";
import type { FitterWorkOrder, WorkOrderStatus } from "@/lib/client/fitter-types";

const NEXT_STEP: Partial<Record<WorkOrderStatus, { status: "travelling" | "on_site"; label: string }>> = {
  assigned: { status: "travelling", label: "Start travelling" },
  travelling: { status: "on_site", label: "Arrived on site" },
};

export default function FitterJobDetailPage() {
  const params = useParams<{ id: string }>();
  const { user, loading: sessionLoading } = useSession();

  const [job, setJob] = useState<FitterWorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stepSubmitting, setStepSubmitting] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const stepIdempotencyKey = useMemo(() => newIdempotencyKey(), [job?.status]);

  const [blockedOpen, setBlockedOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);

  async function load() {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<FitterWorkOrder>(`/api/mobile/work-orders/${params.id}`, { userId: user.id });
      setJob(data);
    } catch (err) {
      setJob(null);
      setError(err instanceof ApiClientError ? err.message : "Could not load this job.");
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
    // Fetch-on-mount/param-change: load() sets loading/error state itself.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading, user?.id, params.id]);

  async function advanceTo(status: "travelling" | "on_site") {
    if (!user || !job) return;
    setStepSubmitting(true);
    setStepError(null);
    try {
      const updated = await apiFetch<FitterWorkOrder>(`/api/mobile/work-orders/${job.id}/status`, {
        method: "POST",
        userId: user.id,
        idempotencyKey: stepIdempotencyKey,
        body: { status, note: null },
      });
      setJob(updated);
    } catch (err) {
      setStepError(err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setStepSubmitting(false);
    }
  }

  if (!sessionLoading && (!user || user.role !== "fitter")) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
        <Card className="p-4 text-sm text-brand-navy-800">
          Sign in as a fitter to view this job. Use the account switcher above.
        </Card>
      </main>
    );
  }

  const nextStep = job ? NEXT_STEP[job.status] : undefined;
  const blockedReason = job?.status === "blocked" ? [...job.history].reverse().find((entry) => entry.action === "blocked")?.note : null;

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
      <Link href="/fitter" className="text-sm text-brand-teal-600 hover:underline">
        ← My jobs
      </Link>

      {(loading || sessionLoading) && <p className="mt-6 text-sm text-brand-navy-800/60">Loading…</p>}
      {error && !loading && <Card className="mt-6 border-brand-red-600/20 bg-brand-red-100/40 p-4 text-sm text-brand-red-600">{error}</Card>}

      {job && !loading && (
        <div className="mt-4 flex flex-col gap-4">
          <div>
            <div className="flex items-start justify-between gap-2">
              <h1 className="text-xl font-semibold capitalize text-brand-navy-900">{job.type}</h1>
              <StatusBadge label={job.status} tone={workOrderTone(job.status)} />
            </div>
            <p className="mt-1 text-sm text-brand-navy-800/70">{job.organisationName}</p>
          </div>

          <Card className="p-4 text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
              <dt className="text-brand-navy-800/60">Scheduled</dt>
              <dd className="text-brand-navy-900">
                {formatDateTime(job.scheduledStart)} – {formatDateTime(job.scheduledEnd)}
              </dd>
              <dt className="text-brand-navy-800/60">Location</dt>
              <dd className="text-brand-navy-900">{job.locationLabel}</dd>
            </dl>
          </Card>

          <Card className="p-4">
            <h2 className="mb-1 text-sm font-semibold text-brand-navy-900">Instructions</h2>
            <p className="text-sm text-brand-navy-800/80">{job.instructions}</p>
          </Card>

          {job.status === "blocked" && blockedReason && (
            <Card className="border-brand-red-600/20 bg-brand-red-100/30 p-4 text-sm">
              <p className="font-medium text-brand-red-600">Blocked</p>
              <p className="mt-1 text-brand-navy-800/80">{blockedReason}</p>
            </Card>
          )}

          {job.status === "completed" && (
            <Card className="border-brand-teal-600/30 bg-brand-teal-100/30 p-4 text-sm">
              <p className="font-medium text-brand-teal-600">Job completed</p>
              {job.completionNote && <p className="mt-1 text-brand-navy-800/80">{job.completionNote}</p>}
              <p className="mt-1 text-xs text-brand-navy-800/50">
                {job.proofRecordIds.length} proof {job.proofRecordIds.length === 1 ? "file" : "files"} attached.
              </p>
            </Card>
          )}

          {job.status === "cancelled" && (
            <Card className="border-brand-red-600/20 bg-brand-red-100/30 p-4 text-sm">
              <p className="font-medium text-brand-red-600">Job cancelled</p>
              <p className="mt-1 text-brand-navy-800/80">
                The contract behind this job was cancelled. No further action is needed.
              </p>
            </Card>
          )}

          {stepError && <p className="text-sm text-brand-red-600">{stepError}</p>}

          {job.status !== "completed" && job.status !== "blocked" && job.status !== "cancelled" && (
            <div className="flex flex-col gap-3">
              {nextStep && (
                <Button className="min-h-14 text-base" disabled={stepSubmitting} onClick={() => advanceTo(nextStep.status)}>
                  {stepSubmitting ? "Updating…" : nextStep.label}
                </Button>
              )}
              {job.status === "on_site" && (
                <Button className="min-h-14 text-base" onClick={() => setCompleteOpen(true)}>
                  Complete job
                </Button>
              )}
              <Button variant="secondary" className="min-h-14 text-base" onClick={() => setBlockedOpen(true)}>
                Report a blocker
              </Button>
            </div>
          )}

          {job.status === "blocked" && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-brand-navy-800/50">Resume once the blocker is resolved.</p>
              <Button className="min-h-14 text-base" disabled={stepSubmitting} onClick={() => advanceTo("travelling")}>
                Mark travelling
              </Button>
              <Button className="min-h-14 text-base" disabled={stepSubmitting} onClick={() => advanceTo("on_site")}>
                Mark on site
              </Button>
              <Button className="min-h-14 text-base" onClick={() => setCompleteOpen(true)}>
                Complete job
              </Button>
            </div>
          )}

          <Card className="p-4">
            <h2 className="mb-2 text-sm font-semibold text-brand-navy-900">History</h2>
            <ul className="flex flex-col gap-2 text-sm">
              {job.history.map((entry, index) => (
                <li key={index} className="border-l-2 border-brand-navy-900/10 pl-3">
                  <p className="text-brand-navy-900">
                    <span className="font-medium capitalize">{entry.actor}</span> · {entry.action.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-brand-navy-800/50">{new Date(entry.at).toLocaleString("en-GB")}</p>
                  {entry.note && <p className="mt-0.5 text-brand-navy-800/70">{entry.note}</p>}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {job && (
        <>
          <BlockedReasonModal
            open={blockedOpen}
            onClose={() => setBlockedOpen(false)}
            workOrderId={job.id}
            onSuccess={(updated) => setJob(updated)}
          />
          <CompleteJobModal
            open={completeOpen}
            onClose={() => setCompleteOpen(false)}
            workOrderId={job.id}
            onSuccess={() => load()}
          />
        </>
      )}
    </main>
  );
}
