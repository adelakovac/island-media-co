"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useShortlist } from "@/lib/client/shortlist";

export function ShortlistPanel({ onRequest }: { onRequest: (productId: string, productName: string) => void }) {
  const { items, remove } = useShortlist();

  if (items.length === 0) return null;

  return (
    <Card className="mb-6 p-4">
      <h3 className="mb-2 text-sm font-semibold text-brand-navy-900">Your shortlist</h3>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li
            key={item.productId}
            className="flex items-center justify-between gap-3 rounded-md border border-brand-navy-900/10 px-3 py-2 text-sm"
          >
            <div>
              <p className="font-medium text-brand-navy-900">{item.name}</p>
              <p className="text-xs text-brand-navy-800/60">{item.rateLabel}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="primary" onClick={() => onRequest(item.productId, item.name)}>
                Request
              </Button>
              <Button variant="ghost" onClick={() => remove(item.productId)}>
                Remove
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
