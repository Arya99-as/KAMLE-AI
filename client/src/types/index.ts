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
  payoutAccount?: {
    accountHolderName?: string;
    bankName?: string;
    accountNumber?: string;
    ifsc?: string;
    upiId?: string;
    status?: string;
    isVerified?: boolean;
    linkedAccountId?: string;
  };
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
  quotationId?: string | { _id: string; approvedAmount?: number; total?: number; status?: string };
  approvedAmount?: number;
  amount: number;
  currency: string;
  commissionPercent: number;
  commissionAmount: number;
  workerPayableAmount: number;
  refundedAmount?: number;
  refundStatus?: "NONE" | "PARTIAL" | "FULL";
  status: "PENDING" | "COMPLETED" | "FAILED" | "REFUND_REQUESTED" | "REFUNDED";
  provider: string;
  transactionRef: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  paymentMethod?: string;
  verifiedAt?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export type QuotationStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "REVISION_REQUESTED"
  | "EXPIRED";

export type QuotationCustomerStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export interface QuotationAdditionalCharge {
  description: string;
  amount: number;
}

export interface QuotationHistoryEvent {
  status: QuotationStatus;
  at: string;
  by?: string | UserRef;
  role: "worker" | "customer" | "admin" | "system";
  note?: string;
}

export interface QuotationEnquiryRef {
  _id: string;
  serviceCategory: string;
  problemDescription: string;
  location?: string;
  status?: EnquiryStatus;
  paymentStatus?: "UNPAID" | "PAID" | "REFUNDED";
  serviceAmount?: number;
  clientConfirmedAt?: string;
  statusHistory?: EnquiryStatusEvent[];
  createdAt?: string;
}

export interface Quotation {
  _id: string;
  enquiryId: string | QuotationEnquiryRef;
  customerId: string | UserRef;
  workerId: string | UserRef;
  status: QuotationStatus;
  labourCharges: number;
  materialCharges: number;
  additionalCharges: QuotationAdditionalCharge[];
  subtotal: number;
  total: number;
  estimatedCompletionTime: string;
  validUntil: string;
  notes: string;
  revisionNumber: number;
  history: QuotationHistoryEvent[];
  approvedAmount?: number;
  approvedBy?: string | UserRef;
  approvedAt?: string;
  adminRemarks: string;
  decidedAt?: string;
  customerStatus: QuotationCustomerStatus;
  respondedAt?: string;
  paidAt?: string;
  paymentId?: string;
  createdAt: string;
  updatedAt: string;
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
  method?: string;
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
  keywords?: string[];
  isActive?: boolean;
  sortOrder?: number;
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

export type ChatConversationStatus = "ACTIVE" | "ARCHIVED";

export interface ChatMessageRecord {
  role: "user" | "assistant";
  content: string;
  at: string;
}

export interface ChatConversationSummary {
  conversationId: string;
  sessionKey: string;
  title: string;
  status: ChatConversationStatus;
  lastMessage: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatConversation extends ChatConversationSummary {
  messages: ChatMessageRecord[];
  requirements: ExtractedRequirements;
}

export interface ChatConversationList {
  items: ChatConversationSummary[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext?: boolean;
}

export interface ChatResponse {
  conversationId: string;
  sessionKey: string;
  conversation: ChatConversationSummary;
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
