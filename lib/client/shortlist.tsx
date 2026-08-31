"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "islandmedia.shortlist";

export interface ShortlistItem {
  productId: string;
  name: string;
  rateLabel: string;
}

interface ShortlistContextValue {
  items: ShortlistItem[];
  add: (item: ShortlistItem) => void;
  remove: (productId: string) => void;
  has: (productId: string) => boolean;
}

const ShortlistContext = createContext<ShortlistContextValue | null>(null);

export function ShortlistProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ShortlistItem[]>([]);

  useEffect(() => {
    // Hydrate from localStorage post-mount only: it's unavailable during SSR,
    // and reading it in a lazy useState initializer would mismatch the server
    // render (always empty) against a non-empty client value.
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setItems(JSON.parse(saved));
    } catch {
      // ignore malformed storage
    }
  }, []);

  const add = useCallback((item: ShortlistItem) => {
    setItems((current) => {
      if (current.some((existing) => existing.productId === item.productId)) return current;
      const next = [...current, item];
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const remove = useCallback((productId: string) => {
    setItems((current) => {
      const next = current.filter((item) => item.productId !== productId);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const has = useCallback((productId: string) => items.some((item) => item.productId === productId), [items]);

  const value = useMemo(() => ({ items, add, remove, has }), [items, add, remove, has]);

  return <ShortlistContext.Provider value={value}>{children}</ShortlistContext.Provider>;
}

export function useShortlist(): ShortlistContextValue {
  const context = useContext(ShortlistContext);
  if (!context) throw new Error("useShortlist must be used within a ShortlistProvider");
  return context;
}
