"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Field";
import { LOCATIONS, MEDIA_TYPES } from "@/lib/client/reference-data";

export interface CatalogueFilterValues {
  startDate: string;
  endDate: string;
  mediaType: string;
  locationId: string;
  maxMonthlyBudget: string;
}

export function CatalogueFilters({
  initial,
  onSearch,
}: {
  initial: CatalogueFilterValues;
  onSearch: (filters: CatalogueFilterValues) => void;
}) {
  const [values, setValues] = useState(initial);

  function update<K extends keyof CatalogueFilterValues>(key: K, value: CatalogueFilterValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  return (
    <Card className="mb-6 p-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSearch(values);
        }}
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
      >
        <div>
          <Label htmlFor="filter-startDate">Start date</Label>
          <Input
            id="filter-startDate"
            type="date"
            required
            value={values.startDate}
            onChange={(event) => update("startDate", event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="filter-endDate">End date</Label>
          <Input
            id="filter-endDate"
            type="date"
            required
            value={values.endDate}
            onChange={(event) => update("endDate", event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="filter-mediaType">Media type</Label>
          <Select
            id="filter-mediaType"
            value={values.mediaType}
            onChange={(event) => update("mediaType", event.target.value)}
          >
            <option value="">All</option>
            {MEDIA_TYPES.map((mediaType) => (
              <option key={mediaType.value} value={mediaType.value}>
                {mediaType.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="filter-locationId">Location</Label>
          <Select
            id="filter-locationId"
            value={values.locationId}
            onChange={(event) => update("locationId", event.target.value)}
          >
            <option value="">All</option>
            {LOCATIONS.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="filter-maxMonthlyBudget">Max £/month</Label>
          <Input
            id="filter-maxMonthlyBudget"
            type="number"
            min={0}
            placeholder="Any"
            value={values.maxMonthlyBudget}
            onChange={(event) => update("maxMonthlyBudget", event.target.value)}
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" className="w-full">
            Search
          </Button>
        </div>
      </form>
    </Card>
  );
}
