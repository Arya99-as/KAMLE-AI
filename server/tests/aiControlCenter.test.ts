import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { connectDB, disconnectDB } from "../src/config/db.js";
import { createApp } from "../src/app.js";
import User from "../src/models/User.js";
import AiLog from "../src/models/AiLog.js";
import { hashPassword } from "../src/utils/password.js";

let app: Express;
let customerToken = "";
let adminToken = "";

beforeAll(async () => {
  await connectDB();
  app = createApp();

  const customerReg = await request(app).post("/api/auth/register").send({
    name: "AI Test Customer",
    phone: "9800000001",
    email: "aitestcustomer@example.com",
    password: "Password123",
    role: "customer",
  });
  customerToken = customerReg.body.token;

  await User.create({
    name: "AI Test Admin",
    phone: "9800000002",
    email: "aitestadmin@example.com",
    passwordHash: await hashPassword("Password123"),
    role: "admin",
    accountStatus: "active",
  });

  const adminLogin = await request(app).post("/api/auth/login").send({
    identifier: "9800000002",
    password: "Password123",
  });
  adminToken = adminLogin.body.token;
});

afterAll(async () => {
  await disconnectDB();
});

describe("MURN AI Control Center Security & Access Control", () => {
  it("rejects unauthenticated requests to AI admin routes", async () => {
    const res = await request(app).get("/api/admin/ai/overview");
    expect(res.status).toBe(401);
  });

  it("forbids non-admin (customer) users from accessing AI admin routes", async () => {
    const res = await request(app)
      .get("/api/admin/ai/overview")
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it("grants access to authorized administrators", async () => {
    const res = await request(app)
      .get("/api/admin/ai/overview")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.stats).toBeDefined();
    expect(res.body.stats.metrics).toBeDefined();
  });
});

describe("AI Activity Logging and Chat Integration", () => {
  it("generates an activity log record when a user sends a chat message", async () => {
    const initialLogCount = await AiLog.countDocuments();

    const chatRes = await request(app)
      .post("/api/chat/message")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        message: "Need urgent plumbing service for pipe leakage in Kolhapur, budget 800",
      });

    expect(chatRes.status).toBe(200);
    expect(chatRes.body.requirements.service_category).toBe("Plumbing");
    expect(chatRes.body.requirements.location).toBe("Kolhapur");

    // Wait a brief moment for async logging
    await new Promise((r) => setTimeout(r, 200));

    const finalLogCount = await AiLog.countDocuments();
    expect(finalLogCount).toBeGreaterThan(initialLogCount);

    const latestLog = await AiLog.findOne().sort({ createdAt: -1 });
    expect(latestLog).not.toBeNull();
    expect(latestLog?.feature).toBe("problem_understanding");
    expect(latestLog?.status).toBe("SUCCESS");
    expect(latestLog?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("does not allow one customer to reuse another customer's chat session", async () => {
    const first = await request(app)
      .post("/api/chat/message")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ message: "Kitchen pipe leak please help" });

    expect(first.status).toBe(200);
    const sessionKey = first.body.sessionKey;

    const secondCustomer = await request(app).post("/api/auth/register").send({
      name: "Second Chat Customer",
      phone: "9600000999",
      email: "secondchatcustomer@example.com",
      password: "Password123",
      role: "customer",
    });
    const secondToken = secondCustomer.body.token;

    const secondChat = await request(app)
      .post("/api/chat/message")
      .set("Authorization", `Bearer ${secondToken}`)
      .send({ sessionKey, message: "I need plumbing help" });

    expect(secondChat.status).toBe(403);
  });
});

describe("AI Control Center Admin APIs", () => {
  it("returns paginated and filterable logs", async () => {
    const res = await request(app)
      .get("/api/admin/ai/logs?limit=10")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toBeInstanceOf(Array);
    expect(res.body.page).toBe(1);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
  });

  it("exports activity logs as CSV", async () => {
    const res = await request(app)
      .get("/api/admin/ai/logs/export/csv")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.text).toContain("LogId,Timestamp,Feature,Provider,Model,Status");
  });

  it("lists supported providers with status and metrics", async () => {
    const res = await request(app)
      .get("/api/admin/ai/providers")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.providers).toBeInstanceOf(Array);
    const names = res.body.providers.map((p: any) => p.provider);
    expect(names).toContain("gemini");
    expect(names).toContain("openai");
    expect(names).toContain("heuristic");
  });

  it("returns usage analytics aggregated by feature and provider", async () => {
    const res = await request(app)
      .get("/api/admin/ai/analytics")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.analytics).toBeDefined();
    expect(res.body.analytics.byFeature).toBeInstanceOf(Array);
    expect(res.body.analytics.latencyPercentiles).toBeDefined();
  });

  it("returns cost analytics with budget thresholds and warning statuses", async () => {
    const res = await request(app)
      .get("/api/admin/ai/costs")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.costs).toBeDefined();
    expect(res.body.costs.summary).toBeDefined();
    expect(res.body.costs.budgets.dailyLimitUsd).toBeGreaterThan(0);
  });

  it("returns performance percentiles and slowest features", async () => {
    const res = await request(app)
      .get("/api/admin/ai/performance")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.performance).toBeDefined();
    expect(res.body.performance.metrics.p50LatencyMs).toBeDefined();
  });

  it("lists implemented AI features and allows admin toggle", async () => {
    const listRes = await request(app)
      .get("/api/admin/ai/features")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.features.length).toBeGreaterThanOrEqual(2);

    // Disable problem_understanding
    const patchRes = await request(app)
      .patch("/api/admin/ai/features/problem_understanding")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ enabled: false });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.feature.enabled).toBe(false);

    // Re-enable
    await request(app)
      .patch("/api/admin/ai/features/problem_understanding")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ enabled: true });
  });

  it("runs AI evaluation benchmark dataset and records results", async () => {
    const evalRes = await request(app)
      .post("/api/admin/ai/evaluations/run")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(evalRes.status).toBe(200);
    expect(evalRes.body.success).toBe(true);
    expect(evalRes.body.evaluation).toBeDefined();
    expect(evalRes.body.evaluation.totalCases).toBe(8);
    expect(evalRes.body.evaluation.accuracyPercent).toBeGreaterThanOrEqual(0);
  });

  it("returns masked settings and updates configuration with audit logging", async () => {
    const getRes = await request(app)
      .get("/api/admin/ai/settings")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.settings.maskedApiKey).toBeDefined();

    const putRes = await request(app)
      .put("/api/admin/ai/settings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        timeoutMs: 9000,
        budgets: { dailyLimitUsd: 15.0, warningThresholdPercent: 85 },
      });

    expect(putRes.status).toBe(200);
    expect(putRes.body.settings.timeoutMs).toBe(9000);
    expect(putRes.body.settings.budgets.dailyLimitUsd).toBe(15.0);

    // Verify audit log
    const auditRes = await request(app)
      .get("/api/admin/ai/audit")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(auditRes.status).toBe(200);
    expect(auditRes.body.items.length).toBeGreaterThanOrEqual(1);
  });
});
