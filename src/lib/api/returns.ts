import { apiClient } from "./client";

export type ReturnStatus =
  | "REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "RECEIVED"
  | "REFUND_INITIATED"
  | "REFUNDED"
  | "CANCELLED";

export interface ReturnRequestDto {
  id: string;
  orderId: string;
  orderItemId: string;
  reason: string;
  description?: string;
  status: ReturnStatus;
  createdAt: string;
  updatedAt: string;
  refund?: {
    id: string;
    amountInPaise: number;
    status: "INITIATED" | "PROCESSED" | "FAILED";
  } | null;
}

export const returnsApi = {
  /** User: submit a return for a delivered order item. */
  create: (body: { orderItemId: string; reason: string; description?: string }) =>
    apiClient.post<ReturnRequestDto>("/returns", body),

  /** User: list my own returns. */
  mine: () => apiClient.get<ReturnRequestDto[]>("/returns/me"),

  // ---------- Admin endpoints ----------

  /** Admin: list all returns. */
  adminList: () => apiClient.get<ReturnRequestDto[]>("/admin/returns"),

  /** Admin: approve or reject a REQUESTED return. */
  adminReview: (id: string, body: { decision: "APPROVED" | "REJECTED"; notes?: string }) =>
    apiClient.patch<ReturnRequestDto>(`/admin/returns/${id}/review`, body),

  /** Admin: mark APPROVED return as RECEIVED (goods back at warehouse). */
  adminReceived: (id: string) =>
    apiClient.patch<ReturnRequestDto>(`/admin/returns/${id}/received`),

  /** Admin: initiate Razorpay refund. amountInPaise comes from the order total. */
  adminRefund: (id: string, body: { amountInPaise: number }) =>
    apiClient.post<{ id: string; status: string; amountInPaise: number }>(
      `/admin/returns/${id}/refund`,
      body,
    ),

  /** Admin: close out a return after refund PROCESSED. */
  adminMarkRefunded: (id: string) =>
    apiClient.patch<ReturnRequestDto>(`/admin/returns/${id}/refunded`),
};
