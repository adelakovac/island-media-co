"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Label, TextArea, FieldError } from "@/components/ui/Field";
import { apiFetch, ApiClientError, newIdempotencyKey } from "@/lib/client/api";
import { useSession } from "@/lib/client/session";

interface CompleteJobModalProps {
  open: boolean;
  onClose: () => void;
  workOrderId: string;
  onSuccess: () => void;
}

export function CompleteJobModal({ open, onClose, workOrderId, onSuccess }: CompleteJobModalProps) {
  const { user } = useSession();
  const idempotencyKey = useMemo(() => newIdempotencyKey(), [open, workOrderId]);

  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [needsRetry, setNeedsRetry] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Reset the form fields when the modal opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNote("");
    setFile(null);
    setPreviewUrl(null);
    setError(null);
    setNeedsRetry(false);
    setOffline(typeof navigator !== "undefined" ? !navigator.onLine : false);
  }, [open, workOrderId]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const submit = useCallback(async () => {
    if (!user || !file) return;
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("completionNote", note.trim());
      await apiFetch(`/api/mobile/work-orders/${workOrderId}/proof`, {
        method: "POST",
        userId: user.id,
        idempotencyKey,
        body: formData,
      });
      setNeedsRetry(false);
      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
        setNeedsRetry(false);
      } else {
        // Fetch itself threw (offline / connection dropped) rather than the server responding -
        // this is the "weak signal" case the field app needs to recover from gracefully.
        setNeedsRetry(true);
        setError("Upload failed - we'll retry automatically once you're back online, or tap Retry now.");
      }
    } finally {
      setSubmitting(false);
    }
  }, [user, file, note, workOrderId, idempotencyKey, onSuccess, onClose]);

  useEffect(() => {
    function handleOnline() {
      setOffline(false);
      if (needsRetry) void submit();
    }
    function handleOffline() {
      setOffline(true);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [needsRetry, submit]);

  if (!open) return null;

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return selected ? URL.createObjectURL(selected) : null;
    });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Attach a photo to confirm completion.");
      return;
    }
    if (note.trim().length < 3) {
      setError("Add a completion note of at least 3 characters.");
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setOffline(true);
      setNeedsRetry(true);
      setError(null);
      return;
    }
    void submit();
  }

  return (
    <Modal open={open} onClose={onClose} title="Complete job">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {offline && (
          <p className="rounded-md bg-brand-warning/10 px-3 py-2 text-xs font-medium text-brand-warning">
            You&apos;re offline. This will send automatically once you&apos;re back online.
          </p>
        )}
        <div>
          <Label htmlFor="completion-note">Completion note</Label>
          <TextArea
            id="completion-note"
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="What was done, and any details management should know"
          />
        </div>
        <div>
          <Label htmlFor="proof-file">Proof photo</Label>
          <input
            id="proof-file"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="block w-full text-sm text-brand-carbon file:mr-3 file:rounded-md file:border-0 file:bg-brand-carbon/5 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-carbon"
          />
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Selected proof preview"
              className="mt-2 max-h-48 w-full rounded-md border border-brand-carbon/10 object-cover"
            />
          )}
        </div>
        <FieldError>{error}</FieldError>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || offline}>
            {submitting ? "Uploading…" : offline ? "Waiting for connection…" : needsRetry ? "Retry upload" : "Mark completed"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
