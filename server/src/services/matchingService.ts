import mongoose from "mongoose";
import WorkerProfile, { type IWorkerProfile } from "../models/WorkerProfile.js";
import User from "../models/User.js";
import type { Urgency } from "../types/ai.js";

export interface MatchCriteria {
  category?: string | null;
  skills?: string[];
  location?: string | null;
  budget?: number | null;
  urgency?: Urgency;
  /** Free-text query matched against description, skills and categories. */
  text?: string | null;
}

export interface MatchedWorker {
  workerId: string;
  userId: string;
  name: string;
  avatarUrl: string;
  professionalDescription: string;
  serviceCategories: string[];
  skills: string[];
  experienceYears: number;
  serviceAreas: string[];
  pricing: { type: string; amount?: number; currency: string; note?: string };
  availability: { availableNow: boolean; days: string[]; note?: string };
  verificationStatus: string;
  approvalStatus: string;
  ratingAverage: number;
  ratingCount: number;
  score: number;
  reasons: string[];
}

export const DEFAULT_WEIGHTS = {
  skill: 40,
  area: 25,
  experience: 15,
  rating: 10,
  budget: 10,
} as const;

export type Weights = typeof DEFAULT_WEIGHTS;

const CANDIDATE_CAP = 300;

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function includesCI(list: string[], value: string): boolean {
  const v = norm(value);
  return list.some((item) => norm(item) === v || norm(item).includes(v) || v.includes(norm(item)));
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Hard eligibility filters (mandatory). Only approved, active worker profiles pass.
 * This runs in the backend and cannot be influenced by the LLM.
 */
function buildCandidateQuery(criteria: MatchCriteria): Record<string, unknown> {
  const query: Record<string, unknown> = { approvalStatus: "approved" };

  if (criteria.category) {
    query.serviceCategories = { $regex: escapeRegex(criteria.category.trim()), $options: "i" };
  }
  if (criteria.skills && criteria.skills.length > 0) {
    query.skills = { $regex: criteria.skills.map(escapeRegex).join("|"), $options: "i" };
  }
  if (criteria.location) {
    query.serviceAreas = { $regex: escapeRegex(criteria.location.trim()), $options: "i" };
  }
  if (criteria.text && criteria.text.trim()) {
    // Only constrain by free-text if category and skills were not already identified.
    // If category or skills are already specified, those accurately restrict the trade,
    // and matching the full user problem description against worker profile text would return zero candidates.
    if (!criteria.category && (!criteria.skills || criteria.skills.length === 0)) {
      const trimmed = criteria.text.trim();
      const keywords = trimmed
        .split(/\s+/)
        .map((w) => w.replace(/[^\w]/g, ""))
        .filter((w) => w.length > 2);
      const pattern = keywords.length > 0 ? keywords.map(escapeRegex).join("|") : escapeRegex(trimmed);
      query.$or = [
        { professionalDescription: { $regex: pattern, $options: "i" } },
        { skills: { $regex: pattern, $options: "i" } },
        { serviceCategories: { $regex: pattern, $options: "i" } },
      ];
    }
  }
  return query;
}

interface ScoreBreakdown {
  score: number;
  reasons: string[];
}

function scoreWorker(profile: IWorkerProfile, criteria: MatchCriteria, weights: Weights): ScoreBreakdown {
  const reasons: string[] = [];
  const factors: { key: keyof Weights; value: number; reason?: string }[] = [];

  // --- Skill / category match -------------------------------------------------
  const required = (criteria.skills ?? []).map(norm).filter(Boolean);
  const skills = profile.skills ?? [];
  let skillValue: number;
  let matchedSkills: string[] = [];

  if (required.length > 0) {
    matchedSkills = required.filter((req) => skills.some((s) => norm(s) === req || norm(s).includes(req) || req.includes(norm(s))));
    skillValue = matchedSkills.length / required.length;
    if (matchedSkills.length > 0) {
      const pretty = matchedSkills.slice(0, 3).map((s) => {
        const match = skills.find((x) => norm(x) === s || norm(x).includes(s));
        return match ?? s;
      });
      reasons.push(`Lists ${pretty.join(", ")} as a matching skill${pretty.length > 1 ? "s" : ""}`);
    }
  } else if (criteria.category) {
    const catMatch = includesCI(profile.serviceCategories, criteria.category);
    skillValue = catMatch ? 1 : 0.3;
    if (catMatch) reasons.push(`Works in ${criteria.category}`);
  } else {
    skillValue = 0.5;
  }
  factors.push({ key: "skill", value: Math.max(0, Math.min(1, skillValue)) });

  // --- Service area match -----------------------------------------------------
  if (criteria.location) {
    const areaMatch = includesCI(profile.serviceAreas, criteria.location);
    factors.push({ key: "area", value: areaMatch ? 1 : 0.5 });
    if (areaMatch) reasons.push(`Serves ${criteria.location}`);
  } else {
    // No location constraint supplied: neutral value, weight still applies.
    factors.push({ key: "area", value: 1 });
  }

  // --- Experience -------------------------------------------------------------
  const years = num(profile.experienceYears, 0);
  factors.push({ key: "experience", value: Math.max(0, Math.min(1, years / 10)) });
  if (years >= 3) reasons.push(`${years} years of experience`);

  // --- Rating (only when genuine data exists) --------------------------------
  const ratingCount = num(profile.ratingCount, 0);
  const ratingAvg = num(profile.ratingAverage, 0);
  if (ratingCount > 0 && ratingAvg > 0) {
    factors.push({ key: "rating", value: Math.max(0, Math.min(1, ratingAvg / 5)) });
    reasons.push(`Rated ${ratingAvg.toFixed(1)} by ${ratingCount} customer${ratingCount > 1 ? "s" : ""}`);
  }

  // --- Budget compatibility ---------------------------------------------------
  if (typeof criteria.budget === "number" && criteria.budget > 0) {
    const pricing = profile.pricing;
    if (pricing && (pricing.type === "fixed" || pricing.type === "hourly") && typeof pricing.amount === "number") {
      if (pricing.amount <= criteria.budget) {
        factors.push({ key: "budget", value: 1 });
        reasons.push(`Pricing fits your budget`);
      } else {
        const ratio = criteria.budget / (pricing.amount || 1);
        factors.push({ key: "budget", value: Math.max(0, Math.min(0.6, ratio * 0.6)) });
        reasons.push(`Priced slightly above your stated budget`);
      }
    } else {
      // Quote-based: we cannot know the price, do not fabricate one.
      factors.push({ key: "budget", value: 0.6 });
      reasons.push("Offers a custom quote for your job");
    }
  }

  // --- Weighted score with redistribution for missing factors -----------------
  const activeWeight = factors.reduce((sum, f) => sum + weights[f.key], 0);
  const weighted = factors.reduce((sum, f) => sum + weights[f.key] * f.value, 0);
  const score = activeWeight > 0 ? (weighted / activeWeight) * 100 : 0;

  return { score: Math.round(score * 10) / 10, reasons: reasons.slice(0, 4) };
}

export interface MatchResult {
  workers: MatchedWorker[];
  total: number;
  weightsUsed: Weights;
  activeFactors: string[];
}

export async function findMatches(
  criteria: MatchCriteria,
  opts: { page?: number; limit?: number; minRating?: number; minExperience?: number; availabilityNow?: boolean; sort?: string } = {},
): Promise<MatchResult> {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(50, Math.max(1, opts.limit ?? 12));

  const query = buildCandidateQuery(criteria);
  const profiles = await WorkerProfile.find(query)
    .limit(CANDIDATE_CAP)
    .populate<{ userId: { _id: mongoose.Types.ObjectId; name: string; accountStatus: string; avatarUrl?: string; role: string } | null }>(
      "userId",
      "name accountStatus avatarUrl role",
    )
    .lean()
    .exec();

  let rated: MatchedWorker[] = [];

  for (const profile of profiles) {
    const user = profile.userId as unknown as {
      _id: mongoose.Types.ObjectId;
      name: string;
      accountStatus: string;
      avatarUrl?: string;
      role: string;
    } | null;
    // Defence in depth: only active workers are ever eligible.
    if (!user || user.accountStatus !== "active" || user.role !== "worker") continue;

    if (opts.minExperience !== undefined && num(profile.experienceYears, 0) < opts.minExperience) continue;
    if (opts.minRating !== undefined && num(profile.ratingAverage, 0) < opts.minRating) continue;
    if (opts.availabilityNow && !(profile.availability?.availableNow)) continue;

    const { score, reasons } = scoreWorker(profile as unknown as IWorkerProfile, criteria, DEFAULT_WEIGHTS);

    rated.push({
      workerId: String(profile._id),
      userId: String(user._id),
      name: user.name,
      avatarUrl: user.avatarUrl || "",
      professionalDescription: profile.professionalDescription,
      serviceCategories: profile.serviceCategories ?? [],
      skills: profile.skills ?? [],
      experienceYears: num(profile.experienceYears, 0),
      serviceAreas: profile.serviceAreas ?? [],
      pricing: profile.pricing ?? { type: "quote", currency: "INR" },
      availability: profile.availability ?? { availableNow: false, days: [] },
      verificationStatus: profile.verificationStatus,
      approvalStatus: profile.approvalStatus,
      ratingAverage: num(profile.ratingAverage, 0),
      ratingCount: num(profile.ratingCount, 0),
      score,
      reasons,
    });
  }

  // Deterministic ranking. Default is relevance (weighted score).
  const sortKey = opts.sort ?? "relevance";
  rated = rated.sort((a, b) => {
    if (sortKey === "rating" && b.ratingAverage !== a.ratingAverage) return b.ratingAverage - a.ratingAverage;
    if (sortKey === "experience" && b.experienceYears !== a.experienceYears) return b.experienceYears - a.experienceYears;
    if (sortKey === "reviews" && b.ratingCount !== a.ratingCount) return b.ratingCount - a.ratingCount;
    if (b.score !== a.score) return b.score - a.score;
    if (b.ratingAverage !== a.ratingAverage) return b.ratingAverage - a.ratingAverage;
    if (b.ratingCount !== a.ratingCount) return b.ratingCount - a.ratingCount;
    return a.workerId.localeCompare(b.workerId);
  });

  const total = rated.length;
  const start = (page - 1) * limit;
  const paged = rated.slice(start, start + limit);

  return { workers: paged, total, weightsUsed: DEFAULT_WEIGHTS, activeFactors: ["skill", "area", "experience", "rating", "budget"] };
}

export default findMatches;
