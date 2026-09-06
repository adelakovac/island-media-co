"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { useSession } from "@/lib/client/session";
import { apiFetch, ApiClientError } from "@/lib/client/api";
import type { ManagementDashboard } from "@/lib/client/management-types";

const COUNT_LABELS: Array<{ key: keyof ManagementDashboard["counts"]; label: string }> = [
  { key: "bookingRequestsSubmitted", label: "New requests" },
  { key: "bookingRequestsInformationRequired", label: "Awaiting info reply" },
  { key: "bookingRequestsApproved", label: "Approved, no contract yet" },
  { key: "contractsIssued", label: "Issued, awaiting acceptance" },
  { key: "contractsChangeRequested", label: "Change requested" },
  { key: "workOrdersAssigned", label: "Work orders assigned" },
];

function attentionHref(item: ManagementDashboard["attentionItems"][number]): string | null {
  if (item.type === "booking_request") return `/manager/booking-requests/${item.id}`;
  if (item.type === "contract_change_requested") return `/manager/contracts/${item.id}`;
  if (item.type === "client_request") return item.contractId ? `/manager/contracts/${item.contractId}` : null;
  if (item.type === "campaign_needs_work_order") return item.contractId ? `/manager/contracts/${item.contractId}` : null;
  return null;
}

export default function ManagerDashboardPage() {
  const { user, loading: sessionLoading } = useSession();
  const [dashboard, setDashboard] = useState<ManagementDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionLoading || !user) return;
    // Fetch-on-mount: resets loading/error before the request starts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    apiFetch<ManagementDashboard>("/api/management/dashboard", { userId: user.id })
      .then(setDashboard)
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Could not load the dashboard."))
      .finally(() => setLoading(false));
  }, [sessionLoading, user]);

  if (!sessionLoading && (!user || user.role !== "manager")) {
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <Card className="p-4 text-sm text-brand-carbon">
          Sign in as a manager to view the management dashboard. Use the account switcher above.
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <p className="mb-1 text-xs font-bold uppercase tracking-widest text-brand-coral">Operations overview</p>
      <h1 className="mb-1 text-2xl font-bold text-brand-carbon">Management dashboard</h1>
      <p className="mb-6 text-sm text-brand-carbon/60">What needs attention across Island Media Co, right now.</p>

      {(loading || sessionLoading) && <p className="text-sm text-brand-carbon/60">Loading…</p>}
      {error && <p className="text-sm text-brand-danger">{error}</p>}

      {dashboard && !loading && (
        <div className="flex flex-col gap-6">
          {dashboard.attentionItems.length > 0 && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_0.6fr]">
              <article className="frame-corners relative overflow-hidden rounded-feature bg-brand-atlantic p-6 text-brand-warm-white sm:p-8">
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-brand-coral">Needs attention</p>
                <h2 className="max-w-md text-xl font-bold leading-snug sm:text-2xl">{dashboard.attentionItems[0].message}</h2>
                <p className="mt-2 max-w-md text-sm text-brand-warm-white/70">
                  Review inventory before issuing a contract. Active holds and confirmed outages are already included.
                </p>
              </article>
              <article className="flex flex-col justify-between gap-2 rounded-feature border border-brand-mist bg-white p-6">
                <span className="text-sm font-semibold text-brand-carbon">Open decisions</span>
                <strong className="text-5xl font-bold leading-none tracking-tight text-brand-coral">
                  {String(dashboard.attentionItems.length).padStart(2, "0")}
                </strong>
                <span className="text-xs font-semibold text-brand-carbon/70">
                  {dashboard.attentionItems.length} item{dashboard.attentionItems.length === 1 ? "" : "s"} need review
                </span>
              </article>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {COUNT_LABELS.map(({ key, label }) => (
              <Card key={key} className="p-3">
                <p className="text-2xl font-semibold text-brand-carbon">{dashboard.counts[key]}</p>
                <p className="mt-1 text-xs text-brand-carbon/60">{label}</p>
              </Card>
            ))}
          </div>

          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-brand-carbon">Needs your attention</h2>
            {dashboard.attentionItems.length === 0 ? (
              <p className="text-sm text-brand-carbon/60">Nothing needs attention right now.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {dashboard.attentionItems.map((item) => {
                  const href = attentionHref(item);
                  const content = (
                    <div className="rounded-md border border-brand-carbon/10 p-3 text-sm transition-colors hover:border-brand-coral">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-brand-carbon">{item.organisationName}</span>
                        {item.productName && <span className="text-xs text-brand-carbon/50">{item.productName}</span>}
                      </div>
                      <p className="mt-1 text-brand-warning">{item.message}</p>
                    </div>
                  );
                  return (
                    <li key={`${item.type}-${item.id}`}>
                      {href ? (
                        <Link href={href}>{content}</Link>
                      ) : (
                        content
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-brand-carbon">Upcoming work orders</h2>
            {dashboard.upcomingWorkOrders.length === 0 ? (
              <p className="text-sm text-brand-carbon/60">No upcoming work orders.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {dashboard.upcomingWorkOrders.map((workOrder) => (
                  <li key={workOrder.id}>
                    <Link
                      href={`/manager/contracts/${workOrder.contractId}`}
                      className="block rounded-md border border-brand-carbon/10 p-3 text-sm transition-colors hover:border-brand-coral"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium capitalize text-brand-carbon">{workOrder.type}</span>
                        <span className="text-xs text-brand-carbon/50">
                          {new Date(workOrder.scheduledStart).toLocaleString("en-GB")}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-brand-carbon/60">{workOrder.locationLabel}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </main>
  );
}
