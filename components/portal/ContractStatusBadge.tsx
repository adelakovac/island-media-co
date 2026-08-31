const LABELS: Record<string, string> = {
  draft: "Draft",
  issued: "Issued",
  change_requested: "Change requested",
  accepted: "Accepted",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};

const CLASSES: Record<string, string> = {
  draft: "bg-brand-navy-900/5 text-brand-navy-800",
  issued: "bg-brand-amber-100 text-brand-amber-500",
  change_requested: "bg-brand-amber-100 text-brand-amber-500",
  accepted: "bg-brand-teal-100 text-brand-teal-600",
  active: "bg-brand-teal-100 text-brand-teal-600",
  completed: "bg-brand-navy-900/5 text-brand-navy-800",
  cancelled: "bg-brand-red-100 text-brand-red-600",
};

export function ContractStatusBadge({ status }: { status: string }) {
  const className = CLASSES[status] ?? "bg-brand-navy-900/5 text-brand-navy-800";
  const label = LABELS[status] ?? status.replace(/_/g, " ");
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${className}`}>
      {label}
    </span>
  );
}
