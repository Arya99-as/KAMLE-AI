import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { connectDB, disconnectDB } from "../src/config/db.js";
import { createApp } from "../src/app.js";

let app: Express;

beforeAll(async () => {
  await connectDB();
  app = createApp();
});

afterAll(async () => {
  await disconnectDB();
});

const customer = {
  name: "Test Customer",
  phone: "9700000101",
  email: "testcustomer@example.com",
  password: "Password123",
  role: "customer",
};

describe("auth", () => {
  it("registers a customer and returns a token", async () => {
    const res = await request(app).post("/api/auth/register").send(customer);
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe("customer");
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it("rejects a duplicate phone number", async () => {
    const res = await request(app).post("/api/auth/register").send(customer);
    expect(res.status).toBe(409);
  });

  it("validates the payload", async () => {
    const res = await request(app).post("/api/auth/register").send({ name: "x", phone: "1", password: "short" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("logs in with a valid password", async () => {
    const res = await request(app).post("/api/auth/login").send({ identifier: customer.phone, password: customer.password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it("rejects an invalid password", async () => {
    const res = await request(app).post("/api/auth/login").send({ identifier: customer.phone, password: "wrongpassword" });
    expect(res.status).toBe(401);
  });

  it("rejects /me without a token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns the current user with a token", async () => {
    const login = await request(app).post("/api/auth/login").send({ identifier: customer.phone, password: customer.password });
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${login.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(customer.email);
  });

  it("forbids a customer from creating a worker profile (role enforced server-side)", async () => {
    const login = await request(app).post("/api/auth/login").send({ identifier: customer.phone, password: customer.password });
    const res = await request(app)
      .post("/api/workers/profile")
      .set("Authorization", `Bearer ${login.body.token}`)
      .send({});
    expect(res.status).toBe(403);
  });

  it("forbids a customer from the admin dashboard", async () => {
    const login = await request(app).post("/api/auth/login").send({ identifier: customer.phone, password: customer.password });
    const res = await request(app).get("/api/admin/dashboard").set("Authorization", `Bearer ${login.body.token}`);
    expect(res.status).toBe(403);
  });
});
