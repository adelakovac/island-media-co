"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useSession } from "@/lib/client/session";
import { RoleSwitcher } from "./RoleSwitcher";

const NAV_LINKS: Array<{ href: string; label: string }> = [
  { href: "/manager", label: "Overview" },
  { href: "/manager/booking-requests", label: "Booking requests" },
];

export function ManagerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useSession();

  // Only show the manager sidebar chrome when the signed-in user is actually a
  // manager. If they aren't (signed out, or switched to another role without
  // leaving a /manager URL), fall back to plain content so the shared Header -
  // with RoleNav/RoleSwitcher for whatever role is now active - is the way back
  // to /portal or /fitter, instead of trapping them behind this sidebar.
  if (user?.role !== "manager") {
    return <>{children}</>;
  }

  return (
    <div className="flex w-full flex-1 items-stretch">
      <aside className="sticky top-0 flex h-screen w-[250px] shrink-0 flex-col overflow-y-auto bg-brand-carbon px-6 pb-7 pt-8">
        <Link href="/manager" className="mb-14 flex items-center">
          <Image
            src="/brand/island-media-primary-reverse.svg"
            alt="Island Media Co"
            width={155}
            height={50}
            className="h-9 w-auto"
          />
        </Link>

        <nav className="flex flex-col gap-2">
          {NAV_LINKS.map((link) => {
            const active = link.href === "/manager" ? pathname === link.href : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={
                  active
                    ? "flex min-h-[46px] items-center rounded-control bg-brand-coral px-3.5 text-[15px] font-semibold text-brand-carbon"
                    : "flex min-h-[46px] items-center rounded-control px-3.5 text-[15px] font-semibold text-brand-warm-white/60 hover:text-brand-warm-white"
                }
              >
                <span className="mr-3 h-2 w-2 shrink-0 bg-current" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-brand-warm-white/10 pt-5">
          <RoleSwitcher layout="sidebar" />
        </div>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
