"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/client/session";
import { RoleSwitcher } from "./RoleSwitcher";
import { RoleNav } from "./RoleNav";

export function Header() {
  const { user } = useSession();
  const pathname = usePathname();
  const dark = user?.role === "manager" || user?.role === "fitter";

  // The manager area has its own persistent Carbon sidebar (see ManagerShell),
  // which carries the logo, nav and account switcher instead of this bar - but
  // only while the signed-in user is actually a manager. Otherwise (signed out,
  // or switched to another role while still on a /manager URL), this bar stays
  // so RoleNav/RoleSwitcher remain the way back to /portal or /fitter.
  if (user?.role === "manager" && pathname.startsWith("/manager")) return null;

  return (
    <header className={dark ? "bg-brand-carbon" : "border-b border-brand-mist bg-brand-warm-white"}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/portal" className="flex items-center">
          <Image
            src={dark ? "/brand/island-media-primary-reverse.svg" : "/brand/island-media-primary.svg"}
            alt="Island Media Co"
            width={155}
            height={50}
            className="h-10 w-auto"
            priority
          />
        </Link>
        <RoleNav />
        <RoleSwitcher />
      </div>
    </header>
  );
}
