import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectDB, disconnectDB } from "../src/config/db.js";
import { heuristicParse } from "../src/services/aiService.js";
import { findMatches } from "../src/services/matchingService.js";
import User from "../src/models/User.js";
import WorkerProfile from "../src/models/WorkerProfile.js";
import { hashPassword } from "../src/utils/password.js";

beforeAll(async () => {
  await connectDB();
});

afterAll(async () => {
  await disconnectDB();
});

describe("heuristic AI parser", () => {
  it("detects the service category and skills", () => {
    const { requirements } = heuristicParse({
      messages: [{ role: "user", content: "My bathroom tap is leaking", at: new Date() }],
    });
    expect(requirements.service_category).toBe("Plumbing");
    expect(requirements.required_skills).toContain("Leak Repair");
    expect(requirements.search_ready).toBe(false); // location missing
  });

  it("extracts location and budget", () => {
    const { requirements } = heuristicParse({
      messages: [{ role: "user", content: "I need a plumber in Kolhapur, budget under 500", at: new Date() }],
    });
    expect(requirements.location).toBe("Kolhapur");
    expect(requirements.budget).toBe(500);
    expect(requirements.search_ready).toBe(true);
  });

  it("recognises urgency", () => {
    const { requirements } = heuristicParse({
      messages: [{ role: "user", content: "Emergency! My pipe burst, need someone in Pune asap", at: new Date() }],
    });
    expect(requirements.urgency).toBe("emergency");
  });
});

describe("matching engine eligibility", () => {
  it("only returns approved, active workers and never fabricates ratings", async () => {
    const passwordHash = await hashPassword("Password123");

    const approvedUser = await User.create({ name: "Approved Pro", phone: "9700000301", passwordHash, role: "worker", accountStatus: "active" });
    await WorkerProfile.create({
      userId: approvedUser._id,
      professionalDescription: "Approved plumbing professional serving Kolhapur with leak detection expertise.",
      serviceCategories: ["Plumbing"],
      skills: ["Leak Repair", "Pipe Fitting"],
      experienceYears: 5,
      serviceAreas: ["Kolhapur"],
      pricing: { type: "quote", currency: "INR" },
      availability: { availableNow: true, days: [] },
      approvalStatus: "approved",
    });

    const pendingUser = await User.create({ name: "Pending Pro", phone: "9700000302", passwordHash, role: "worker", accountStatus: "active" });
    await WorkerProfile.create({
      userId: pendingUser._id,
      professionalDescription: "Pending plumbing professional serving Kolhapur.",
      serviceCategories: ["Plumbing"],
      skills: ["Leak Repair"],
      experienceYears: 20,
      serviceAreas: ["Kolhapur"],
      approvalStatus: "pending",
    });

    const suspendedUser = await User.create({ name: "Suspended Pro", phone: "9700000303", passwordHash, role: "worker", accountStatus: "suspended" });
    await WorkerProfile.create({
      userId: suspendedUser._id,
      professionalDescription: "Suspended plumbing professional serving Kolhapur.",
      serviceCategories: ["Plumbing"],
      skills: ["Leak Repair"],
      serviceAreas: ["Kolhapur"],
      approvalStatus: "approved",
    });

    const result = await findMatches({ category: "Plumbing", skills: ["Leak Repair"], location: "Kolhapur" });
    const names = result.workers.map((w) => w.name);

    expect(names).toContain("Approved Pro");
    expect(names).not.toContain("Pending Pro");
    expect(names).not.toContain("Suspended Pro");

    const approved = result.workers.find((w) => w.name === "Approved Pro")!;
    expect(approved.ratingCount).toBe(0);
    expect(approved.reasons.some((r) => r.toLowerCase().includes("rated"))).toBe(false);
  });

  it("is deterministic across repeated calls", async () => {
    const a = await findMatches({ category: "Plumbing", location: "Kolhapur" });
    const b = await findMatches({ category: "Plumbing", location: "Kolhapur" });
    expect(a.workers.map((w) => w.workerId)).toEqual(b.workers.map((w) => w.workerId));
  });
});
