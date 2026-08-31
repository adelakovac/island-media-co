"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "@/lib/client/session";
import { ShortlistProvider } from "@/lib/client/shortlist";
import { Header } from "@/components/Header";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ShortlistProvider>
        <Header />
        {children}
      </ShortlistProvider>
    </SessionProvider>
  );
}
