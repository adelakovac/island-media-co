"use client";

import type { ReactNode } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-carbon/50 p-4 pt-16">
      <div className="w-full max-w-lg rounded-surface bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-brand-carbon/10 px-5 py-4">
          <h2 className="text-base font-semibold text-brand-carbon">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-control p-1 text-brand-carbon hover:bg-brand-carbon/5"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
