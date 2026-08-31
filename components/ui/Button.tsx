"use client";

import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-brand-teal-600 text-white hover:bg-brand-teal-500 disabled:bg-slate-300",
  secondary:
    "bg-white text-brand-navy-900 border border-brand-navy-700/30 hover:border-brand-teal-600 hover:text-brand-teal-600 disabled:opacity-50",
  ghost: "bg-transparent text-brand-navy-900 hover:bg-brand-navy-900/5 disabled:opacity-50",
  danger: "bg-brand-red-600 text-white hover:opacity-90 disabled:bg-slate-300",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
