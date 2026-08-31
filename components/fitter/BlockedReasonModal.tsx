"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Label, TextArea, FieldError } from "@/components/ui/Field";
import { apiFetch, ApiClientError, newIdempotencyKey } from "@/lib/client/api";
import { useSession } from "@/lib/client/session";
import type { FitterWorkOrder } from "@/lib/client/fitter-types";

interface BlockedReasonModalProps {
  open: boolean;
  onClose: () => void;
  workOrderId: string;
  onSuccess: (workOrder: FitterWorkOrder) => void;
}

export function BlockedReasonModal({ open, onClose, workOrderId, onSuccess }: BlockedReasonModalProps) {
  const { user } = useSession();
  const idempotencyKey = useMemo(() => newIdempotencyKey(), [open, workOrderId]);

  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // Reset the form fields when the modal opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReason("");
    setError(null);
  }, [open, workOrderId]);

  if (!open) return null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    if (!reason.trim()) {
      setError("A reason is required to report a blocker.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const updated = await apiFetch<FitterWorkOrder>(`/api/mobile/work-orders/${workOrderId}/status`, {
        method: "POST",
        userId: user.id,
        idempotencyKey,
        body: { status: "blocked", note: reason.trim() },
      });
      onSuccess(updated);
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Report a blocker">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <p className="text-sm text-brand-navy-800/70">
          Let management know what&apos;s stopping this job so they can help resolve it.
        </p>
        <div>
          <Label htmlFor="blocked-reason">Reason</Label>
          <TextArea
            id="blocked-reason"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. No site access, access code not working"
          />
        </div>
        <FieldError>{error}</FieldError>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" disabled={submitting}>
            {submitting ? "Submitting…" : "Confirm blocked"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
