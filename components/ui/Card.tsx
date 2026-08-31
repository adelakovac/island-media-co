import type { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-lg border border-brand-navy-900/10 bg-white shadow-sm ${className}`}
      {...props}
    />
  );
}
