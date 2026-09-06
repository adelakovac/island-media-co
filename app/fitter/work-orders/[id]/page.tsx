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

const PROGRESS_STEPS: Array<{ status: WorkOrderStatus; label: string }> = [
  { status: "assigned", label: "Assigned" },
  { status: "travelling", label: "Travelling" },
  { status: "on_site", label: "On site" },
  { status: "completed", label: "Complete" },
];

function progressStepsDone(status: WorkOrderStatus): number {
  const index = PROGRESS_STEPS.findIndex((step) => step.status === status);
  return index === -1 ? 1 : index + 1;
}

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
        <Card className="p-4 text-sm text-brand-carbon">
          Sign in as a fitter to view this job. Use the account switcher above.
        </Card>
      </main>
    );
  }

  const nextStep = job ? NEXT_STEP[job.status] : undefined;
  const blockedReason = job?.status === "blocked" ? [...job.history].reverse().find((entry) => entry.action === "blocked")?.note : null;

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
      <Link href="/fitter" className="text-sm text-brand-coral hover:underline">
        ← My jobs
      </Link>

      {(loading || sessionLoading) && <p className="mt-6 text-sm text-brand-carbon/60">Loading…</p>}
      {error && !loading && <Card className="mt-6 border-brand-danger/30 bg-brand-danger/10 p-4 text-sm text-brand-danger">{error}</Card>}

      {job && !loading && (
        <div className="mt-4 flex flex-col gap-4">
          <div>
            <div className="flex items-start justify-between gap-2">
              <h1 className="text-xl font-semibold capitalize text-brand-carbon">{job.type}</h1>
              <StatusBadge label={job.status} tone={workOrderTone(job.status)} />
            </div>
            <p className="mt-1 text-sm text-brand-carbon/70">{job.organisationName}</p>
          </div>

          <div className="relative rounded-surface bg-brand-atlantic p-4 pl-12 text-brand-warm-white">
            <span
              aria-hidden
              className="absolute left-4 top-4 h-4 w-4 -rotate-45 rounded-full rounded-bl-none border-[5px] border-brand-coral"
            />
            <strong className="block text-sm">{job.locationLabel}</strong>
          </div>

          <Card className="p-4 text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
              <dt className="text-brand-carbon/60">Scheduled</dt>
              <dd className="text-brand-carbon">
                {formatDateTime(job.scheduledStart)} – {formatDateTime(job.scheduledEnd)}
              </dd>
            </dl>
          </Card>

          {job.status !== "cancelled" && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-brand-carbon">Job progress</h2>
              <div className="grid grid-cols-4 gap-1">
                {PROGRESS_STEPS.map((step, index) => (
                  <span
                    key={step.status}
                    className={`h-1.5 rounded-full ${index < progressStepsDone(job.status) ? "bg-brand-coral" : "bg-brand-mist"}`}
                  />
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-brand-carbon/60">
                {PROGRESS_STEPS.map((step) => (
                  <span key={step.status}>{step.label}</span>
                ))}
              </div>
            </section>
          )}

          <Card className="p-4">
            <h2 className="mb-1 text-sm font-semibold text-brand-carbon">Instructions</h2>
            <p className="text-sm text-brand-carbon/80">{job.instructions}</p>
          </Card>

          {job.status === "blocked" && blockedReason && (
            <Card className="border-brand-danger/30 bg-brand-danger/10 p-4 text-sm">
              <p className="font-medium text-brand-danger">Blocked</p>
              <p className="mt-1 text-brand-carbon/80">{blockedReason}</p>
            </Card>
          )}

          {job.status === "completed" && (
            <Card className="border-brand-success/30 bg-brand-success/10 p-4 text-sm">
              <p className="font-medium text-brand-success">Job completed</p>
              {job.completionNote && <p className="mt-1 text-brand-carbon/80">{job.completionNote}</p>}
              <p className="mt-1 text-xs text-brand-carbon/50">
                {job.proofRecordIds.length} proof {job.proofRecordIds.length === 1 ? "file" : "files"} attached.
              </p>
            </Card>
          )}

          {job.status === "cancelled" && (
            <Card className="border-brand-danger/30 bg-brand-danger/10 p-4 text-sm">
              <p className="font-medium text-brand-danger">Job cancelled</p>
              <p className="mt-1 text-brand-carbon/80">
                The contract behind this job was cancelled. No further action is needed.
              </p>
            </Card>
          )}

          {stepError && <p className="text-sm text-brand-danger">{stepError}</p>}

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
              <p className="text-xs text-brand-carbon/50">Resume once the blocker is resolved.</p>
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
            <h2 className="mb-2 text-sm font-semibold text-brand-carbon">History</h2>
            <ul className="flex flex-col gap-2 text-sm">
              {job.history.map((entry, index) => (
                <li key={index} className="border-l-2 border-brand-carbon/10 pl-3">
                  <p className="text-brand-carbon">
                    <span className="font-medium capitalize">{entry.actor}</span> · {entry.action.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-brand-carbon/50">{new Date(entry.at).toLocaleString("en-GB")}</p>
                  {entry.note && <p className="mt-0.5 text-brand-carbon/70">{entry.note}</p>}
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
