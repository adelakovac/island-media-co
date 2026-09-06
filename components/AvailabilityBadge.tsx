import type { AvailabilityState } from "@/lib/client/types";

const LABELS: Record<AvailabilityState, string> = {
  available: "Available",
  unavailable: "Unavailable",
  confirmation_required: "Confirmation required",
};

const CLASSES: Record<AvailabilityState, string> = {
  available: "bg-brand-success/10 text-brand-success",
  unavailable: "bg-brand-danger/10 text-brand-danger",
  confirmation_required: "bg-brand-warning/10 text-brand-warning",
};

export function AvailabilityBadge({ state, title }: { state: AvailabilityState; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${CLASSES[state]}`}
    >
      {LABELS[state]}
    </span>
  );
}
