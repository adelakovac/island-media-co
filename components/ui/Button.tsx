"use client";

import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT_CLASSES: Record<Variant, string> = {
  // Carbon text on Signal Coral: passes WCAG AA contrast, unlike white-on-coral.
  primary: "bg-brand-coral text-brand-carbon font-semibold hover:brightness-95 disabled:bg-slate-300 disabled:text-slate-500",
  secondary:
    "bg-white text-brand-carbon border border-brand-carbon/30 hover:border-brand-coral hover:text-brand-coral disabled:opacity-50",
  ghost: "bg-transparent text-brand-carbon hover:bg-brand-carbon/5 disabled:opacity-50",
  danger: "bg-brand-danger text-white hover:opacity-90 disabled:bg-slate-300",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-control px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)] disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
