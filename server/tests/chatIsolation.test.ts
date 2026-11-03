import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { connectDB, disconnectDB } from "../src/config/db.js";
import { createApp } from "../src/app.js";
import ChatSession from "../src/models/ChatSession.js";
import User from "../src/models/User.js";
import { hashPassword } from "../src/utils/password.js";

let app: Express;

interface Account {
  token: string;
  userId: string;
  email: string;
}

let customerA: Account;
let customerB: Account;
let customerC: Account;
let worker: Account;
let adminToken = "";

let aConversationId = "";
let aSessionKey = "";
let bConversationId = "";

async function registerCustomer(name: string, phone: string, email: string): Promise<Account> {
  const res = await request(app).post("/api/auth/register").send({
    name,
    phone,
    email,
    password: "Password123",
    role: "customer",
  });
  expect(res.status).toBe(201);
  return { token: res.body.token as string, userId: res.body.user.id as string, email };
}

async function registerWorker(name: string, phone: string, email: string): Promise<Account> {
  const res = await request(app).post("/api/auth/register").send({
    name,
    phone,
    email,
    password: "Password123",
    role: "worker",
  });
  expect(res.status).toBe(201);
  return { token: res.body.token as string, userId: res.body.user.id as string, email };
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function listConversations(token: string, query = "") {
  return request(app).get(`/api/chat/conversations${query}`).set(auth(token));
}

function sendMessage(token: string, body: Record<string, unknown>) {
  return request(app).post("/api/chat/message").set(auth(token)).send(body);
}

function getConversation(token: string, id: string) {
  return request(app).get(`/api/chat/conversations/${id}`).set(auth(token));
}

beforeAll(async () => {
  await connectDB();
  app = createApp();

  customerA = await registerCustomer("Chat Alpha", "9700000101", "chatalpha@example.com");
  customerB = await registerCustomer("Chat Bravo", "9700000102", "chatbravo@example.com");
  customerC = await registerCustomer("Chat Charlie", "9700000103", "chatcharlie@example.com");
  worker = await registerWorker("Chat Worker", "9700000104", "chatworker@example.com");

  await User.create({
    name: "Chat Admin",
    phone: "9700000105",
    email: "chatadmin@example.com",
    passwordHash: await hashPassword("Password123"),
    role: "admin",
    accountStatus: "active",
  });
  const login = await request(app)
    .post("/api/auth/login")
    .send({ identifier: "chatadmin@example.com", password: "Password123" });
  expect(login.status).toBe(200);
  adminToken = login.body.token as string;
});

afterAll(async () => {
  await disconnectDB();
});

describe("customer chat sessions and isolation", () => {
  it("starts a brand-new customer with an empty conversation list", async () => {
    const res = await listConversations(customerA.token);
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it("creates a customer-owned conversation on the first message and auto-titles it", async () => {
    const res = await sendMessage(customerA.token, {
      message: "My kitchen sink is leaking badly in Kolhapur",
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.conversationId).toBeTruthy();
    expect(res.body.sessionKey).toBeTruthy();
    expect(res.body.conversation.title).toContain("kitchen sink");
    expect(res.body.conversation.messageCount).toBe(2);

    aConversationId = res.body.conversationId;
    aSessionKey = res.body.sessionKey;

    const stored = await ChatSession.findOne({ conversationId: aConversationId });
    expect(stored).not.toBeNull();
    expect(String(stored?.customerId)).toBe(customerA.userId);
    expect(stored?.conversationId).toBe(stored?.sessionKey);
    expect(stored?.status).toBe("ACTIVE");
    expect(stored?.title).toContain("kitchen sink");
  });

  it("keeps contextual memory inside one conversation", async () => {
    const before = await ChatSession.findOne({ conversationId: aConversationId });
    const messageCountBefore = before?.messages.length ?? 0;

    const res = await sendMessage(customerA.token, {
      conversationId: aConversationId,
      message: "Please also fix the trap under the same sink",
    });

    expect(res.status).toBe(200);
    expect(res.body.conversationId).toBe(aConversationId);
    // The previous location/category must carry forward within this thread.
    expect(res.body.requirements.location).toBe("Kolhapur");
    expect(res.body.requirements.service_category).toBe("Plumbing");

    const after = await ChatSession.findOne({ conversationId: aConversationId });
    expect(after?.messages.length).toBe(messageCountBefore + 2);
  });

  it("does not show customer A's conversations to customers B or C", async () => {
    for (const customer of [customerB, customerC]) {
      const res = await listConversations(customer.token);
      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
      expect(res.body.total).toBe(0);
    }
  });

  it("creates an independent conversation for customer B", async () => {
    const res = await sendMessage(customerB.token, {
      message: "I need an electrician to install a ceiling fan",
    });

    expect(res.status).toBe(200);
    expect(res.body.conversationId).toBeTruthy();
    expect(res.body.conversationId).not.toBe(aConversationId);

    bConversationId = res.body.conversationId;

    const bList = await listConversations(customerB.token);
    expect(bList.status).toBe(200);
    expect(bList.body.total).toBe(1);
    expect(bList.body.items[0].conversationId).toBe(bConversationId);

    const aList = await listConversations(customerA.token);
    expect(aList.body.total).toBe(1);
    expect(aList.body.items[0].conversationId).toBe(aConversationId);
    expect(aList.body.items.find((c: { conversationId: string }) => c.conversationId === bConversationId)).toBeUndefined();
  });

  it("blocks direct access to another customer's conversation by ID", async () => {
    const attempts = [
      await getConversation(customerB.token, aConversationId),
      await sendMessage(customerB.token, { conversationId: aConversationId, message: "hijack" }),
      await request(app)
        .patch(`/api/chat/conversations/${aConversationId}`)
        .set(auth(customerB.token))
        .send({ title: "Hijacked" }),
      await request(app)
        .delete(`/api/chat/conversations/${aConversationId}`)
        .set(auth(customerB.token)),
    ];

    for (const res of attempts) {
      expect(res.status).toBe(403);
      expect(String(res.body.error?.message)).toMatch(/access/i);
    }

    const reverse = await getConversation(customerA.token, bConversationId);
    expect(reverse.status).toBe(403);

    // The blocked attempts must not have changed the victim's conversation.
    const stored = await ChatSession.findOne({ conversationId: aConversationId });
    expect(stored?.title).not.toBe("Hijacked");
    expect(stored?.messages.some((m) => m.content === "hijack")).toBe(false);
  });

  it("never trusts a customerId sent by the client", async () => {
    const spoofedMessage = await sendMessage(customerA.token, {
      conversationId: aConversationId,
      customerId: customerB.userId,
      message: "Any update on the sink?",
    });
    expect(spoofedMessage.status).toBe(200);

    const stored = await ChatSession.findOne({ conversationId: aConversationId });
    expect(String(stored?.customerId)).toBe(customerA.userId);

    const spoofedCreate = await request(app)
      .post("/api/chat/conversations")
      .set(auth(customerA.token))
      .send({ customerId: customerB.userId, title: "Spoof attempt" });
    expect(spoofedCreate.status).toBe(201);

    const created = await ChatSession.findOne({
      conversationId: spoofedCreate.body.conversation.conversationId,
    });
    expect(String(created?.customerId)).toBe(customerA.userId);
    expect(created?.customerId).not.toBe(customerB.userId);
  });

  it("rejects workers, admins and unauthenticated callers", async () => {
    const workerList = await listConversations(worker.token);
    expect(workerList.status).toBe(403);

    const workerMessage = await sendMessage(worker.token, { message: "I want to chat" });
    expect(workerMessage.status).toBe(403);

    const workerDetail = await getConversation(worker.token, aConversationId);
    expect(workerDetail.status).toBe(403);

    const adminList = await listConversations(adminToken);
    expect(adminList.status).toBe(403);

    const adminMessage = await sendMessage(adminToken, { message: "Admin chat" });
    expect(adminMessage.status).toBe(403);

    const anonymousList = await request(app).get("/api/chat/conversations");
    expect(anonymousList.status).toBe(401);

    const anonymousMessage = await request(app)
      .post("/api/chat/message")
      .send({ message: "Anonymous chat" });
    expect(anonymousMessage.status).toBe(401);
  });

  it("supports multiple independent conversations for the same customer", async () => {
    const created = await request(app)
      .post("/api/chat/conversations")
      .set(auth(customerA.token))
      .send({ title: "Painting quote" });
    expect(created.status).toBe(201);
    expect(created.body.conversation.messageCount).toBe(0);
    expect(created.body.conversation.title).toBe("Painting quote");

    const paintingId = created.body.conversation.conversationId as string;

    const firstMessage = await sendMessage(customerA.token, {
      conversationId: paintingId,
      message: "I need a painter",
    });
    expect(firstMessage.status).toBe(200);
    // An explicit title must not be overwritten by auto-titling.
    expect(firstMessage.body.conversation.title).toBe("Painting quote");

    const detail = await getConversation(customerA.token, paintingId);
    expect(detail.status).toBe(200);
    expect(detail.body.conversation.messages).toHaveLength(2);

    // The first conversation is untouched by the new thread.
    const original = await getConversation(customerA.token, aConversationId);
    expect(original.body.conversation.messages.length).toBeGreaterThan(2);
  });

  it("does not leak AI context between two conversations of the same customer", async () => {
    const fresh = await request(app)
      .post("/api/chat/conversations")
      .set(auth(customerA.token))
      .send({});
    expect(fresh.status).toBe(201);

    const res = await sendMessage(customerA.token, {
      conversationId: fresh.body.conversation.conversationId,
      message: "I need a painter",
    });

    expect(res.status).toBe(200);
    // Conversation 1 established Kolhapur; the new thread must start clean.
    expect(res.body.requirements.location).toBeNull();
    expect(res.body.requirements.service_category).toBe("Painting");
  });

  it("restores the same conversations and messages after logging in again", async () => {
    const login = await request(app).post("/api/auth/login").send({
      identifier: customerA.email,
      password: "Password123",
    });
    expect(login.status).toBe(200);
    const freshToken = login.body.token as string;

    const list = await listConversations(freshToken, "?limit=50");
    expect(list.status).toBe(200);
    const ids = list.body.items.map((c: { conversationId: string }) => c.conversationId);
    expect(ids).toContain(aConversationId);
    expect(ids).not.toContain(bConversationId);

    const detail = await getConversation(freshToken, aConversationId);
    expect(detail.status).toBe(200);
    const firstUserMessage = detail.body.conversation.messages.find(
      (m: { role: string }) => m.role === "user",
    );
    expect(firstUserMessage.content).toContain("kitchen sink");
    expect(detail.body.conversation.messages.length).toBeGreaterThan(2);
  });

  it("keeps the legacy sessionKey flow scoped to its owner", async () => {
    const continued = await sendMessage(customerA.token, {
      sessionKey: aSessionKey,
      message: "Still working on the sink?",
    });
    expect(continued.status).toBe(200);
    expect(continued.body.conversationId).toBe(aConversationId);

    const crossAccount = await sendMessage(customerB.token, {
      sessionKey: aSessionKey,
      message: "Trying the legacy key",
    });
    expect(crossAccount.status).toBe(403);
  });

  it("archives and restores without losing messages", async () => {
    const created = await request(app)
      .post("/api/chat/conversations")
      .set(auth(customerC.token))
      .send({ title: "Archive me" });
    expect(created.status).toBe(201);
    const id = created.body.conversation.conversationId as string;

    await sendMessage(customerC.token, { conversationId: id, message: "Hello from C" });

    const archived = await request(app)
      .patch(`/api/chat/conversations/${id}`)
      .set(auth(customerC.token))
      .send({ status: "ARCHIVED" });
    expect(archived.status).toBe(200);
    expect(archived.body.conversation.status).toBe("ARCHIVED");

    const activeList = await listConversations(customerC.token, "?status=ACTIVE");
    expect(activeList.body.items.map((c: { conversationId: string }) => c.conversationId)).not.toContain(id);

    const archivedList = await listConversations(customerC.token, "?status=ARCHIVED");
    expect(archivedList.body.items.map((c: { conversationId: string }) => c.conversationId)).toContain(id);

    const blocked = await sendMessage(customerC.token, {
      conversationId: id,
      message: "Can I still send?",
    });
    expect(blocked.status).toBe(400);
    expect(String(blocked.body.error?.message)).toMatch(/archived/i);

    const restored = await request(app)
      .patch(`/api/chat/conversations/${id}`)
      .set(auth(customerC.token))
      .send({ status: "ACTIVE" });
    expect(restored.status).toBe(200);

    const detail = await getConversation(customerC.token, id);
    expect(detail.body.conversation.messages).toHaveLength(2);
  });

  it("deletes only the owner's conversation", async () => {
    const created = await request(app)
      .post("/api/chat/conversations")
      .set(auth(customerA.token))
      .send({ title: "Delete me" });
    expect(created.status).toBe(201);
    const id = created.body.conversation.conversationId as string;

    const foreignDelete = await request(app)
      .delete(`/api/chat/conversations/${id}`)
      .set(auth(customerB.token));
    expect(foreignDelete.status).toBe(403);

    const stillThere = await getConversation(customerA.token, id);
    expect(stillThere.status).toBe(200);

    const ownedDelete = await request(app)
      .delete(`/api/chat/conversations/${id}`)
      .set(auth(customerA.token));
    expect(ownedDelete.status).toBe(200);
    expect(ownedDelete.body.conversationId).toBe(id);

    const gone = await getConversation(customerA.token, id);
    expect(gone.status).toBe(404);

    const list = await listConversations(customerA.token, "?limit=50");
    expect(list.body.items.map((c: { conversationId: string }) => c.conversationId)).not.toContain(id);
  });

  it("returns 404 for a well-formed but unknown conversation id", async () => {
    const res = await getConversation(customerA.token, "00000000-0000-4000-8000-000000000000");
    expect(res.status).toBe(404);
  });

  it("stores every conversation against exactly one customer", async () => {
    const all = await ChatSession.find({});
    expect(all.length).toBeGreaterThan(0);
    for (const session of all) {
      expect(session.customerId).toBeTruthy();
      expect(session.conversationId).toBe(session.sessionKey);
      expect(["ACTIVE", "ARCHIVED"]).toContain(session.status);
      expect(session.title.length).toBeGreaterThan(0);
    }
  });
});
