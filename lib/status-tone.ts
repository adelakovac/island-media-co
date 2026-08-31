export type StatusTone = "neutral" | "warning" | "positive" | "negative";

export function bookingRequestTone(status: string): StatusTone {
  if (status === "submitted" || status === "information_required") return "warning";
  if (status === "approved") return "positive";
  if (status === "declined") return "negative";
  return "neutral";
}

export function workOrderTone(status: string): StatusTone {
  if (status === "completed") return "positive";
  if (status === "blocked" || status === "cancelled") return "negative";
  if (status === "draft") return "neutral";
  return "warning"; // assigned | travelling | on_site
}

export function clientRequestTone(status: string): StatusTone {
  if (status === "submitted") return "warning";
  if (status === "resolved") return "positive";
  if (status === "declined") return "negative";
  return "neutral";
}
