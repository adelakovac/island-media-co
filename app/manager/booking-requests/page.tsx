"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import { StatusBadge } from "@/components/StatusBadge";
import { useSession } from "@/lib/client/session";
import { apiFetch, ApiClientError } from "@/lib/client/api";
import { formatDate } from "@/lib/client/dates";
import { bookingRequestTone } from "@/lib/status-tone";
import type { BookingRequestListItem } from "@/lib/client/management-types";

const STATUS_OPTIONS = ["", "submitted", "information_required", "approved", "declined"] as const;

export default function BookingRequestListPage() {
  const { user, loading: sessionLoading } = useSession();
  const [status, setStatus] = useState<string>("");
  const [items, setItems] = useState<BookingRequestListItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionLoading) return;
    // A non-manager session renders the "sign in as a manager" message below
    // unconditionally (see the early return further down), so there is no
    // point making a doomed, 403-logging request for it - including right
    // after switching away from a manager account via the role switcher.
    if (!user || user.role !== "manager") return;
    // Fetch-on-mount/filter-change: resets loading/error for the new query.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    const query = status ? `?status=${status}` : "";
    apiFetch<{ items: BookingRequestListItem[] }>(`/api/management/booking-requests${query}`, { userId: user.id })
      .then((data) => setItems(data.items))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Could not load booking requests."))
      .finally(() => setLoading(false));
  }, [sessionLoading, user, status]);

  if (!sessionLoading && (!user || user.role !== "manager")) {
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <Card className="p-4 text-sm text-brand-carbon">
          Sign in as a manager to view booking requests. Use the account switcher above.
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-brand-carbon">Booking requests</h1>
          <p className="mt-1 text-sm text-brand-carbon/60">Every enquiry submitted through the client portal.</p>
        </div>
        <Select value={status} onChange={(event) => setStatus(event.target.value)} className="w-56">
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option === "" ? "All statuses" : option.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
      </div>

      {(loading || sessionLoading) && <p className="text-sm text-brand-carbon/60">Loading…</p>}
      {error && <p className="text-sm text-brand-danger">{error}</p>}

      {items && !loading && (
        <Card className="overflow-x-auto p-4">
          {items.length === 0 ? (
            <p className="text-sm text-brand-carbon/60">No booking requests match this filter.</p>
          ) : (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-brand-carbon/10 text-xs uppercase tracking-wide text-brand-carbon/50">
                  <th className="pb-2 pr-2 font-medium">Organisation</th>
                  <th className="pb-2 pr-2 font-medium">Product</th>
                  <th className="pb-2 pr-2 font-medium">Dates</th>
                  <th className="pb-2 pr-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Attention</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-brand-carbon/5 last:border-0">
                    <td className="py-2 pr-2">
                      <Link href={`/manager/booking-requests/${item.id}`} className="font-medium text-brand-carbon hover:text-brand-coral">
                        {item.organisationName}
                      </Link>
                    </td>
                    <td className="py-2 pr-2 text-brand-carbon/70">{item.productName}</td>
                    <td className="py-2 pr-2 text-brand-carbon/70">
                      {formatDate(item.startDate)} – {formatDate(item.endDate)}
                    </td>
                    <td className="py-2 pr-2">
                      <StatusBadge label={item.status} tone={bookingRequestTone(item.status)} />
                    </td>
                    <td className="py-2 text-xs font-medium text-brand-warning">{item.attentionReason ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </main>
  );
}
