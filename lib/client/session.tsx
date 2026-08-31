"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch, ApiClientError } from "./api";
import type { Organisation, Session, User } from "./types";

const STORAGE_KEY = "islandmedia.prototypeUserId";

interface SessionContextValue {
  user: User | null;
  organisation: Organisation | null;
  loading: boolean;
  login: (userId: string) => Promise<void>;
  setSession: (session: Session) => void;
  logout: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organisation, setOrganisation] = useState<Organisation | null>(null);
  const [loading, setLoading] = useState(true);

  const setSession = useCallback((session: Session) => {
    setUser(session.user);
    setOrganisation(session.organisation);
    window.localStorage.setItem(STORAGE_KEY, session.user.id);
  }, []);

  const login = useCallback(
    async (userId: string) => {
      const session = await apiFetch<Session>("/api/session/switch", { method: "POST", body: { userId } });
      setSession(session);
    },
    [setSession],
  );

  const logout = useCallback(() => {
    setUser(null);
    setOrganisation(null);
    window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  useEffect(() => {
    const savedUserId = window.localStorage.getItem(STORAGE_KEY);
    if (!savedUserId) {
      // No saved session to restore, so there is nothing left to await.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    login(savedUserId)
      .catch((error) => {
        if (error instanceof ApiClientError) {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      })
      .finally(() => setLoading(false));
    // Only run once on mount - `login` is stable via useCallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({ user, organisation, loading, login, setSession, logout }),
    [user, organisation, loading, login, setSession, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used within a SessionProvider");
  return context;
}
