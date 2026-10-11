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
  avatarUrl?: string;
}

export interface Enquiry {
  _id: string;
  customerId: string | UserRef;
  workerId: string | UserRef;
  serviceCategory: string;
  problemDescription: string;
  location: string;
  status: "sent" | "accepted" | "declined" | "completed" | "cancelled";
  statusHistory?: EnquiryStatusEvent[];
  createdAt: string;
  updatedAt: string;
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
  totalPages: number;
  hasNext: boolean;
}