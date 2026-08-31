"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, TextArea, FieldError } from "@/components/ui/Field";
import { apiFetch, ApiClientError, newIdempotencyKey } from "@/lib/client/api";
import { useSession } from "@/lib/client/session";
import type { AssetOption, BookingRequest } from "@/lib/client/types";

interface RequestModalProps {
  open: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  assetOptions?: AssetOption[];
  defaultStartDate: string;
  defaultEndDate: string;
  onSubmitted?: () => void;
}

export function RequestModal({
  open,
  onClose,
  productId,
  productName,
  assetOptions,
  defaultStartDate,
  defaultEndDate,
  onSubmitted,
}: RequestModalProps) {
  const { user } = useSession();
  const idempotencyKey = useMemo(() => newIdempotencyKey(), [open, productId]);

  const [requestedAssetId, setRequestedAssetId] = useState("");
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [budget, setBudget] = useState("");
  const [objective, setObjective] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Reset the form fields when the modal opens for a (possibly new) product.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRequestedAssetId("");
    setStartDate(defaultStartDate);
    setEndDate(defaultEndDate);
    setBudget("");
    setObjective("");
    setNotes("");
    setError(null);
    setSuccess(false);
    // Only reset when the modal opens for a (possibly new) product.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, productId]);

  const canSubmit = user && user.role === "client" && user.organisationId;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit || !user) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch<BookingRequest>("/api/booking-requests", {
        method: "POST",
        userId: user.id,
        idempotencyKey,
        body: {
          productId,
          requestedAssetId: requestedAssetId || null,
          startDate,
          endDate,
          budget: Number(budget),
          objective,
          notes: notes || null,
        },
      });
      setSuccess(true);
      onSubmitted?.();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Submit request: ${productName}`}>
      {!canSubmit ? (
        <p className="text-sm text-brand-navy-800/70">
          Sign in as an existing client, or sign up, to submit an advertising request.
        </p>
      ) : success ? (
        <div className="text-sm">
          <p className="font-medium text-brand-teal-600">Request submitted.</p>
          <p className="mt-1 text-brand-navy-800/70">
            Our team will review it and follow up via your client summary.
          </p>
          <Button className="mt-4" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {assetOptions && assetOptions.length > 0 && (
            <div>
              <Label htmlFor="requestedAssetId">Preferred asset (optional)</Label>
              <Select
                id="requestedAssetId"
                value={requestedAssetId}
                onChange={(event) => setRequestedAssetId(event.target.value)}
              >
                <option value="">No preference</option>
                {assetOptions.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="req-startDate">Start date</Label>
              <Input
                id="req-startDate"
                type="date"
                required
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="req-endDate">End date</Label>
              <Input
                id="req-endDate"
                type="date"
                required
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="budget">Budget (GBP)</Label>
            <Input
              id="budget"
              type="number"
              min={0}
              step="1"
              required
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="objective">Objective</Label>
            <Input
              id="objective"
              required
              minLength={5}
              value={objective}
              onChange={(event) => setObjective(event.target.value)}
              placeholder="e.g. Promote our spring membership offer"
            />
          </div>
          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <TextArea id="notes" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>
          <FieldError>{error}</FieldError>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Submitting…" : "Submit request"}
          </Button>
        </form>
      )}
    </Modal>
  );
}
