"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/client/session";
import { apiFetch } from "@/lib/client/api";
import type { SwitchableUser } from "@/lib/client/types";

const SIGNUP_VALUE = "__signup__";

export function RoleSwitcher({ layout = "bar" }: { layout?: "bar" | "sidebar" } = {}) {
  const { user, organisation, login, logout } = useSession();
  const router = useRouter();
  const [switching, setSwitching] = useState(false);
  const [users, setUsers] = useState<SwitchableUser[]>([]);

  useEffect(() => {
    // Refetch on every session change (not just on mount) so a client who just
    // self-registered via /auth/register shows up here immediately, without
    // needing a full page reload, the moment their new session is set.
    let cancelled = false;
    apiFetch<{ items: SwitchableUser[] }>("/api/session/users")
      .then((data) => {
        if (!cancelled) setUsers(data.items);
      })
      .catch(() => {
        // Leave the previous list in place - a stale list is better than an empty one.
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  async function handleChange(value: string) {
    if (value === "") {
      logout();
      return;
    }
    if (value === SIGNUP_VALUE) {
      router.push("/portal/signup");
      return;
    }
    setSwitching(true);
    try {
      await login(value);
    } finally {
      setSwitching(false);
    }
  }

  const managers = users.filter((option) => option.role === "manager");
  const fitters = users.filter((option) => option.role === "fitter");
  const clients = users.filter((option) => option.role === "client");

  const dark = layout === "sidebar" || user?.role === "manager" || user?.role === "fitter";
  const initials = user
    ? user.name
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : null;

  const selectClassName = dark
    ? "rounded-control border border-brand-warm-white/20 bg-brand-carbon px-2 py-1.5 text-sm text-brand-warm-white outline-none focus:border-brand-coral"
    : "rounded-control border border-brand-mist bg-white px-2 py-1.5 text-sm text-brand-carbon outline-none focus:border-brand-coral";

  const selectEl = (
    <select
      aria-label="Switch prototype user"
      value={user?.id ?? ""}
      disabled={switching}
      onChange={(event) => handleChange(event.target.value)}
      className={layout === "sidebar" ? `${selectClassName} w-full` : selectClassName}
    >
      <option value="">Not signed in</option>
      <optgroup label="Manager">
        {managers.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </optgroup>
      <optgroup label="Fitter">
        {fitters.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </optgroup>
      <optgroup label="Existing client">
        {clients.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name} ({option.organisationName ?? "no organisation"})
          </option>
        ))}
      </optgroup>
      <option value={SIGNUP_VALUE}>New client signup…</option>
    </select>
  );

  if (layout === "sidebar") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          {initials && (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-coral text-xs font-bold text-brand-carbon">
              {initials}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-brand-warm-white">{user ? user.name : "Not signed in"}</p>
            {user && (
              <p className="truncate text-xs text-brand-warm-white/60">
                {user.role}
                {organisation ? ` · ${organisation.name}` : ""}
              </p>
            )}
          </div>
        </div>
        {selectEl}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {initials && (
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-coral text-xs font-bold text-brand-carbon">
          {initials}
        </span>
      )}
      {user && (
        <span className={`hidden text-xs sm:inline ${dark ? "text-brand-warm-white/70" : "text-brand-carbon/70"}`}>
          {user.name} · {user.role}
          {organisation ? ` · ${organisation.name}` : ""}
        </span>
      )}
      {selectEl}
    </div>
  );
}
