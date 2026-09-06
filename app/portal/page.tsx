"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CatalogueFilters, type CatalogueFilterValues } from "@/components/portal/CatalogueFilters";
import { ProductCard } from "@/components/portal/ProductCard";
import { ShortlistPanel } from "@/components/portal/ShortlistPanel";
import { ClientSummarySection } from "@/components/portal/ClientSummarySection";
import { BookingRequestsSection } from "@/components/portal/BookingRequestsSection";
import { RequestModal } from "@/components/portal/RequestModal";
import { useSession } from "@/lib/client/session";
import { useShortlist } from "@/lib/client/shortlist";
import { apiFetch, ApiClientError } from "@/lib/client/api";
import { addDays, toDateInputValue } from "@/lib/client/dates";
import { now as fixtureNow } from "@/lib/fixture-clock";
import type { ProductSearchResponse } from "@/lib/client/types";

function defaultFilters(): CatalogueFilterValues {
  const base = fixtureNow();
  return {
    startDate: toDateInputValue(addDays(base, 14)),
    endDate: toDateInputValue(addDays(base, 44)),
    mediaType: "",
    locationId: "",
    maxMonthlyBudget: "",
  };
}

export default function PortalPage() {
  const { user, loading: sessionLoading } = useSession();
  const shortlist = useShortlist();

  const [filters, setFilters] = useState<CatalogueFilterValues>(defaultFilters);
  const [results, setResults] = useState<ProductSearchResponse | null>(null);
  const [searchLoading, setSearchLoading] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [requestModal, setRequestModal] = useState<{ productId: string; productName: string } | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  async function runSearch(values: CatalogueFilterValues) {
    setSearchLoading(true);
    setSearchError(null);
    try {
      const params = new URLSearchParams({ startDate: values.startDate, endDate: values.endDate });
      if (values.mediaType) params.set("mediaType", values.mediaType);
      if (values.locationId) params.set("locationId", values.locationId);
      if (values.maxMonthlyBudget) params.set("maxMonthlyBudget", values.maxMonthlyBudget);

      const data = await apiFetch<ProductSearchResponse>(`/api/products?${params.toString()}`);
      setResults(data);
    } catch (err) {
      setSearchError(err instanceof ApiClientError ? err.message : "Could not load the catalogue.");
    } finally {
      setSearchLoading(false);
    }
  }

  useEffect(() => {
    // Run the initial search once on mount with the computed defaults; runSearch
    // sets loading/error state itself, which is the intended behaviour here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    runSearch(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearch(values: CatalogueFilterValues) {
    setFilters(values);
    runSearch(values);
  }

  const isClientWithOrg = user?.role === "client" && user.organisationId;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <section className="mb-8 grid grid-cols-1 overflow-hidden rounded-feature bg-brand-carbon text-brand-warm-white md:grid-cols-2">
        <div className="flex flex-col justify-center px-6 py-10 sm:px-10">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-brand-coral">
            Islandwide reach, clearly managed
          </p>
          <h1 className="max-w-md text-3xl font-bold leading-[1.05] tracking-tight sm:text-4xl">
            Find space that fits your campaign.
          </h1>
          <p className="mt-3 max-w-sm text-sm text-brand-warm-white/70">
            Browse buses, transport hubs, delivery vans and digital screens. Check dates, compare rates and send a
            non-binding request.
          </p>
        </div>
        <div className="frame-corners relative min-h-[220px]">
          <Image
            src="/brand/imagery/island-media-bus-hub.png"
            alt="Bus and digital screen advertising in an island transport hub"
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
            priority
          />
        </div>
      </section>

      <div className="relative z-10 -mt-14 mb-2">
        <CatalogueFilters initial={filters} onSearch={handleSearch} />
      </div>

      {!sessionLoading && !user && (
        <Card className="mb-8 flex flex-col items-start gap-3 border-brand-coral/30 bg-brand-coral/10 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-brand-carbon">Sign in to submit requests and track campaigns</h2>
            <p className="mt-1 text-sm text-brand-carbon/70">
              Browse the catalogue freely below, or sign up / pick an existing client from the switcher above.
            </p>
          </div>
          <Link href="/portal/signup">
            <Button>Sign up as a new client</Button>
          </Link>
        </Card>
      )}

      {!sessionLoading && user && user.role !== "client" && (
        <Card className="mb-8 border-brand-warning/30 bg-brand-warning/10 p-4 text-sm text-brand-carbon">
          You&apos;re signed in as {user.name} ({user.role}). Switch to a client account above to submit requests.
        </Card>
      )}

      {isClientWithOrg && user && (
        <>
          <ClientSummarySection userId={user.id} refreshToken={refreshToken} />
          <BookingRequestsSection userId={user.id} refreshToken={refreshToken} />
        </>
      )}

      <h2 className="mb-3 text-lg font-semibold text-brand-carbon">Product catalogue</h2>

      <ShortlistPanel onRequest={(productId, productName) => setRequestModal({ productId, productName })} />

      {searchLoading && <p className="text-sm text-brand-carbon/60">Loading catalogue…</p>}
      {searchError && <p className="text-sm text-brand-danger">{searchError}</p>}

      {results && !searchLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.items.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              startDate={results.query.startDate}
              endDate={results.query.endDate}
              inShortlist={shortlist.has(product.id)}
              onAddToShortlist={() =>
                shortlist.add({ productId: product.id, name: product.name, rateLabel: product.indicativeRate.label })
              }
            />
          ))}
          {results.items.length === 0 && (
            <p className="col-span-full text-sm text-brand-carbon/60">No products match those filters.</p>
          )}
        </div>
      )}

      {requestModal && (
        <RequestModal
          open
          onClose={() => setRequestModal(null)}
          productId={requestModal.productId}
          productName={requestModal.productName}
          defaultStartDate={filters.startDate}
          defaultEndDate={filters.endDate}
          onSubmitted={() => {
            shortlist.remove(requestModal.productId);
            setRefreshToken((token) => token + 1);
          }}
        />
      )}
    </main>
  );
}
