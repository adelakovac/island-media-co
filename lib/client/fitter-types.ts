import type { HistoryEntry } from "./types";

export type WorkOrderStatus = "draft" | "assigned" | "travelling" | "on_site" | "blocked" | "completed" | "cancelled";

export interface FitterWorkOrder {
  id: string;
  campaignId: string;
  contractId: string;
  organisationId: string;
  organisationName: string;
  type: string;
  status: WorkOrderStatus;
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
