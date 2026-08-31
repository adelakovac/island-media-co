import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AvailabilityBadge } from "@/components/AvailabilityBadge";
import type { ProductSearchResult } from "@/lib/client/types";

export function ProductCard({
  product,
  startDate,
  endDate,
  inShortlist,
  onAddToShortlist,
}: {
  product: ProductSearchResult;
  startDate: string;
  endDate: string;
  inShortlist: boolean;
  onAddToShortlist: () => void;
}) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-brand-navy-900">{product.name}</h3>
          <p className="text-xs text-brand-navy-800/60">
            {product.mediaOwnerName} · {product.mediaType.replace("_", " ")}
          </p>
        </div>
        <AvailabilityBadge state={product.availability.state} title={product.availability.reason} />
      </div>

      <p className="text-xs text-brand-navy-800/70">{product.locationNames.join(", ")}</p>

      <div className="mt-1 flex items-baseline justify-between">
        <span className="text-sm font-medium text-brand-navy-900">{product.indicativeRate.label}</span>
        <span className="text-xs text-brand-navy-800/60">Min. term {product.minimumTermDays}d</span>
      </div>

      <p className="text-xs text-brand-navy-800/60">{product.availability.reason}</p>

      <div className="mt-auto flex gap-2 pt-2">
        <Link
          href={`/portal/products/${product.id}?startDate=${startDate}&endDate=${endDate}`}
          className="flex-1"
        >
          <Button variant="secondary" className="w-full">
            View details
          </Button>
        </Link>
        <Button variant="ghost" disabled={inShortlist} onClick={onAddToShortlist}>
          {inShortlist ? "Shortlisted" : "Shortlist"}
        </Button>
      </div>
    </Card>
  );
}
