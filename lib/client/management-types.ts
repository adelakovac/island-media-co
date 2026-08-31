import type {
  HistoryEntry,
  Organisation,
  ProductDetail,
  ContractItemDetail,
  Campaign,
  ServiceEvent,
  ProofRecord,
  ClientRequestRecord,
} from "./types";

export interface DashboardCounts {
  bookingRequestsSubmitted: number;
  bookingRequestsInformationRequired: number;
  bookingRequestsApproved: number;
  contractsIssued: number;
  contractsChangeRequested: number;
  workOrdersAssigned: number;
  clientRequestsSubmitted: number;
}

export type AttentionItemType =
  | "booking_request"
  | "contract_change_requested"
  | "client_request"
  | "campaign_needs_work_order";

export interface AttentionItem {
  type: AttentionItemType;
  id: string;
  contractId?: string | null;
  organisationName: string;
  productName?: string;
  status?: string;
  requestType?: string;
  message: string;
}

export interface WorkOrderRaw {
  id: string;
  campaignId: string;
  contractId: string;
  organisationId: string;
  type: string;
  status: string;
  assignedUserId: string;
  assetId: string;
  scheduledStart: string;
  scheduledEnd: string;
  locationLabel: string;
  instructions: string;
  completionNote: string | null;
  proofRecordIds: string[];
  history: HistoryEntry[];
}

export interface ManagementDashboard {
  attentionItems: AttentionItem[];
  counts: DashboardCounts;
  upcomingWorkOrders: WorkOrderRaw[];
}

export interface BookingRequestDetail {
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
  contractStatus: string | null;
  history: HistoryEntry[];
  organisation: Organisation;
  product: ProductDetail & { capacityPoolId: string | null };
  currentAvailability: ProductDetail["availability"];
}

export interface BookingRequestListItem {
  id: string;
  organisationName: string;
  productName: string;
  startDate: string;
  endDate: string;
  status: string;
  createdAt: string;
  attentionReason: string | null;
}

export interface ManagementWorkOrderDetail {
  id: string;
  campaignId: string;
  contractId: string;
  type: string;
  status: string;
  assignedUserId: string;
  assignedUserName: string;
  assetId: string;
  assetName: string;
  scheduledStart: string;
  scheduledEnd: string;
  locationLabel: string;
  instructions: string;
  internalNotes: string | null;
  completionNote: string | null;
  proofRecords: ProofRecord[];
  history: HistoryEntry[];
}

export interface ManagementContractDetail {
  id: string;
  organisationId: string;
  organisationName: string;
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
  workOrders: ManagementWorkOrderDetail[];
  serviceEvents: ServiceEvent[];
  clientRequests: ClientRequestRecord[];
}
