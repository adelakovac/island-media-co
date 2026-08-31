import type { StatusTone } from "@/lib/status-tone";

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-brand-navy-900/5 text-brand-navy-800",
  warning: "bg-brand-amber-100 text-brand-amber-500",
  positive: "bg-brand-teal-100 text-brand-teal-600",
  negative: "bg-brand-red-100 text-brand-red-600",
};

export function StatusBadge({ label, tone }: { label: string; tone: StatusTone }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${TONE_CLASSES[tone]}`}>
      {label.replace(/_/g, " ")}
    </span>
  );
}
