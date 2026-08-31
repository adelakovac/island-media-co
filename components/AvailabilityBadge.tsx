import type { AvailabilityState } from "@/lib/client/types";

const LABELS: Record<AvailabilityState, string> = {
  available: "Available",
  unavailable: "Unavailable",
  confirmation_required: "Confirmation required",
};

const CLASSES: Record<AvailabilityState, string> = {
  available: "bg-brand-teal-100 text-brand-teal-600",
  unavailable: "bg-brand-red-100 text-brand-red-600",
  confirmation_required: "bg-brand-amber-100 text-brand-amber-500",
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
