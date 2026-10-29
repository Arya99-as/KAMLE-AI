export type Role = "customer" | "worker" | "admin";
export type AccountStatus = "active" | "suspended" | "deactivated";

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  accountStatus: AccountStatus;
  avatarUrl: string;
  location: string;
  createdAt: string;
}

export interface Pricing {
  type: "fixed" | "hourly" | "quote";
  amount?: number;
  currency: string;
  note?: string;
}

export interface Availability {
  availableNow: boolean;
  days: string[];
  note?: string;
}

export interface WorkerProfile {
  _id: string;
  userId: string;
  professionalDescription?: string;
  serviceCategories: string[];
  skills: string[];
  experienceYears: number;
  experienceSummary?: string;
  serviceAreas: string[];
  pricing: Pricing;
  availability: Availability;
  portfolioImages: string[];
  verificationDocuments?: { label: string; url: string }[];
  verificationStatus: "unverified" | "pending" | "verified" | "rejected";
  approvalStatus: "draft" | "pending" | "approved" | "rejected";
  rejectionReason?: string;
  ratingAverage: number;
  ratingCount: number;
  completedEnquiries: number;
}

export interface PublicWorker {
  workerId: string;
  userId: string;
  name: string;
  avatarUrl: string;
  professionalDescription: string;
  serviceCategories: string[];
  skills: string[];
  experienceYears: number;
  experienceSummary: string;
  serviceAreas: string[];
  pricing: Pricing;
  availability: Availability;
  portfolioImages: string[];
  verificationStatus: "unverified" | "pending" | "verified" | "rejected";
  ratingAverage: number;
  ratingCount: number;
  completedEnquiries: number;
  reasons?: string[];
  phone?: string;
}

export interface Review {
  id?: string;
  _id?: string;
  workerId?: string | UserRef;
  customerId?: string | UserRef;
  enquiryId?: string;
  rating: number;
  comment: string;
  moderationStatus?: "pending" | "approved" | "rejected";
  createdAt: string;
  customerName?: string;
}

export interface EnquiryStatusEvent {
  status: string;
  at: string;
  by: string;
  note?: string;
}

export interface UserRef {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  avatarUrl?: string;
}

export type EnquiryStatus =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "DISPUTED"
  | "sent"
  | "declined";

export interface Enquiry {
  _id: string;
  customerId: string | UserRef;
  workerId: string | UserRef;
  serviceCategory: string;
  problemDescription: string;
  location: string;
  status: EnquiryStatus;
  serviceAmount?: number;
  paymentStatus?: "UNPAID" | "PAID" | "REFUNDED";
  clientConfirmedAt?: string;
  disputeReason?: string;
  disputeResolvedAt?: string;
  statusHistory?: EnquiryStatusEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  _id: string;
  enquiryId: string | { _id: string; serviceCategory?: string; problemDescription?: string };
  customerId: string | UserRef;
  workerId: string | UserRef;
  amount: number;
  currency: string;
  commissionPercent: number;
  commissionAmount: number;
  workerPayableAmount: number;
  status: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
  provider: string;
  transactionRef: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  paymentMethod?: string;
  verifiedAt?: string;
  createdAt: string;
}

export interface Payout {
  _id: string;
  workerId: string | UserRef;
  enquiryId: string | { _id: string; serviceCategory?: string };
  paymentId: string | { _id: string; transactionRef: string; amount: number };
  serviceAmount: number;
  commissionAmount: number;
  workerPayableAmount: number;
  status: "PENDING" | "PROCESSING" | "PAID" | "FAILED";
  providerPayoutRef?: string;
  paidAt?: string;
  note?: string;
  createdAt: string;
}

export interface PlatformConfig {
  _id?: string;
  key: string;
  commissionPercent: number;
  payoutTerms: string;
}

export interface ServiceCategory {
  _id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
}

export interface ExtractedRequirements {
  service_category: string | null;
  required_skills: string[];
  location: string | null;
  budget: number | null;
  urgency: "low" | "normal" | "high" | "emergency";
  missing_information: string[];
  search_ready: boolean;
}

export interface ChatResponse {
  sessionKey: string;
  reply: string;
  requirements: ExtractedRequirements;
  workers: PublicWorker[];
  matchSummary: { total: number; weightsUsed: Record<string, number> } | null;
  degraded: boolean;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  pages: number;
  totalPages: number;
  hasNext?: boolean;
}
