// No "list locations" API exists in openapi.yaml, so catalogue filter options
// are drawn from the known seeded reference data instead.
export const LOCATIONS = [
  { id: "loc-islandwide", name: "Islandwide routes" },
  { id: "loc-central-hub", name: "Central transport hub" },
  { id: "loc-east", name: "East district" },
  { id: "loc-west", name: "West district" },
];

export const MEDIA_TYPES = [
  { value: "vehicle", label: "Vehicle" },
  { value: "digital_screen", label: "Digital screen" },
  { value: "static_site", label: "Static site" },
];
