"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Label, TextArea, FieldError } from "@/components/ui/Field";
import { apiFetch, ApiClientError, newIdempotencyKey } from "@/lib/client/api";
import { useSession } from "@/lib/client/session";
import type { ClientContractAction, ContractDetail } from "@/lib/client/types";

interface ContractActionModalProps {
  open: boolean;
  onClose: () => void;
  contractId: string;
  action: ClientContractAction;
  title: string;
  description: string;
  noteLabel: string;
  noteRequired?: boolean;
  confirmLabel: string;
  variant?: "primary" | "danger";
  onSuccess: (detail: ContractDetail) => void;
}

export function ContractActionModal({
  open,
  onClose,
  contractId,
  action,
  title,
  description,
  noteLabel,
  noteRequired,
  confirmLabel,
  variant = "primary",
  onSuccess,
}: ContractActionModalProps) {
  const { user } = useSession();
  const idempotencyKey = useMemo(() => newIdempotencyKey(), [open, contractId, action]);

  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // Reset the form fields when the modal opens (possibly for a different action).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNote("");
    setError(null);
  }, [open, action]);

  if (!open) return null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    if (noteRequired && !note.trim()) {
      setError("Please add a note before submitting.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const detail = await apiFetch<ContractDetail>(`/api/client/contracts/${contractId}/actions`, {
        method: "POST",
        userId: user.id,
        idempotencyKey,
        body: { action, note: note.trim() || null },
      });
      onSuccess(detail);
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <p className="text-sm text-brand-navy-800/70">{description}</p>
        <div>
          <Label htmlFor="contract-action-note">{noteLabel}</Label>
          <TextArea
            id="contract-action-note"
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={noteRequired ? "Required" : "Optional"}
          />
        </div>
        <FieldError>{error}</FieldError>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant={variant} disabled={submitting}>
            {submitting ? "Submitting…" : confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
