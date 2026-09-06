"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, TextArea, FieldError } from "@/components/ui/Field";
import { AvailabilityBadge } from "@/components/AvailabilityBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { useSession } from "@/lib/client/session";
import { apiFetch, ApiClientError, newIdempotencyKey } from "@/lib/client/api";
import { formatDate } from "@/lib/client/dates";
import { bookingRequestTone } from "@/lib/status-tone";
import type { BookingRequestDetail } from "@/lib/client/management-types";
import type { Contract } from "@/lib/client/types";

type DecisionTab = "approve" | "request_info" | "decline";

function formatRate(amount: number | null, unit: string | null): string {
  if (amount === null) return "Price on request";
  return `£${amount.toLocaleString()}${unit ? ` / ${unit.replace(/_/g, " ")}` : ""}`;
}

function contractSummaryLabel(contractStatus: string | null): string {
  switch (contractStatus) {
    case "draft":
      return "Draft contract created.";
    case "issued":
      return "Contract issued — awaiting client review.";
    case "accepted":
      return "Contract accepted by the client.";
    case "change_requested":
      return "Client has requested changes to the contract.";
    case "completed":
      return "Contract completed.";
    case "cancelled":
      return "Contract cancelled.";
    default:
      return "This request has a contract.";
  }
}

export default function BookingRequestDetailPage() {
  const params = useParams<{ id: string }>();
  const { user, loading: sessionLoading } = useSession();

  const [detail, setDetail] = useState<BookingRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<DecisionTab>("approve");
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [note, setNote] = useState("");
  const [decisionSubmitting, setDecisionSubmitting] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const decisionIdempotencyKey = useMemo(() => newIdempotencyKey(), [tab, detail?.status]);

  const [quantity, setQuantity] = useState("1");
  const [unitRate, setUnitRate] = useState("");
  const [rateUnit, setRateUnit] = useState("");
  const [lineTotal, setLineTotal] = useState("");
  const [contractStartDate, setContractStartDate] = useState("");
  const [contractEndDate, setContractEndDate] = useState("");
  const [contractSubmitting, setContractSubmitting] = useState(false);
  const [contractError, setContractError] = useState<string | null>(null);
  const [createdContract, setCreatedContract] = useState<Contract | null>(null);
  const contractIdempotencyKey = useMemo(() => newIdempotencyKey(), [detail?.id]);

  async function load() {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<BookingRequestDetail>(`/api/management/booking-requests/${params.id}`, { userId: user.id });
      setDetail(data);
      setSelectedAssetId(data.requestedAssetId ?? "");
      setContractStartDate(data.startDate);
      setContractEndDate(data.endDate);
      setUnitRate(data.product.indicativeRate.amount !== null ? String(data.product.indicativeRate.amount) : "");
      setRateUnit(data.product.indicativeRate.unit ?? "");
      setLineTotal(data.product.indicativeRate.amount !== null ? String(data.product.indicativeRate.amount) : "");
    } catch (err) {
      setDetail(null);
      setError(err instanceof ApiClientError ? err.message : "Could not load this booking request.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (sessionLoading) return;
    // A non-manager session renders the "sign in as a manager" message below
    // unconditionally (see the early return further down), so there is no
    // point making a doomed, 403-logging request for it - including right
    // after switching away from a manager account via the role switcher.
    if (!user || user.role !== "manager") return;
    // Fetch-on-mount/param-change: load() sets loading/error state itself, which
    // is the intended behaviour here (not a subscription-style effect).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading, user?.id, params.id]);

  function selectTab(next: DecisionTab) {
    setTab(next);
    setNote("");
    setDecisionError(null);
  }

  async function submitDecision() {
    if (!user || !detail) return;
    if (tab === "request_info" && !note.trim()) {
      setDecisionError("A note is required when requesting more information.");
      return;
    }
    setDecisionSubmitting(true);
    setDecisionError(null);
    try {
      const action = tab === "approve" ? "approve" : tab === "decline" ? "decline" : "request_information";
      await apiFetch<BookingRequestDetail>(`/api/management/booking-requests/${detail.id}`, {
        method: "PATCH",
        userId: user.id,
        idempotencyKey: decisionIdempotencyKey,
        body: {
          action,
          note: note.trim() || null,
          selectedAssetId: tab === "approve" && detail.product.allocationModel === "exclusive_asset" ? selectedAssetId || null : null,
        },
      });
      await load();
      setNote("");
    } catch (err) {
      setDecisionError(err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setDecisionSubmitting(false);
    }
  }

  async function submitContract() {
    if (!user || !detail) return;
    setContractSubmitting(true);
    setContractError(null);
    try {
      const parsedUnitRate = unitRate.trim() === "" ? null : Number(unitRate);
      const parsedLineTotal = Number(lineTotal);
      if (Number.isNaN(parsedLineTotal)) {
        throw new Error("Line total must be a number.");
      }
      const created = await apiFetch<Contract>("/api/management/contracts", {
        method: "POST",
        userId: user.id,
        idempotencyKey: contractIdempotencyKey,
        body: {
          organisationId: detail.organisationId,
          bookingRequestId: detail.id,
          startDate: contractStartDate,
          endDate: contractEndDate,
          items: [
            {
              id: newIdempotencyKey(),
              productId: detail.productId,
              assetId: detail.product.allocationModel === "exclusive_asset" ? (selectedAssetId || detail.requestedAssetId || null) : null,
              capacityPoolId: detail.product.allocationModel === "capacity_pool" ? detail.product.capacityPoolId : null,
              quantity: Number(quantity) || 1,
              unitRate: parsedUnitRate,
              rateUnit: rateUnit.trim() || null,
              lineTotal: parsedLineTotal,
            },
          ],
          total: parsedLineTotal,
        },
      });
      setCreatedContract(created);
      await load();
    } catch (err) {
      setContractError(err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setContractSubmitting(false);
    }
  }

  if (!sessionLoading && (!user || user.role !== "manager")) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <Card className="p-4 text-sm text-brand-carbon">
          Sign in as a manager to review this request. Use the account switcher above.
        </Card>
      </main>
    );
  }

  const isPending = detail?.status === "submitted" || detail?.status === "information_required";
  const isApprovedNoContract = detail?.status === "approved" && !detail.draftContractId;
  const draftContractId = createdContract?.id ?? detail?.draftContractId ?? null;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <Link href="/manager/booking-requests" className="text-sm text-brand-coral hover:underline">
        ← Back to booking requests
      </Link>

      {(loading || sessionLoading) && <p className="mt-6 text-sm text-brand-carbon/60">Loading…</p>}
      {error && !loading && <Card className="mt-6 border-brand-danger/30 bg-brand-danger/10 p-4 text-sm text-brand-danger">{error}</Card>}

      {detail && !loading && (
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-brand-carbon">{detail.organisation.name}</h1>
              <p className="text-sm text-brand-carbon/60">
                {detail.product.name} · {formatDate(detail.startDate)} – {formatDate(detail.endDate)}
              </p>
            </div>
            <StatusBadge label={detail.status} tone={bookingRequestTone(detail.status)} />
          </div>

          <Card className="p-4">
            <h2 className="mb-2 text-sm font-semibold text-brand-carbon">Request details</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-brand-carbon/60">Budget</dt>
              <dd className="text-brand-carbon">£{detail.budget.toLocaleString()} / month</dd>
              <dt className="text-brand-carbon/60">Objective</dt>
              <dd className="text-brand-carbon">{detail.objective}</dd>
              {detail.notes && (
                <>
                  <dt className="text-brand-carbon/60">Notes</dt>
                  <dd className="text-brand-carbon">{detail.notes}</dd>
                </>
              )}
              {detail.requestedAssetId && (
                <>
                  <dt className="text-brand-carbon/60">Requested asset</dt>
                  <dd className="text-brand-carbon">
                    {detail.product.assetOptions.find((asset) => asset.id === detail.requestedAssetId)?.name ?? detail.requestedAssetId}
                  </dd>
                </>
              )}
            </dl>
          </Card>

          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-brand-carbon">Availability</h2>
              <AvailabilityBadge state={detail.currentAvailability.state} title={detail.currentAvailability.reason} />
            </div>
            <p className="text-sm text-brand-carbon/70">{detail.currentAvailability.reason}</p>
            {detail.product.allocationModel === "exclusive_asset" && detail.product.assetOptions.length > 0 && (
              <ul className="mt-3 flex flex-col gap-2">
                {detail.product.assetOptions.map((asset) => (
                  <li key={asset.id} className="flex items-center justify-between gap-3 rounded-md border border-brand-carbon/10 p-2 text-sm">
                    <span className="text-brand-carbon">{asset.name}</span>
                    <AvailabilityBadge state={asset.availability.state} title={asset.availability.reason} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="mb-2 text-sm font-semibold text-brand-carbon">History</h2>
            <ul className="flex flex-col gap-2 text-sm">
              {detail.history.map((entry, index) => (
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

          {isPending && (
            <Card className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-brand-carbon">Decision</h2>
              <div className="mb-3 flex gap-2">
                <Button variant={tab === "approve" ? "primary" : "secondary"} onClick={() => selectTab("approve")}>
                  Approve
                </Button>
                <Button variant={tab === "request_info" ? "primary" : "secondary"} onClick={() => selectTab("request_info")}>
                  Request more info
                </Button>
                <Button variant={tab === "decline" ? "danger" : "secondary"} onClick={() => selectTab("decline")}>
                  Decline
                </Button>
              </div>

              {tab === "approve" && detail.product.allocationModel === "exclusive_asset" && (
                <div className="mb-3">
                  <Label htmlFor="selectedAssetId">Allocate asset</Label>
                  <Select id="selectedAssetId" value={selectedAssetId} onChange={(event) => setSelectedAssetId(event.target.value)}>
                    <option value="">Keep as requested / no specific asset</option>
                    {detail.product.assetOptions.map((asset) => (
                      <option key={asset.id} value={asset.id} disabled={asset.availability.state === "unavailable"}>
                        {asset.name} — {asset.availability.state.replace(/_/g, " ")}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              <div className="mb-3">
                <Label htmlFor="decision-note">Note {tab === "request_info" ? "(required)" : "(optional)"}</Label>
                <TextArea id="decision-note" rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
              </div>

              <FieldError>{decisionError}</FieldError>
              <Button
                variant={tab === "decline" ? "danger" : "primary"}
                disabled={decisionSubmitting}
                onClick={submitDecision}
              >
                {decisionSubmitting
                  ? "Submitting…"
                  : tab === "approve"
                    ? "Approve request"
                    : tab === "decline"
                      ? "Decline request"
                      : "Send request for information"}
              </Button>
            </Card>
          )}

          {isApprovedNoContract && !draftContractId && (
            <Card className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-brand-carbon">Create draft contract</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="contract-startDate">Start date</Label>
                  <Input id="contract-startDate" type="date" value={contractStartDate} onChange={(event) => setContractStartDate(event.target.value)} />
                </div>
                <div>
                  <Label htmlFor="contract-endDate">End date</Label>
                  <Input id="contract-endDate" type="date" value={contractEndDate} onChange={(event) => setContractEndDate(event.target.value)} />
                </div>
                <div>
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input id="quantity" type="number" min={1} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
                </div>
                <div>
                  <Label htmlFor="unitRate">Unit rate (blank = price on request)</Label>
                  <Input id="unitRate" type="number" min={0} value={unitRate} onChange={(event) => setUnitRate(event.target.value)} />
                </div>
                <div>
                  <Label htmlFor="rateUnit">Rate unit</Label>
                  <Input id="rateUnit" value={rateUnit} onChange={(event) => setRateUnit(event.target.value)} placeholder="e.g. month" />
                </div>
                <div>
                  <Label htmlFor="lineTotal">Total price for this term (GBP)</Label>
                  <Input id="lineTotal" type="number" min={0} value={lineTotal} onChange={(event) => setLineTotal(event.target.value)} />
                </div>
              </div>
              <p className="mt-2 text-xs text-brand-carbon/50">
                {formatRate(detail.product.indicativeRate.amount, detail.product.indicativeRate.unit)} indicative rate — set the total price
                covering the full {formatDate(contractStartDate)} – {formatDate(contractEndDate)} term.
              </p>
              <FieldError>{contractError}</FieldError>
              <Button className="mt-3" disabled={contractSubmitting} onClick={submitContract}>
                {contractSubmitting ? "Creating…" : "Create draft contract"}
              </Button>
            </Card>
          )}

          {draftContractId && (
            <Card className="border-brand-success/30 bg-brand-success/10 p-4 text-sm">
              <p className="font-medium text-brand-carbon">{contractSummaryLabel(detail.contractStatus)}</p>
              <Link href={`/manager/contracts/${draftContractId}`}>
                <Button variant="secondary" className="mt-2">
                  View contract →
                </Button>
              </Link>
            </Card>
          )}
        </div>
      )}
    </main>
  );
}
