import Link from "next/link";
import { RoleSwitcher } from "./RoleSwitcher";
import { RoleNav } from "./RoleNav";

export function Header() {
  return (
    <header className="bg-brand-navy-900 text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/portal" className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-brand-teal-500" />
          Island Media Co
        </Link>
        <RoleNav />
        <RoleSwitcher />
      </div>
    </header>
  );
}
