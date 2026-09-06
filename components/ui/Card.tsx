import type { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-surface border border-brand-mist bg-white shadow-[var(--shadow-surface)] ${className}`}
      {...props}
    />
  );
}
