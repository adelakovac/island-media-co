"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ContractStatusBadge } from "@/components/portal/ContractStatusBadge";
import { ContractActionModal } from "@/components/portal/ContractActionModal";
import { useSession } from "@/lib/client/session";
import { apiFetch, ApiClientError } from "@/lib/client/api";
import { formatDate } from "@/lib/client/dates";
import { contractActionRequired } from "@/lib/contracts";
import type { ClientContractAction, ContractDetail, ProofRecord } from "@/lib/client/types";

function formatRate(unitRate: number | null, rateUnit: string | null): string {
  if (unitRate === null) return "Price on request";
  return `£${unitRate.toLocaleString()}${rateUnit ? ` / ${rateUnit}` : ""}`;
}

const CLIENT_REQUEST_STATUS_LABEL: Record<string, string> = {
  submitted: "Pending management review",
  acknowledged: "Acknowledged by management",
  resolved: "Resolved",
  declined: "Declined",
};

export default function ContractDetailPage() {
  const params = useParams<{ id: string }>();
  const { user, loading: sessionLoading } = useSession();

  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [activeAction, setActiveAction] = useState<ClientContractAction | null>(null);
  const [viewingProof, setViewingProof] = useState<ProofRecord | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    // A signed-in non-client (or no session at all) is guaranteed a FORBIDDEN
    // from the server - render the same message it would give without the
    // doomed, 403-logging request. A client whose org doesn't match this
    // contract still needs the real request, since only the server knows that.
    if (!user || user.role !== "client") {
      setContract(null);
      setError({ code: "FORBIDDEN", message: "Sign in as this contract's client to view it." });
      setLoading(false);
      return;
    }
    try {
      const data = await apiFetch<ContractDetail>(`/api/client/contracts/${params.id}`, { userId: user.id });
      setContract(data);
    } catch (err) {
      setContract(null);
      if (err instanceof ApiClientError) setError({ code: err.code, message: err.message });
      else setError({ code: "UNKNOWN", message: "Could not load this contract." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (sessionLoading) return;
    // Reload once the session has resolved (need a userId to send); load()
    // sets loading/error state itself, which is the intended behaviour here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading, user?.id, params.id]);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <Link href="/portal" className="text-sm text-brand-coral hover:underline">
        ← Back to your account
      </Link>

      {(loading || sessionLoading) && <p className="mt-6 text-sm text-brand-carbon/60">Loading…</p>}

      {error && !loading && !sessionLoading && (
        <Card className="mt-6 border-brand-danger/30 bg-brand-danger/10 p-4 text-sm text-brand-danger">
          {error.code === "FORBIDDEN"
            ? "Sign in as this contract's client to view it. Use the account switcher above."
            : error.message}
        </Card>
      )}

      {contract && !loading && !sessionLoading && (
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-brand-carbon">Contract {contract.id}</h1>
              <p className="text-sm text-brand-carbon/60">
                {formatDate(contract.startDate)} – {formatDate(contract.endDate)} · v{contract.version}
              </p>
            </div>
            <ContractStatusBadge status={contract.status} />
          </div>

          {contractActionRequired(contract.status) && (
            <Card className="border-brand-warning/30 bg-brand-warning/10 p-3 text-sm font-medium text-brand-warning">
              {contractActionRequired(contract.status)}
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            <Button disabled={contract.status !== "issued"} onClick={() => setActiveAction("accept")}>
              Accept contract
            </Button>
            <Button
              variant="secondary"
              disabled={contract.status !== "issued" && contract.status !== "accepted"}
              onClick={() => setActiveAction("request_changes")}
            >
              Request changes
            </Button>
            <Button
              variant="ghost"
              disabled={contract.status === "completed" || contract.status === "cancelled"}
              onClick={() => setActiveAction("request_cancellation")}
            >
              Request cancellation
            </Button>
          </div>
          <p className="text-xs text-brand-carbon/50">
            This is a prototype acceptance flow, not a legal electronic signature. Changes and cancellations stay
            pending until management reviews them here.
          </p>

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
                  {contract.items.map((item) => (
                    <tr key={item.id} className="border-b border-brand-carbon/5 last:border-0">
                      <td className="py-2 pr-2 text-brand-carbon">{item.productName}</td>
                      <td className="py-2 pr-2 text-brand-carbon/70">
                        {item.assetName ?? item.capacityPoolName ?? "—"}
                      </td>
                      <td className="py-2 pr-2 text-brand-carbon/70">{item.quantity}</td>
                      <td className="py-2 pr-2 text-brand-carbon/70">{formatRate(item.unitRate, item.rateUnit)}</td>
                      <td className="py-2 text-right font-medium text-brand-carbon">
                        £{item.lineTotal.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} className="pt-2 text-right text-xs font-medium uppercase text-brand-carbon/50">
                      Total
                    </td>
                    <td className="pt-2 text-right text-sm font-semibold text-brand-carbon">
                      {contract.currency} {contract.total.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="mb-2 text-sm font-semibold text-brand-carbon">Campaign</h2>
            {contract.campaign ? (
              <div className="text-sm">
                <p className="font-medium text-brand-carbon">{contract.campaign.name}</p>
                <p className="mt-1 text-brand-carbon/60">
                  Status: <span className="capitalize">{contract.campaign.status.replace(/_/g, " ")}</span> · Stage:{" "}
                  <span className="capitalize">{contract.campaign.currentStage.replace(/_/g, " ")}</span>
                </p>
              </div>
            ) : (
              <p className="text-sm text-brand-carbon/60">
                A campaign will appear here once the contract is accepted and activated.
              </p>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="mb-2 text-sm font-semibold text-brand-carbon">Campaign & service timeline</h2>
            {contract.serviceEvents.length === 0 ? (
              <p className="text-sm text-brand-carbon/60">No service updates yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {contract.serviceEvents.map((event) => (
                  <li key={event.id} className="border-l-2 border-brand-coral/40 pl-3 text-sm">
                    <p className="font-medium text-brand-carbon">{event.title}</p>
                    <p className="text-xs text-brand-carbon/50">{new Date(event.at).toLocaleString("en-GB")}</p>
                    {event.clientSummary && <p className="mt-0.5 text-brand-carbon/70">{event.clientSummary}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {contract.proofRecords.length > 0 && (
            <Card className="p-4">
              <h2 className="mb-2 text-sm font-semibold text-brand-carbon">Proof of completed work</h2>
              <ul className="flex flex-col gap-3">
                {contract.proofRecords.map((proof) => (
                  <li key={proof.id} className="rounded-md border border-brand-carbon/10 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-brand-carbon">{proof.fileName}</span>
                      <span className="text-xs text-brand-carbon/50">
                        {new Date(proof.createdAt).toLocaleDateString("en-GB")}
                      </span>
                    </div>
                    {proof.previewUrl && (
                      <button
                        type="button"
                        onClick={() => setViewingProof(proof)}
                        className="mt-2 block w-full"
                        aria-label={`View full-size proof photo: ${proof.fileName}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={proof.previewUrl}
                          alt={`Proof: ${proof.fileName}`}
                          className="max-h-48 w-full cursor-pointer rounded-md border border-brand-carbon/10 object-cover transition-opacity hover:opacity-90"
                        />
                      </button>
                    )}
                    <p className="mt-1 text-brand-carbon/70">{proof.completionNote}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="p-4">
            <h2 className="mb-2 text-sm font-semibold text-brand-carbon">Your requests</h2>
            {contract.clientRequests.length === 0 ? (
              <p className="text-sm text-brand-carbon/60">No change or cancellation requests submitted.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {contract.clientRequests.map((clientRequest) => (
                  <li key={clientRequest.id} className="rounded-md border border-brand-carbon/10 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium capitalize text-brand-carbon">
                        {clientRequest.type.replace(/_/g, " ")}
                      </span>
                      <span className="rounded-full bg-brand-warning/10 px-2 py-0.5 text-xs font-medium text-brand-warning">
                        {CLIENT_REQUEST_STATUS_LABEL[clientRequest.status] ?? clientRequest.status}
                      </span>
                    </div>
                    <p className="mt-1 text-brand-carbon/70">{clientRequest.summary}</p>
                    <p className="mt-1 text-xs text-brand-carbon/50">
                      Submitted {new Date(clientRequest.createdAt).toLocaleString("en-GB")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {activeAction && (
            <ContractActionModal
              open
              onClose={() => setActiveAction(null)}
              contractId={contract.id}
              action={activeAction}
              title={
                activeAction === "accept"
                  ? "Accept contract"
                  : activeAction === "request_changes"
                    ? "Request changes"
                    : "Request cancellation"
              }
              description={
                activeAction === "accept"
                  ? "Accepting activates your campaign and booking. This is a prototype acceptance, not a legal signature."
                  : activeAction === "request_changes"
                    ? "Describe the changes you need. Management will review and follow up — this does not change the contract yet."
                    : "Tell us why you'd like to cancel. Management will review the request before anything is cancelled."
              }
              noteLabel={activeAction === "accept" ? "Note (optional)" : "Details"}
              noteRequired={activeAction !== "accept"}
              confirmLabel={
                activeAction === "accept"
                  ? "Accept"
                  : activeAction === "request_changes"
                    ? "Submit request"
                    : "Submit cancellation request"
              }
              variant={activeAction === "request_cancellation" ? "danger" : "primary"}
              onSuccess={(detail) => setContract(detail)}
            />
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
        </div>
      )}
    </main>
  );
}
