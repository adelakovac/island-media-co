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
  draft: "bg-brand-carbon/5 text-brand-carbon",
  issued: "bg-brand-warning/10 text-brand-warning",
  change_requested: "bg-brand-warning/10 text-brand-warning",
  accepted: "bg-brand-success/10 text-brand-success",
  active: "bg-brand-success/10 text-brand-success",
  completed: "bg-brand-carbon/5 text-brand-carbon",
  cancelled: "bg-brand-danger/10 text-brand-danger",
};

export function ContractStatusBadge({ status }: { status: string }) {
  const className = CLASSES[status] ?? "bg-brand-carbon/5 text-brand-carbon";
  const label = LABELS[status] ?? status.replace(/_/g, " ");
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${className}`}>
      {label}
    </span>
  );
}
