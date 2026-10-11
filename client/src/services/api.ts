import { api, qs } from "../lib/api";
import type { ChatResponse, Enquiry, Paginated, PublicWorker, Review, ServiceCategory, User, UserRef, WorkerProfile, ExtractedRequirements } from "../types";

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

/* -------------------------------- chat ---------------------------------- */

export function sendChatMessage(sessionKey: string | undefined, message: string) {
  return api<ChatResponse>("/chat/message", { method: "POST", body: { sessionKey, message }, auth: false });
}

export function structuredSearch(body: Partial<ExtractedRequirements> & { query?: string }) {
  return api<SearchResult>("/search", { method: "POST", body, auth: false });
}

/* ----------------------------- enquiries -------------------------------- */

export function createEnquiry(body: { workerId: string; serviceCategory: string; problemDescription: string; location?: string }) {
  return api<{ enquiry: Enquiry }>("/enquiries", { method: "POST", body });
}

export function listEnquiries(box: "all" | "sent" | "received" = "all") {
  return api<Paginated<Enquiry>>(`/enquiries/me${qs({ box })}`);
}

export function updateEnquiryStatus(id: string, status: string, note?: string) {
  return api<{ enquiry: Enquiry }>(`/enquiries/${id}/status`, { method: "PATCH", body: { status, note } });
}

/* ------------------------------- reviews -------------------------------- */

export function createReview(body: { workerId: string; rating: number; comment?: string }) {
  return api<{ review: Review }>("/reviews", { method: "POST", body });
}

export function listMyReviews() {
  return api<Paginated<Review & { workerId: UserRef | string }>>("/reviews/me");
}

export function createReport(body: { reportedUserId: string; reason: string; details?: string }) {
  return api<{ report: Report }>("/reports", { method: "POST", body });
}

/* ------------------------------ favorites ------------------------------- */

export function listFavorites() {
  return api<{ items: { favoriteId: string; worker: PublicWorker }[] }>("/favorites");
}

export function addFavorite(workerId: string) {
  return api<{ ok: true }>(`/favorites/${workerId}`, { method: "POST" });
}

export function removeFavorite(workerId: string) {
  return api<{ ok: true }>(`/favorites/${workerId}`, { method: "DELETE" });
}

/* --------------------------- worker profile ----------------------------- */

export function getMyWorkerProfile() {
  return api<{ workerProfile: WorkerProfile | null }>("/workers/me/profile");
}

export function saveWorkerProfile(body: Record<string, unknown>, create: boolean) {
  return api<{ workerProfile: WorkerProfile }>(`/workers/profile`, { method: create ? "POST" : "PATCH", body });
}

export function submitWorkerProfile() {
  return api<{ workerProfile: WorkerProfile }>("/workers/me/submit", { method: "POST" });
}

/* -------------------------------- admin --------------------------------- */

export function adminDashboard() {
  return api<{ stats: Record<string, number> }>("/admin/dashboard");
}

export function adminAnalytics() {
  return api<{
    enquiriesByStatus: { _id: string; count: number }[];
    enquiriesByCategory: { _id: string; count: number }[];
    workersByCategory: { _id: string; count: number }[];
    enquiriesByDay: { _id: string; count: number }[];
    topWorkers: { _id: string; userId: unknown; completedEnquiries: number; ratingAverage: number; ratingCount: number }[];
  }>("/admin/analytics");
}

export function adminWorkers(status: string) {
  return api<Paginated<WorkerProfile & { userId: User }>>(`/admin/workers/pending${qs({ status })}`);
}

export function setApproval(profileId: string, decision: "approved" | "rejected", reason?: string) {
  return api<{ workerProfile: WorkerProfile }>(`/admin/workers/${profileId}/approval`, { method: "PATCH", body: { decision, reason } });
}

export function adminUsers(params: { role?: string; status?: string; q?: string } = {}) {
  return api<Paginated<User>>(`/admin/users${qs(params)}`);
}

export function setAccountStatus(userId: string, accountStatus: string, reason?: string) {
  return api<{ user: { id: string; accountStatus: string } }>(`/admin/users/${userId}/status`, { method: "PATCH", body: { accountStatus, reason } });
}

export function adminReports(status?: string) {
  return api<Paginated<Report>>(`/admin/reports${qs({ status })}`);
}

export function setReportStatus(id: string, status: string) {
  return api<{ report: Report }>(`/admin/reports/${id}/status`, { method: "PATCH", body: { status } });
}

export function adminReviews(status?: string) {
  return api<Paginated<Review>>(`/admin/reviews${qs({ status })}`);
}

export function moderateReview(id: string, moderationStatus: string) {
  return api<{ review: Review }>(`/admin/reviews/${id}/moderation`, { method: "PATCH", body: { moderationStatus } });
}

export function adminCategories() {
  return api<{ categories: Array<ServiceCategory & { isActive: boolean; sortOrder: number }> }>("/admin/categories");
}

export function createCategory(body: Record<string, unknown>) {
  return api<{ category: ServiceCategory }>("/admin/categories", { method: "POST", body });
}

export function updateCategory(id: string, body: Record<string, unknown>) {
  return api<{ category: ServiceCategory }>(`/admin/categories/${id}`, { method: "PATCH", body });
}

export function deleteCategory(id: string) {
  return api<{ category: ServiceCategory }>(`/admin/categories/${id}`, { method: "DELETE" });
}

export function adminAuditLogs() {
  return api<Paginated<{ action: string; targetType: string; targetId: string; metadata: Record<string, unknown>; createdAt: string; adminId: { name: string } }>>("/admin/audit-logs");
}

export interface AiHealth {
  provider: string;
  configured: boolean;
  model: string | null;
  baseUrl: string | null;
  apiKeySet: boolean;
  reachable: boolean;
  latencyMs: number | null;
  models: string[];
  error: string | null;
}

export function adminAiHealth() {
  return api<{ health: AiHealth }>("/admin/ai/health");
}

export interface Report {
  _id: string;
  reporterId: string;
  reportedUserId: string;
  reason: string;
  details: string;
  status: string;
  createdAt: string;
}

/* ------------------------------- uploads -------------------------------- */

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