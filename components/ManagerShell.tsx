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
  const { user, loading } = useSession();

  // Only show the manager sidebar chrome once we know for certain the signed-in
  // user is a manager. While the session is still being restored (e.g. fresh
  // page load, session state not yet propagated), `user` is briefly null - stay
  // on the non-manager branch rather than flashing the sidebar, since we don't
  // yet know whether it's warranted.
  const isManager = !loading && user?.role === "manager";

  // Keep the same wrapper element (a div, not a Fragment) across both branches
  // so `children` stays at the same position in the tree when `isManager` flips.
  // Swapping element types here would make React tear down and remount
  // `children` on every role change while sitting on a /manager URL, which
  // discards the page's in-flight state and looks like the sidebar "isn't
  // appearing" until something (like a nav click) forces a fresh mount.
  return (
    <div className="flex w-full flex-1 items-stretch">
      {isManager && (
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
      )}

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
