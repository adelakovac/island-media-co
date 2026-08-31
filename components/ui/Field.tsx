import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const CONTROL_CLASSES =
  "w-full rounded-md border border-brand-navy-900/20 bg-white px-3 py-2 text-sm text-brand-navy-900 outline-none focus:border-brand-teal-600 focus:ring-1 focus:ring-brand-teal-600 disabled:bg-slate-50 disabled:text-slate-400";

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-brand-navy-800">
      {children}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${CONTROL_CLASSES} ${props.className ?? ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${CONTROL_CLASSES} ${props.className ?? ""}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${CONTROL_CLASSES} ${props.className ?? ""}`} />;
}

export function FieldError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="mt-1 text-xs text-brand-red-600">{children}</p>;
}
