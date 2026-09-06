"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/client/session";

export function RoleNav() {
  const { user } = useSession();
  const pathname = usePathname();

  if (!user) return null;

  const dark = user.role === "manager" || user.role === "fitter";

  const links: Array<{ href: string; label: string }> =
    user.role === "manager"
      ? [
          { href: "/manager", label: "Overview" },
          { href: "/manager/booking-requests", label: "Booking requests" },
        ]
      : user.role === "fitter"
        ? [{ href: "/fitter", label: "My jobs" }]
        : [{ href: "/portal", label: "Portal" }];

  const inactiveClass = dark ? "text-brand-warm-white/70 hover:text-brand-warm-white" : "text-brand-carbon/70 hover:text-brand-carbon";

  return (
    <nav className="flex items-center gap-4 text-sm">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={
            pathname === link.href
              ? "font-semibold text-brand-coral underline decoration-2 underline-offset-8"
              : inactiveClass
          }
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
