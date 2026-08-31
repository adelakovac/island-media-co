"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/client/session";

export function RoleNav() {
  const { user } = useSession();
  const pathname = usePathname();

  if (!user) return null;

  const links: Array<{ href: string; label: string }> =
    user.role === "manager"
      ? [
          { href: "/manager", label: "Dashboard" },
          { href: "/manager/booking-requests", label: "Booking requests" },
        ]
      : user.role === "fitter"
        ? [{ href: "/fitter", label: "My jobs" }]
        : [{ href: "/portal", label: "Portal" }];

  return (
    <nav className="flex items-center gap-4 text-sm">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={pathname === link.href ? "font-medium text-brand-teal-500" : "text-white/80 hover:text-white"}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
