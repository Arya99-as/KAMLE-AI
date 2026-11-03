import { api, qs } from "../lib/api";
import type {
  ChatConversation,
  ChatConversationList,
  ChatConversationStatus,
  ChatConversationSummary,
  ChatResponse,
  Enquiry,
  Paginated,
  PublicWorker,
  Review,
  ServiceCategory,
  User,
  WorkerProfile,
  Payment,
  Payout,
  PlatformConfig,
  Quotation,
} from "../types";

/* ------------------------------- auth ----------------------------------- */

export interface AuthResult {
  token: string;
  user: User;
}

export function register(body: { name: string; phone: string; email?: string; password: string; role: "customer" | "worker"; location?: string }) {
  return api<AuthResult>("/auth/register", { method: "POST", body, auth: false });
}

export function login(body: { identifier: string; password: string }) {
  return api<AuthResult>("/auth/login", { method: "POST", body, auth: false });
}

export interface MeResult {
  user: User;
  workerProfile: WorkerProfile | null;
}

export function fetchMe() {
  return api<MeResult>("/auth/me");
}

export function updateMe(body: { name?: string; location?: string }) {
  return api<{ user: User }>("/auth/me", { method: "PATCH", body });
}

/* ------------------------------ workers --------------------------------- */

export interface SearchParams {
  q?: string;
  category?: string;
  skills?: string;
  location?: string;
  minExperience?: number;
  maxBudget?: number;
  minRating?: number;
  availability?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

export interface SearchResult extends Paginated<PublicWorker> {
  weightsUsed: Record<string, number>;
}

export function searchWorkers(params: SearchParams) {
  return api<SearchResult>(`/workers${qs(params as unknown as Record<string, string | number | boolean | undefined>)}`);
}

export function recommendedWorkers() {
  return api<{ workers: PublicWorker[] }>("/workers/recommended");
}

export interface WorkerDetail {
  worker: PublicWorker | (PublicWorker & { portfolioImages: string[] });
  reviews: Review[];
}

export function getWorker(id: string) {
  return api<WorkerDetail>(`/workers/${id}`);
}

export function getCategories() {
  return api<{ categories: ServiceCategory[] }>("/categories");
}

export function createWorkerProfile(body: Partial<WorkerProfile>) {
  return api<{ workerProfile: WorkerProfile }>("/workers/profile", { method: "POST", body });
}

export function updateWorkerProfile(body: Partial<WorkerProfile>) {
  return api<{ workerProfile: WorkerProfile }>("/workers/profile", { method: "PATCH", body });
}

export function submitWorkerProfile() {
  return api<{ workerProfile: WorkerProfile }>("/workers/me/submit", { method: "POST" });
}

/* ----------------------------- chat (AI) -------------------------------- */

export function sendChatMessage(body: {
  conversationId?: string;
  sessionKey?: string;
  message: string;
  category?: string;
  location?: string;
}) {
  return api<ChatResponse>("/chat/message", { method: "POST", body, auth: true });
}

export function listChatConversations(params?: {
  status?: ChatConversationStatus;
  page?: number;
  limit?: number;
}) {
  return api<ChatConversationList>(`/chat/conversations${qs(params ?? {})}`, { auth: true });
}

export function createChatConversation(body: { title?: string } = {}) {
  return api<{ conversation: ChatConversationSummary }>("/chat/conversations", {
    method: "POST",
    body,
    auth: true,
  });
}

export function getChatConversation(conversationId: string) {
  return api<{ conversation: ChatConversation }>(
    `/chat/conversations/${encodeURIComponent(conversationId)}`,
    { auth: true },
  );
}

export function updateChatConversation(
  conversationId: string,
  body: { title?: string; status?: ChatConversationStatus },
) {
  return api<{ conversation: ChatConversationSummary }>(
    `/chat/conversations/${encodeURIComponent(conversationId)}`,
    { method: "PATCH", body, auth: true },
  );
}

export function deleteChatConversation(conversationId: string) {
  return api<{ conversationId: string }>(
    `/chat/conversations/${encodeURIComponent(conversationId)}`,
    { method: "DELETE", auth: true },
  );
}

/* -------------------------- interactions --------------------------------- */

export function createEnquiry(body: { workerId: string; serviceCategory: string; problemDescription: string; location?: string; serviceAmount?: number }) {
  return api<{ enquiry: Enquiry }>("/enquiries", { method: "POST", body });
}

export function listEnquiries(box?: "sent" | "received" | "all", status?: string) {
  return api<Paginated<Enquiry>>(`/enquiries${qs({ box, status })}`);
}

export function getEnquiry(id: string) {
  return api<{ success: boolean; enquiry: Enquiry }>(`/enquiries/${id}`);
}

export function updateEnquiryStatus(id: string, status: string, note?: string, serviceAmount?: number, disputeReason?: string) {
  return api<{ enquiry: Enquiry }>(`/enquiries/${id}/status`, {
    method: "PATCH",
    body: { status, note, serviceAmount, disputeReason },
  });
}

export function createReview(body: { workerId: string; enquiryId?: string; rating: number; comment?: string }) {
  return api<{ review: Review; message: string }>("/reviews", { method: "POST", body });
}

export function listMyReviews() {
  return api<Paginated<Review>>("/reviews/my");
}

export function listWorkerReviews(workerId: string) {
  return api<Paginated<Review>>(`/workers/${workerId}/reviews`);
}

export function listFavorites() {
  return api<Paginated<{ favoriteId: string; worker: PublicWorker }>>("/favorites");
}

export function addFavorite(workerId: string) {
  return api<{ favorite: { workerId: string } }>(`/favorites/${workerId}`, { method: "POST" });
}

export function removeFavorite(workerId: string) {
  return api<{ removed: boolean }>(`/favorites/${workerId}`, { method: "DELETE" });
}

export function createReport(body: { reportedUserId: string; reason: string; details?: string }) {
  return api<{ report: { _id: string } }>("/reports", { method: "POST", body });
}

/* ------------------------------- payments -------------------------------- */

export interface CreateOrderResult {
  success: boolean;
  order: {
    provider: string;
    orderId: string;
    transactionRef: string;
    amount: number;
    currency: string;
    commissionPercent: number;
    commissionAmount: number;
    workerPayableAmount: number;
    keyId?: string;
    workerId: string;
    quotationId?: string;
    approvedAmount?: number;
  };
}

export function createPaymentOrder(enquiryId: string) {
  return api<CreateOrderResult>("/payments/create-order", {
    method: "POST",
    body: { enquiryId },
  });
}

export interface VerifyPaymentInput {
  transactionRef?: string;
  providerOrderId: string;
  providerPaymentId?: string;
  signature?: string;
  paymentMethod?: string;
}

export function verifyPayment(body: VerifyPaymentInput) {
  return api<{ success: boolean; message: string; payment: Payment; payout: Payout }>("/payments/verify", {
    method: "POST",
    body,
  });
}

export function confirmEnquiryCompletion(id: string) {
  return api<{ success: boolean; enquiry: Enquiry }>(`/enquiries/${id}/confirm`, { method: "POST" });
}

export function getMyPayments() {
  return api<{ success: boolean; payments: Payment[] }>("/payments/my-payments");
}

export interface WorkerEarningsResult {
  success: boolean;
  stats: {
    totalGrossEarnings: number;
    totalCommissionDeducted: number;
    netPayable: number;
    totalPaidOut: number;
    pendingPayouts: number;
  };
  payouts: Payout[];
}

export function getWorkerEarnings() {
  return api<WorkerEarningsResult>("/payments/worker-earnings");
}

export function getCommissionRate() {
  return api<{ success: boolean; commissionPercent: number }>("/payments/commission-rate");
}

/* ------------------------------ quotations ------------------------------- */

export interface QuotationPayload {
  enquiryId?: string;
  labourCharges: number;
  materialCharges: number;
  additionalCharges: Array<{ description: string; amount: number }>;
  estimatedCompletionTime: string;
  validUntil: string;
  notes?: string;
}

export function getMyQuotations(status?: string) {
  return api<Paginated<Quotation>>(`/quotations/my${qs({ status })}`);
}

export function getQuotationForEnquiry(enquiryId: string) {
  return api<{ quotation: Quotation }>(`/quotations/for-enquiry/${enquiryId}`);
}

export function createQuotation(body: QuotationPayload) {
  return api<{ quotation: Quotation }>("/quotations", { method: "POST", body });
}

export function updateQuotation(id: string, body: QuotationPayload) {
  return api<{ quotation: Quotation }>(`/quotations/${id}`, { method: "PATCH", body });
}

export function submitQuotation(id: string) {
  return api<{ quotation: Quotation }>(`/quotations/${id}/submit`, { method: "POST" });
}

export function respondToQuotation(id: string, response: "accept" | "reject", note?: string) {
  return api<{ quotation: Quotation }>(`/quotations/${id}/respond`, {
    method: "POST",
    body: { response, note },
  });
}

/* -------------------------------- admin ---------------------------------- */

export function adminDashboard() {
  return api<{ stats: Record<string, number> }>("/admin/dashboard");
}

export function adminWorkers(status?: string, page = 1) {
  return api<Paginated<WorkerProfile & { userId: User & { _id?: string } }>>(`/admin/workers/pending${qs({ status, page })}`);
}

export function setApproval(id: string, decision: "approved" | "rejected", reason?: string) {
  return api<{ profile: WorkerProfile }>(`/admin/workers/${id}/review`, {
    method: "POST",
    body: { decision, reason },
  });
}

export function adminUsers(params: { role?: string; status?: string; q?: string; page?: number } = {}) {
  return api<Paginated<User>>(`/admin/users${qs(params as unknown as Record<string, string | number | boolean | undefined>)}`);
}

export function setAccountStatus(id: string, accountStatus: "active" | "suspended" | "deactivated", reason?: string) {
  return api<{ user: User }>(`/admin/users/${id}/status`, {
    method: "PATCH",
    body: { accountStatus, reason },
  });
}

export function adminEnquiries(status?: string, page = 1) {
  return api<Paginated<Enquiry>>(`/admin/enquiries${qs({ status, page })}`);
}

export function adminResolveDispute(id: string, resolution: "COMPLETED" | "CANCELLED", note?: string) {
  return api<{ success: boolean; enquiry: Enquiry }>(`/admin/enquiries/${id}/resolve-dispute`, {
    method: "POST",
    body: { resolution, note },
  });
}

export function adminPayments(status?: string, page = 1) {
  return api<Paginated<Payment>>(`/admin/payments${qs({ status, page })}`);
}

export function adminQuotations(status?: string, page = 1) {
  return api<Paginated<Quotation>>(`/admin/quotations${qs({ status, page })}`);
}

export function adminQuotationDecision(id: string, decision: "approve" | "reject" | "request_revision", remarks?: string) {
  return api<{ success: boolean; quotation: Quotation; message: string }>(`/admin/quotations/${id}/decision`, {
    method: "POST",
    body: { decision, remarks },
  });
}

export function adminQuotationRemarks(id: string, remarks: string) {
  return api<{ success: boolean; quotation: Quotation }>(`/admin/quotations/${id}/remarks`, {
    method: "PATCH",
    body: { remarks },
  });
}

export interface PaymentConsistencyCheck {
  key: string;
  ok: boolean;
  detail: string;
}

export function adminPaymentDetail(id: string) {
  return api<{
    success: boolean;
    payment: Payment;
    payout: Payout | null;
    checks: PaymentConsistencyCheck[];
  }>(`/admin/payments/${id}`);
}

export function adminReconcilePayment(id: string, action: "sync" | "request_refund" | "mark_refunded", note?: string) {
  return api<{ success: boolean; payment: Payment; message: string }>(`/admin/payments/${id}/reconcile`, {
    method: "POST",
    body: { action, note },
  });
}

export function adminPayouts(status?: string, page = 1) {
  return api<Paginated<Payout>>(`/admin/payouts${qs({ status, page })}`);
}

export function adminUpdatePayoutStatus(id: string, status: "PENDING" | "PROCESSING" | "PAID" | "FAILED", providerPayoutRef?: string, note?: string) {
  return api<{ success: boolean; payout: Payout }>(`/admin/payouts/${id}/status`, {
    method: "PATCH",
    body: { status, providerPayoutRef, note },
  });
}

export function adminGetConfig() {
  return api<{ success: boolean; config: PlatformConfig }>("/admin/config");
}

export function adminUpdateConfig(body: { commissionPercent?: number; payoutTerms?: string }) {
  return api<{ success: boolean; config: PlatformConfig }>("/admin/config", {
    method: "PUT",
    body,
  });
}

export function adminReviews(status?: string, page = 1) {
  return api<Paginated<Review>>(`/admin/reviews${qs({ status, page })}`);
}

export function moderateReview(id: string, moderationStatus: "approved" | "rejected") {
  return api<{ review: Review }>(`/admin/reviews/${id}/moderate`, {
    method: "POST",
    body: { moderationStatus },
  });
}

export function adminReports(status?: string, page = 1) {
  return api<Paginated<{ _id: string; reporterId: string; reportedUserId: string; reason: string; details: string; status: string; createdAt: string }>>(`/admin/reports${qs({ status, page })}`);
}

export function setReportStatus(id: string, status: string) {
  return api<{ report: { _id: string } }>(`/admin/reports/${id}/status`, {
    method: "PATCH",
    body: { status },
  });
}

export function adminCategories() {
  return api<{ categories: ServiceCategory[] }>("/admin/categories");
}

export function createCategory(body: { name: string; description?: string; icon?: string; keywords?: string[] }) {
  return api<{ category: ServiceCategory }>("/admin/categories", { method: "POST", body });
}

export function updateCategory(id: string, body: Partial<ServiceCategory>) {
  return api<{ category: ServiceCategory }>(`/admin/categories/${id}`, { method: "PATCH", body });
}

export function adminAuditLogs(params: { action?: string; targetType?: string; page?: number } = {}) {
  return api<Paginated<{ _id: string; adminId: { _id?: string; name?: string; email?: string; role?: string } | string; action: string; targetType: string; targetId?: string; metadata?: Record<string, unknown>; createdAt: string }>>(
    `/admin/audit-logs${qs(params as unknown as Record<string, string | number | boolean | undefined>)}`,
  );
}

/**
 * Downloads a private worker verification document as a Blob. The endpoint is
 * admin-only and requires the bearer token, so a plain <a href> cannot be used.
 */
export async function fetchWorkerDocument(profileId: string, index: number): Promise<Blob> {
  const token = localStorage.getItem("kamle_ai_token");
  const res = await fetch(`/api/admin/workers/${profileId}/documents/${index}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    let message = `Could not open document (${res.status})`;
    try {
      const data = (await res.json()) as { error?: { message?: string } };
      if (data.error?.message) message = data.error.message;
    } catch {
      // Non-JSON error body; keep the status message.
    }
    throw new Error(message);
  }
  return res.blob();
}

export function getMyWorkerProfile() {
  return api<{ workerProfile: WorkerProfile | null }>("/workers/me/profile");
}

export function saveWorkerProfile(body: Partial<WorkerProfile>, useCreate = true) {
  return useCreate ? createWorkerProfile(body) : updateWorkerProfile(body);
}

export function uploadForm(path: string, field: string, files: FileList): Promise<{ workerProfile: WorkerProfile }> {
  const form = new FormData();
  Array.from(files).forEach((file) => form.append(field, file));
  const token = localStorage.getItem("kamle_ai_token");
  return fetch(`/api${path}`, {
    method: "POST",
    body: form,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }).then(async (res) => {
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) throw new Error(((data.error as { message?: string })?.message) ?? "Upload failed");
    return data as { workerProfile: WorkerProfile };
  });
}
