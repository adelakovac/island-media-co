import type { StatusTone } from "@/lib/status-tone";

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-brand-carbon/5 text-brand-carbon",
  warning: "bg-brand-warning/10 text-brand-warning",
  positive: "bg-brand-success/10 text-brand-success",
  negative: "bg-brand-danger/10 text-brand-danger",
};

export function StatusBadge({ label, tone }: { label: string; tone: StatusTone }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${TONE_CLASSES[tone]}`}>
      {label.replace(/_/g, " ")}
    </span>
  );
}
