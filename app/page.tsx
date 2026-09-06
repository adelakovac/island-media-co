import Link from "next/link";
import { Card } from "@/components/ui/Card";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-3xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-3xl font-semibold text-brand-carbon">Island Media Co</h1>
      <p className="mt-2 max-w-md text-brand-carbon/70">
        A prototype booking platform for advertising space across transport, digital and street media.
      </p>
      <Card className="mt-8 flex w-full max-w-sm flex-col gap-3 p-6 text-left">
        <Link
          href="/portal"
          className="rounded-control bg-brand-coral px-4 py-2 text-center text-sm font-semibold text-brand-carbon hover:brightness-95"
        >
          Open client portal
        </Link>
        <p className="text-xs text-brand-carbon/60">
          Use the switcher at the top of the page to sign in as a seeded manager, fitter or client, or sign up as a
          new client.
        </p>
      </Card>
    </main>
  );
}
