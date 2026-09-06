"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, TextArea, FieldError } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { ContractStatusBadge } from "@/components/portal/ContractStatusBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { useSession } from "@/lib/client/session";
import { apiFetch, ApiClientError, newIdempotencyKey } from "@/lib/client/api";
import { formatDate, toDateTimeInputValue } from "@/lib/client/dates";
import { now as fixtureNow } from "@/lib/fixture-clock";
import { workOrderTone, clientRequestTone } from "@/lib/status-tone";
import { SEEDED_FITTERS } from "@/lib/client/seeded-users";
import type { ManagementContractDetail } from "@/lib/client/management-types";
import type { ClientRequestRecord, ManagementClientRequestAction, ProofRecord } from "@/lib/client/types";

const WORK_ORDER_TYPES = ["survey", "production", "installation", "maintenance", "removal"] as const;

function formatRate(unitRate: number | null, rateUnit: string | null): string {
  if (unitRate === null) return "Price on request";
  return `£${unitRate.toLocaleString()}${rateUnit ? ` / ${rateUnit}` : ""}`;
}

export default function ManagerContractDetailPage() {
  const params = useParams<{ id: string }>();
  const { user, loading: sessionLoading } = useSession();

  const [detail, setDetail] = useState<ManagementContractDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const issueIdempotencyKey = useMemo(() => newIdempotencyKey(), [detail?.id]);

  const [viewingProof, setViewingProof] = useState<ProofRecord | null>(null);

  const [openClientRequestId, setOpenClientRequestId] = useState<string | null>(null);
  const [clientRequestNote, setClientRequestNote] = useState("");
  const [clientRequestSubmitting, setClientRequestSubmitting] = useState(false);
  const [clientRequestError, setClientRequestError] = useState<string | null>(null);

  const distinctAssets = useMemo(() => {
    if (!detail) return [];
    const seen = new Map<string, string>();
    for (const item of detail.items) {
      if (item.assetId && item.assetName) seen.set(item.assetId, item.assetName);
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [detail]);

  const [woType, setWoType] = useState<(typeof WORK_ORDER_TYPES)[number]>("installation");
  const [woAssignedUserId, setWoAssignedUserId] = useState(SEEDED_FITTERS[0]?.id ?? "");
  const [woAssetId, setWoAssetId] = useState("");
  const [woScheduledStart, setWoScheduledStart] = useState(() => {
    const start = new Date(fixtureNow().getTime() + 3 * 86_400_000);
    return toDateTimeInputValue(start);
  });
  const [woScheduledEnd, setWoScheduledEnd] = useState(() => {
    const start = new Date(fixtureNow().getTime() + 3 * 86_400_000);
    return toDateTimeInputValue(new Date(start.getTime() + 2 * 60 * 60 * 1000));
  });
  const [woLocationLabel, setWoLocationLabel] = useState("");
  const [woInstructions, setWoInstructions] = useState("");
  const [woSubmitting, setWoSubmitting] = useState(false);
  const [woError, setWoError] = useState<string | null>(null);
  const woIdempotencyKey = useMemo(() => newIdempotencyKey(), [detail?.workOrders.length]);

  async function load() {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<ManagementContractDetail>(`/api/management/contracts/${params.id}`, { userId: user.id });
      setDetail(data);
      if (!woAssetId && data.items.some((item) => item.assetId)) {
        setWoAssetId(data.items.find((item) => item.assetId)?.assetId ?? "");
      }
      if (!woLocationLabel) {
        const assetName = data.items.find((item) => item.assetId)?.assetName;
        if (assetName) setWoLocationLabel(assetName);
      }
    } catch (err) {
      setDetail(null);
      setError(err instanceof ApiClientError ? err.message : "Could not load this contract.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (sessionLoading) return;
    // A non-manager session renders the "sign in as a manager" message below
    // unconditionally (see the early return further down), so there is no
    // point making a doomed, 403-logging request for it.
    if (!user || user.role !== "manager") return;
    // Fetch-on-mount/param-change: load() sets loading/error state itself.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading, user?.id, params.id]);

  async function issueContract() {
    if (!user || !detail) return;
    setIssuing(true);
    setIssueError(null);
    try {
      await apiFetch(`/api/management/contracts/${detail.id}/issue`, {
        method: "POST",
        userId: user.id,
        idempotencyKey: issueIdempotencyKey,
        body: {},
      });
      await load();
    } catch (err) {
      setIssueError(err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIssuing(false);
    }
  }

  function startClientRequestDecision(clientRequestId: string) {
    setOpenClientRequestId(clientRequestId);
    setClientRequestNote("");
    setClientRequestError(null);
  }

  async function decideClientRequest(clientRequestId: string, action: ManagementClientRequestAction) {
    if (!user) return;
    if (action === "decline" && !clientRequestNote.trim()) {
      setClientRequestError("A note is required when declining a client request.");
      return;
    }
    setClientRequestSubmitting(true);
    setClientRequestError(null);
    try {
      await apiFetch(`/api/management/client-requests/${clientRequestId}`, {
        method: "PATCH",
        userId: user.id,
        body: { action, note: clientRequestNote.trim() || null },
      });
      setOpenClientRequestId(null);
      setClientRequestNote("");
      await load();
    } catch (err) {
      setClientRequestError(err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setClientRequestSubmitting(false);
    }
  }

  async function createWorkOrder() {
    if (!user || !detail || !detail.campaign) return;
    setWoSubmitting(true);
    setWoError(null);
    try {
      if (!woAssetId) throw new Error("Select an asset for this job.");
      if (!woInstructions.trim()) throw new Error("Instructions are required.");
      await apiFetch(`/api/management/work-orders`, {
        method: "POST",
        userId: user.id,
        idempotencyKey: woIdempotencyKey,
        body: {
          campaignId: detail.campaign.id,
          contractId: detail.id,
          type: woType,
          assignedUserId: woAssignedUserId,
          assetId: woAssetId,
          scheduledStart: new Date(woScheduledStart).toISOString(),
          scheduledEnd: new Date(woScheduledEnd).toISOString(),
          locationLabel: woLocationLabel.trim(),
          instructions: woInstructions.trim(),
        },
      });
      setWoInstructions("");
      await load();
    } catch (err) {
      setWoError(err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setWoSubmitting(false);
    }
  }

  if (!sessionLoading && (!user || user.role !== "manager")) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <Card className="p-4 text-sm text-brand-carbon">
          Sign in as a manager to view this contract. Use the account switcher above.
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <Link href="/manager" className="text-sm text-brand-coral hover:underline">
        ← Back to dashboard
      </Link>

      {(loading || sessionLoading) && <p className="mt-6 text-sm text-brand-carbon/60">Loading…</p>}
      {error && !loading && <Card className="mt-6 border-brand-danger/30 bg-brand-danger/10 p-4 text-sm text-brand-danger">{error}</Card>}

      {detail && !loading && (
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-brand-carbon">{detail.organisationName}</h1>
              <p className="text-sm text-brand-carbon/60">
                Contract {detail.id} · {formatDate(detail.startDate)} – {formatDate(detail.endDate)} · v{detail.version}
              </p>
            </div>
            <ContractStatusBadge status={detail.status} />
          </div>

          {detail.status === "draft" && (
            <Card className="p-4">
              <p className="mb-2 text-sm text-brand-carbon/70">This contract is a draft. Issue it to send it to the client for review.</p>
              <FieldError>{issueError}</FieldError>
              <Button disabled={issuing} onClick={issueContract}>
                {issuing ? "Issuing…" : "Issue contract"}
              </Button>
            </Card>
          )}

          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-brand-carbon">Line items</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="border-b border-brand-carbon/10 text-xs uppercase tracking-wide text-brand-carbon/50">
                    <th className="pb-2 pr-2 font-medium">Product</th>
                    <th className="pb-2 pr-2 font-medium">Asset / pool</th>
                    <th className="pb-2 pr-2 font-medium">Qty</th>
                    <th className="pb-2 pr-2 font-medium">Rate</th>
                    <th className="pb-2 font-medium text-right">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((item) => (
                    <tr key={item.id} className="border-b border-brand-carbon/5 last:border-0">
                      <td className="py-2 pr-2 text-brand-carbon">{item.productName}</td>
                      <td className="py-2 pr-2 text-brand-carbon/70">{item.assetName ?? item.capacityPoolName ?? "—"}</td>
                      <td className="py-2 pr-2 text-brand-carbon/70">{item.quantity}</td>
                      <td className="py-2 pr-2 text-brand-carbon/70">{formatRate(item.unitRate, item.rateUnit)}</td>
                      <td className="py-2 text-right font-medium text-brand-carbon">£{item.lineTotal.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} className="pt-2 text-right text-xs font-medium uppercase text-brand-carbon/50">
                      Total
                    </td>
                    <td className="pt-2 text-right text-sm font-semibold text-brand-carbon">
                      {detail.currency} {detail.total.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="mb-2 text-sm font-semibold text-brand-carbon">Campaign</h2>
            {detail.campaign ? (
              <p className="text-sm">
                <span className="font-medium text-brand-carbon">{detail.campaign.name}</span>
                <span className="ml-2 text-brand-carbon/60 capitalize">
                  {detail.campaign.status.replace(/_/g, " ")} · {detail.campaign.currentStage.replace(/_/g, " ")}
                </span>
              </p>
            ) : (
              <p className="text-sm text-brand-carbon/60">A campaign is created automatically when the contract is issued.</p>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-brand-carbon">Work orders</h2>
            {detail.workOrders.length === 0 ? (
              <p className="mb-3 text-sm text-brand-carbon/60">No work orders yet.</p>
            ) : (
              <ul className="mb-4 flex flex-col gap-2">
                {detail.workOrders.map((workOrder) => (
                  <li key={workOrder.id} className="rounded-md border border-brand-carbon/10 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium capitalize text-brand-carbon">{workOrder.type}</span>
                      <StatusBadge label={workOrder.status} tone={workOrderTone(workOrder.status)} />
                    </div>
                    <p className="mt-1 text-brand-carbon/70">
                      {workOrder.assetName} · {workOrder.assignedUserName} · {new Date(workOrder.scheduledStart).toLocaleString("en-GB")}
                    </p>
                    <p className="mt-1 text-xs text-brand-carbon/50">{workOrder.locationLabel}</p>
                    <p className="mt-1 text-brand-carbon/70">{workOrder.instructions}</p>
                    {workOrder.internalNotes && (
                      <p className="mt-1 text-xs italic text-brand-carbon/60">Internal: {workOrder.internalNotes}</p>
                    )}
                    {workOrder.completionNote && (
                      <p className="mt-1 text-brand-carbon/70">Completion note: {workOrder.completionNote}</p>
                    )}
                    {workOrder.proofRecords.length > 0 && (
                      <ul className="mt-2 flex flex-col gap-2">
                        {workOrder.proofRecords.map((proof) => (
                          <li key={proof.id} className="text-xs text-brand-carbon/60">
                            <p>
                              Proof: {proof.fileName} — {proof.completionNote}
                            </p>
                            {proof.previewUrl && (
                              <button
                                type="button"
                                onClick={() => setViewingProof(proof)}
                                className="mt-1 block w-full"
                                aria-label={`View full-size proof photo: ${proof.fileName}`}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={proof.previewUrl}
                                  alt={`Proof: ${proof.fileName}`}
                                  className="max-h-32 w-full max-w-xs cursor-pointer rounded-md border border-brand-carbon/10 object-cover transition-opacity hover:opacity-90"
                                />
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {!detail.campaign ? (
              <p className="text-sm text-brand-carbon/60">Issue the contract to create a campaign before scheduling work.</p>
            ) : detail.campaign.status === "cancelled" ? (
              <p className="text-sm text-brand-carbon/60">This campaign was cancelled - no further work can be scheduled.</p>
            ) : distinctAssets.length === 0 ? (
              <p className="text-sm text-brand-carbon/60">
                This contract has no physical asset line item, so there is nothing for a fitter to install.
              </p>
            ) : (
              <div className="border-t border-brand-carbon/10 pt-3">
                <h3 className="mb-2 text-sm font-semibold text-brand-carbon">Create work order</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="wo-type">Job type</Label>
                    <Select id="wo-type" value={woType} onChange={(event) => setWoType(event.target.value as (typeof WORK_ORDER_TYPES)[number])}>
                      {WORK_ORDER_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="wo-fitter">Assign fitter</Label>
                    <Select id="wo-fitter" value={woAssignedUserId} onChange={(event) => setWoAssignedUserId(event.target.value)}>
                      {SEEDED_FITTERS.map((fitter) => (
                        <option key={fitter.id} value={fitter.id}>
                          {fitter.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="wo-asset">Asset</Label>
                    <Select id="wo-asset" value={woAssetId} onChange={(event) => setWoAssetId(event.target.value)}>
                      {distinctAssets.map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="wo-location">Location label</Label>
                    <Input id="wo-location" value={woLocationLabel} onChange={(event) => setWoLocationLabel(event.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="wo-start">Scheduled start</Label>
                    <Input id="wo-start" type="datetime-local" value={woScheduledStart} onChange={(event) => setWoScheduledStart(event.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="wo-end">Scheduled end</Label>
                    <Input id="wo-end" type="datetime-local" value={woScheduledEnd} onChange={(event) => setWoScheduledEnd(event.target.value)} />
                  </div>
                </div>
                <div className="mt-3">
                  <Label htmlFor="wo-instructions">Instructions for the fitter</Label>
                  <TextArea id="wo-instructions" rows={2} value={woInstructions} onChange={(event) => setWoInstructions(event.target.value)} />
                </div>
                <FieldError>{woError}</FieldError>
                <Button className="mt-3" disabled={woSubmitting} onClick={createWorkOrder}>
                  {woSubmitting ? "Creating…" : "Create work order"}
                </Button>
              </div>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="mb-2 text-sm font-semibold text-brand-carbon">Service history</h2>
            {detail.serviceEvents.length === 0 ? (
              <p className="text-sm text-brand-carbon/60">No service events yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {detail.serviceEvents.map((event) => (
                  <li key={event.id} className="border-l-2 border-brand-carbon/10 pl-3 text-sm">
                    <p className="text-brand-carbon">
                      {event.title} {!event.clientVisible && <span className="text-xs text-brand-carbon/40">(internal only)</span>}
                    </p>
                    <p className="text-xs text-brand-carbon/50">{new Date(event.at).toLocaleString("en-GB")}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {detail.clientRequests.length > 0 && (
            <Card className="p-4">
              <h2 className="mb-2 text-sm font-semibold text-brand-carbon">Client requests</h2>
              <ul className="flex flex-col gap-2">
                {detail.clientRequests.map((clientRequest: ClientRequestRecord) => (
                  <li key={clientRequest.id} className="rounded-md border border-brand-carbon/10 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium capitalize text-brand-carbon">{clientRequest.type.replace(/_/g, " ")}</span>
                      <StatusBadge label={clientRequest.status} tone={clientRequestTone(clientRequest.status)} />
                    </div>
                    <p className="mt-1 text-brand-carbon/70">{clientRequest.summary}</p>

                    {clientRequest.status === "submitted" && (
                      <div className="mt-3 border-t border-brand-carbon/10 pt-3">
                        {openClientRequestId === clientRequest.id ? (
                          <div>
                            <Label htmlFor={`client-request-note-${clientRequest.id}`}>Note (required to decline)</Label>
                            <TextArea
                              id={`client-request-note-${clientRequest.id}`}
                              rows={2}
                              value={clientRequestNote}
                              onChange={(event) => setClientRequestNote(event.target.value)}
                            />
                            <FieldError>{clientRequestError}</FieldError>
                            <div className="mt-2 flex gap-2">
                              <Button
                                disabled={clientRequestSubmitting}
                                onClick={() => decideClientRequest(clientRequest.id, "acknowledge")}
                              >
                                {clientRequestSubmitting ? "Submitting…" : "Acknowledge"}
                              </Button>
                              <Button
                                variant="danger"
                                disabled={clientRequestSubmitting}
                                onClick={() => decideClientRequest(clientRequest.id, "decline")}
                              >
                                {clientRequestSubmitting ? "Submitting…" : "Decline"}
                              </Button>
                              <Button
                                variant="secondary"
                                disabled={clientRequestSubmitting}
                                onClick={() => setOpenClientRequestId(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button variant="secondary" onClick={() => startClientRequestDecision(clientRequest.id)}>
                            Respond
                          </Button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {viewingProof && (
        <Modal open onClose={() => setViewingProof(null)} title={viewingProof.fileName}>
          {viewingProof.previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={viewingProof.previewUrl}
              alt={`Proof: ${viewingProof.fileName}`}
              className="max-h-[70vh] w-full rounded-md object-contain"
            />
          )}
          <p className="mt-3 text-sm text-brand-carbon/70">{viewingProof.completionNote}</p>
        </Modal>
      )}
    </main>
  );
}
