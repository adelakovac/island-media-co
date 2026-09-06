"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { AvailabilityBadge } from "@/components/AvailabilityBadge";
import { RequestModal } from "@/components/portal/RequestModal";
import { apiFetch, ApiClientError } from "@/lib/client/api";
import { addDays, toDateInputValue } from "@/lib/client/dates";
import { now as fixtureNow } from "@/lib/fixture-clock";
import { useShortlist } from "@/lib/client/shortlist";
import type { ProductDetail } from "@/lib/client/types";

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const shortlist = useShortlist();

  const base = fixtureNow();
  const [startDate, setStartDate] = useState(searchParams.get("startDate") ?? toDateInputValue(addDays(base, 14)));
  const [endDate, setEndDate] = useState(searchParams.get("endDate") ?? toDateInputValue(addDays(base, 44)));
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);

  async function load(currentStartDate: string, currentEndDate: string) {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<ProductDetail>(
        `/api/products/${params.id}?startDate=${currentStartDate}&endDate=${currentEndDate}`,
      );
      setProduct(data);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not load this product.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Initial load only; the "Check availability" button re-triggers explicitly.
    // load() sets loading/error state itself, which is the intended behaviour here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(startDate, endDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <Link href="/portal" className="text-sm text-brand-coral hover:underline">
        ← Back to catalogue
      </Link>

      {loading && <p className="mt-6 text-sm text-brand-carbon/60">Loading…</p>}
      {error && <p className="mt-6 text-sm text-brand-danger">{error}</p>}

      {product && !loading && (
        <div className="mt-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-brand-carbon">{product.name}</h1>
              <p className="text-sm text-brand-carbon/60">
                {product.mediaOwnerName} · {product.mediaType.replace("_", " ")} · {product.locationNames.join(", ")}
              </p>
            </div>
            <AvailabilityBadge state={product.availability.state} title={product.availability.reason} />
          </div>

          <p className="mt-3 text-sm text-brand-carbon/80">{product.description}</p>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
            <span className="font-medium text-brand-carbon">{product.indicativeRate.label}</span>
            <span className="text-brand-carbon/60">Minimum term: {product.minimumTermDays} days</span>
          </div>

          <Card className="mt-4 flex flex-wrap items-end gap-3 p-4">
            <div>
              <Label htmlFor="detail-startDate">Start date</Label>
              <Input
                id="detail-startDate"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="detail-endDate">End date</Label>
              <Input
                id="detail-endDate"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
            <Button variant="secondary" onClick={() => load(startDate, endDate)}>
              Check availability
            </Button>
          </Card>

          {product.creativeSpec && (
            <Card className="mt-4 p-4">
              <h2 className="mb-2 text-sm font-semibold text-brand-carbon">Creative specification</h2>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {Object.entries(product.creativeSpec).map(([key, value]) => (
                  <div key={key} className="contents">
                    <dt className="text-brand-carbon/60 capitalize">{key.replace(/([A-Z])/g, " $1")}</dt>
                    <dd className="text-brand-carbon">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}

          {product.assetOptions.length > 0 && (
            <Card className="mt-4 p-4">
              <h2 className="mb-2 text-sm font-semibold text-brand-carbon">Asset options</h2>
              <ul className="flex flex-col gap-2">
                {product.assetOptions.map((asset) => (
                  <li
                    key={asset.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-brand-carbon/10 p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium text-brand-carbon">{asset.name}</p>
                      <p className="text-xs text-brand-carbon/60">
                        {asset.verifiedAt ? `Verified ${new Date(asset.verifiedAt).toLocaleDateString("en-GB")}` : "Not verified"}
                        {asset.verificationSource ? ` · ${asset.verificationSource}` : ""}
                      </p>
                      {asset.note && <p className="mt-1 text-xs text-brand-warning">{asset.note}</p>}
                    </div>
                    <AvailabilityBadge state={asset.availability.state} title={asset.availability.reason} />
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <div className="mt-6 flex gap-3">
            <Button
              variant="secondary"
              disabled={shortlist.has(product.id)}
              onClick={() =>
                shortlist.add({ productId: product.id, name: product.name, rateLabel: product.indicativeRate.label })
              }
            >
              {shortlist.has(product.id) ? "Shortlisted" : "Add to shortlist"}
            </Button>
            <Button onClick={() => setRequestOpen(true)}>Submit request</Button>
          </div>

          <RequestModal
            open={requestOpen}
            onClose={() => setRequestOpen(false)}
            productId={product.id}
            productName={product.name}
            assetOptions={product.assetOptions}
            defaultStartDate={startDate}
            defaultEndDate={endDate}
          />
        </div>
      )}
    </main>
  );
}
