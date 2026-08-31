"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { apiFetch, ApiClientError } from "@/lib/client/api";
import { formatDate } from "@/lib/client/dates";
import type { ClientSummary } from "@/lib/client/types";

export function ClientSummarySection({ userId, refreshToken }: { userId: string; refreshToken: number }) {
  const [summary, setSummary] = useState<ClientSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // Fetch-on-mount/refresh: resets loading/error before the request starts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    apiFetch<ClientSummary>("/api/client/summary", { userId })
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiClientError ? err.message : "Could not load your account.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, refreshToken]);

  if (loading) return <p className="text-sm text-brand-navy-800/60">Loading your account…</p>;
  if (error) return <p className="text-sm text-brand-red-600">{error}</p>;
  if (!summary) return null;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-brand-navy-900">{summary.organisation.name}</h2>
        <span className="text-xs text-brand-navy-800/60">
          {summary.organisation.contractCount} contract{summary.organisation.contractCount === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4 md:col-span-2">
          <h3 className="mb-2 text-sm font-semibold text-brand-navy-900">Contracts</h3>
          {summary.contracts.length === 0 ? (
            <p className="text-sm text-brand-navy-800/60">No contracts yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {summary.contracts.map((contract) => (
                <li key={contract.id}>
                  <Link
                    href={`/portal/contracts/${contract.id}`}
                    className="block rounded-md border border-brand-navy-900/10 p-3 text-sm transition-colors hover:border-brand-teal-600"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-brand-navy-900">{contract.id}</span>
                      <span className="rounded-full bg-brand-navy-900/5 px-2 py-0.5 text-xs capitalize text-brand-navy-800">
                        {contract.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-brand-navy-800/60">
                      {formatDate(contract.startDate)} – {formatDate(contract.endDate)} · £
                      {contract.total.toLocaleString()}
                    </p>
                    {contract.actionRequired && (
                      <p className="mt-1 text-xs font-medium text-brand-amber-500">{contract.actionRequired}</p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {summary.attentionItems.length > 0 && (
            <div className="mt-4 border-t border-brand-navy-900/10 pt-3">
              <h3 className="mb-2 text-sm font-semibold text-brand-navy-900">Needs your attention</h3>
              <ul className="flex flex-col gap-1">
                {summary.attentionItems.map((item, index) => (
                  <li key={index} className="text-sm text-brand-amber-500">
                    {String(item.message ?? "")}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="mb-2 text-sm font-semibold text-brand-navy-900">Recent activity</h3>
          {summary.recentServiceEvents.length === 0 ? (
            <p className="text-sm text-brand-navy-800/60">No activity yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {summary.recentServiceEvents.map((event) => (
                <li key={event.id} className="text-sm">
                  <p className="font-medium text-brand-navy-900">{event.title}</p>
                  <p className="text-xs text-brand-navy-800/60">{new Date(event.at).toLocaleString("en-GB")}</p>
                  {event.clientSummary && <p className="mt-0.5 text-xs text-brand-navy-800/70">{event.clientSummary}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </section>
  );
}
