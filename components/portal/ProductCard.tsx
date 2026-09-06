import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AvailabilityBadge } from "@/components/AvailabilityBadge";
import type { ProductSearchResult } from "@/lib/client/types";

// Photo treatment mirrors the reference ui-examples.css ".product-image"
// modifiers, keyed off what the product actually is rather than which cards
// happen to lack a dedicated photo:
//  - ".bus": all vehicle-mounted products (bus panels/wraps, delivery vans)
//    share the bus-hub photo.
//  - ".screen": digital screen products get the coral/dark diagonal gradient,
//    which is specifically meant to signal "digital screen".
//  - ".ev": the EV charging-station screen has its own dedicated fixture
//    photo, so it takes that instead of the generic screen gradient even
//    though it's technically a digital_screen product.
//  - static sites (e.g. door panels) aren't a screen, so they get the plain
//    neutral fallback (bare ".product-image" background) rather than the
//    gradient.
const VEHICLE_PHOTO = { src: "/brand/imagery/island-media-bus-hub.png", position: "69% 60%" };
const EV_PHOTO = { src: "/brand/imagery/island-media-ev-screen.png", position: "center 49%" };
const EV_SCREEN_PRODUCT_ID = "product-ev-screen";

const GRADIENT_IMAGE =
  "linear-gradient(90deg, transparent 0 46%, var(--color-brand-coral) 46% 50%, transparent 50%), linear-gradient(135deg, #263640, #8598a5)";

function ProductImage({ product }: { product: ProductSearchResult }) {
  const photo =
    product.id === EV_SCREEN_PRODUCT_ID
      ? EV_PHOTO
      : product.mediaType === "vehicle"
        ? VEHICLE_PHOTO
        : null;
  const isScreen = !photo && product.mediaType === "digital_screen";

  return (
    <div
      className="h-[150px] w-full bg-brand-mist"
      style={
        photo
          ? { backgroundImage: `url(${photo.src})`, backgroundPosition: photo.position, backgroundSize: "cover" }
          : isScreen
            ? { backgroundImage: GRADIENT_IMAGE }
            : undefined
      }
      role="img"
      aria-label={product.name}
    />
  );
}

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
    <Card className="flex flex-col overflow-hidden p-0">
      <ProductImage product={product} />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-brand-carbon">{product.name}</h3>
            <p className="text-xs text-brand-carbon/60">
              {product.mediaOwnerName} · {product.mediaType.replace("_", " ")}
            </p>
          </div>
          <AvailabilityBadge state={product.availability.state} title={product.availability.reason} />
        </div>

        <p className="text-xs text-brand-carbon/70">{product.locationNames.join(", ")}</p>

        <div className="mt-1 flex items-baseline justify-between">
          <span className="text-sm font-medium text-brand-carbon">{product.indicativeRate.label}</span>
          <span className="text-xs text-brand-carbon/60">Min. term {product.minimumTermDays}d</span>
        </div>

        <p className="text-xs text-brand-carbon/60">{product.availability.reason}</p>

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
      </div>
    </Card>
  );
}
