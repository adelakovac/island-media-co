export interface User {
  id: string;
  name: string;
  email: string;
  role: "client" | "manager" | "fitter";
  organisationId: string | null;
  status: string;
}

export interface Organisation {
  id: string;
  name: string;
  createdAt: string;
  contractCount: number;
}

export interface Session {
  user: User;
  organisation: Organisation | null;
}

export type AvailabilityState = "available" | "unavailable" | "confirmation_required";

export interface AvailabilitySummary {
  state: AvailabilityState;
  reason: string;
  calculatedAt: string;
  availableAssetCount: number | null;
  availableCapacity: number | null;
  totalCapacity: number | null;
  freshestVerificationAt: string | null;
}

export interface IndicativeRate {
  currency: string;
  amount: number | null;
  unit: string | null;
  monthlyEquivalent: number | null;
  label: string;
}

export interface ProductSearchResult {
  id: string;
  name: string;
  mediaOwnerName: string;
  mediaType: string;
  locationNames: string[];
  allocationModel: "exclusive_asset" | "capacity_pool";
  indicativeRate: IndicativeRate;
  minimumTermDays: number;
  availability: AvailabilitySummary;
}

export interface AssetOption {
  id: string;
  name: string;
  status: string;
  verifiedAt: string | null;
  verificationSource: string | null;
  note: string | null;
  availability: AvailabilitySummary;
}

export interface ProductDetail extends ProductSearchResult {
  description: string;
  creativeSpec: Record<string, unknown> | null;
  assetOptions: AssetOption[];
}

export interface HistoryEntry {
  at: string;
  actor: string;
  action: string;
  note: string | null;
}

export interface BookingRequest {
  id: string;
  organisationId: string;
  productId: string;
  requestedAssetId: string | null;
  startDate: string;
  endDate: string;
  budget: number;
  objective: string;
  notes: string | null;
  status: string;
  createdAt: string;
  draftContractId: string | null;
  history: HistoryEntry[];
}

export interface ClientBookingRequestSummary {
  id: string;
  productId: string;
  productName: string;
  startDate: string;
  endDate: string;
  budget: number;
  objective: string;
  notes: string | null;
  status: string;
  createdAt: string;
  history: HistoryEntry[];
}

export interface ContractSummary {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  total: number;
  actionRequired: string | null;
}

export interface ContractItem {
  id: string;
  productId: string;
  assetId: string | null;
  capacityPoolId: string | null;
  quantity: number;
  unitRate: number | null;
  rateUnit: string | null;
  lineTotal: number;
}

export interface Contract {
  id: string;
  organisationId: string;
  bookingRequestId: string | null;
  status: string;
  version: number;
  startDate: string;
  endDate: string;
  currency: string;
  total: number;
  items: ContractItem[];
  history: HistoryEntry[];
}

export interface ServiceEvent {
  id: string;
  at: string;
  type: string;
  title: string;
  clientVisible: boolean;
  clientSummary: string | null;
}

export interface ClientSummary {
  organisation: Organisation;
  contracts: ContractSummary[];
  attentionItems: Array<Record<string, unknown>>;
  recentServiceEvents: ServiceEvent[];
}

export interface ContractItemDetail {
  id: string;
  productId: string;
  productName: string;
  assetId: string | null;
  assetName: string | null;
  capacityPoolId: string | null;
  capacityPoolName: string | null;
  quantity: number;
  unitRate: number | null;
  rateUnit: string | null;
  lineTotal: number;
}

export interface Campaign {
  id: string;
  organisationId: string;
  contractId: string | null;
  bookingId: string | null;
  name: string;
  status: string;
  currentStage: string;
  clientVisible: boolean;
}

export interface ProofRecord {
  id: string;
  workOrderId: string;
  fileName: string;
  previewUrl: string | null;
  completionNote: string;
  createdAt: string;
  createdByUserId: string;
}

export interface ClientRequestRecord {
  id: string;
  organisationId: string;
  contractId: string | null;
  type: string;
  status: string;
  createdAt: string;
  summary: string;
  history: HistoryEntry[];
}

export interface ContractDetail {
  id: string;
  organisationId: string;
  bookingRequestId: string | null;
  status: string;
  version: number;
  startDate: string;
  endDate: string;
  currency: string;
  total: number;
  items: ContractItemDetail[];
  history: HistoryEntry[];
  campaign: Campaign | null;
  serviceEvents: ServiceEvent[];
  proofRecords: ProofRecord[];
  clientRequests: ClientRequestRecord[];
}

export type ClientContractAction = "accept" | "request_changes" | "request_cancellation";

export type ManagementClientRequestAction = "acknowledge" | "decline";

export interface SwitchableUser {
  id: string;
  name: string;
  role: "client" | "manager" | "fitter";
  organisationId: string | null;
  organisationName: string | null;
}

export interface ProductSearchResponse {
  query: {
    startDate: string;
    endDate: string;
    mediaType: string | null;
    locationId: string | null;
    maxMonthlyBudget: number | null;
  };
  items: ProductSearchResult[];
}
