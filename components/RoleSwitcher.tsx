"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/client/session";
import { apiFetch } from "@/lib/client/api";
import type { SwitchableUser } from "@/lib/client/types";

const SIGNUP_VALUE = "__signup__";

export function RoleSwitcher() {
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

  return (
    <div className="flex items-center gap-3">
      {user && (
        <span className="hidden text-xs text-white/70 sm:inline">
          {user.name} · {user.role}
          {organisation ? ` · ${organisation.name}` : ""}
        </span>
      )}
      <select
        aria-label="Switch prototype user"
        value={user?.id ?? ""}
        disabled={switching}
        onChange={(event) => handleChange(event.target.value)}
        className="rounded-md border border-white/20 bg-brand-navy-800 px-2 py-1.5 text-sm text-white outline-none focus:border-brand-teal-500"
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
    </div>
  );
}
