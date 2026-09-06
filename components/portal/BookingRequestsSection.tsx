"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { apiFetch, ApiClientError } from "@/lib/client/api";
import { formatDate, formatDateTime } from "@/lib/client/dates";
import { bookingRequestTone } from "@/lib/status-tone";
import type { ClientBookingRequestSummary } from "@/lib/client/types";

export function BookingRequestsSection({ userId, refreshToken }: { userId: string; refreshToken: number }) {
  const [requests, setRequests] = useState<ClientBookingRequestSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // Fetch-on-mount/refresh: resets loading/error before the request starts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    apiFetch<{ items: ClientBookingRequestSummary[] }>("/api/client/booking-requests", { userId })
      .then((data) => {
        if (!cancelled) setRequests(data.items);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiClientError ? err.message : "Could not load your booking requests.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, refreshToken]);

  if (loading) return null;
  if (error) return <p className="mb-8 text-sm text-brand-danger">{error}</p>;
  if (!requests || requests.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold text-brand-carbon">Your booking requests</h2>
      <div className="flex flex-col gap-3">
        {requests.map((request) => {
          const lastManagerNote = [...request.history].reverse().find((entry) => entry.actor === "manager" && entry.note);
          return (
            <Card key={request.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-brand-carbon">{request.productName}</p>
                  <p className="text-xs text-brand-carbon/60">
                    {formatDate(request.startDate)} – {formatDate(request.endDate)} · submitted {formatDateTime(request.createdAt)}
                  </p>
                </div>
                <StatusBadge label={request.status} tone={bookingRequestTone(request.status)} />
              </div>

              {request.status === "information_required" && lastManagerNote && (
                <div className="mt-3 rounded-md border border-brand-warning/30 bg-brand-warning/10 p-3 text-sm">
                  <p className="font-medium text-brand-warning">The manager needs more information from you</p>
                  <p className="mt-1 text-brand-carbon">{lastManagerNote.note}</p>
                </div>
              )}

              {request.status !== "information_required" && lastManagerNote && (
                <p className="mt-3 text-sm text-brand-carbon/70">
                  <span className="font-medium text-brand-carbon">Manager note:</span> {lastManagerNote.note}
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
}
