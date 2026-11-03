import type { Request, Response } from "express";
import ChatSession, { type IChatSession } from "../models/ChatSession.js";
import parseRequest from "../services/aiService.js";
import findMatches from "../services/matchingService.js";
import ApiError from "../utils/ApiError.js";
import { buildPaginated, getPagination } from "../utils/pagination.js";
import type {
  ChatMessageInput,
  CreateConversationInput,
  UpdateConversationInput,
} from "../validators/chat.js";

const RESULT_LIMIT = 6;
const DEFAULT_TITLE = "New conversation";

/** Never trust a client-supplied customerId; identity comes from the JWT. */
function currentCustomerId(req: { user?: { id: string } }): string {
  const id = req.user?.id;
  if (!id) throw ApiError.unauthorized();
  return id;
}

/**
 * Load a conversation that belongs to the caller. If the id exists but belongs
 * to someone else we return 403 (not 404) so ID probing cannot be used to
 * enumerate other customers' conversations.
 */
async function findOwnedConversation(id: string, customerId: string): Promise<IChatSession> {
  const idFilter = [{ conversationId: id }, { sessionKey: id }];
  const session = await ChatSession.findOne({ customerId, $or: idFilter }).exec();
  if (session) {
    // Lazy backfill for records created before conversationId existed.
    if (!session.conversationId) session.conversationId = session.sessionKey;
    return session;
  }

  const exists = await ChatSession.exists({ $or: idFilter });
  if (exists) {
    throw ApiError.forbidden("You do not have access to this conversation");
  }
  throw ApiError.notFound("Conversation not found");
}

function preview(messages: IChatSession["messages"]): string | null {
  const last = messages[messages.length - 1];
  if (!last) return null;
  const text = last.content.replace(/\s+/g, " ").trim();
  return text.length > 140 ? `${text.slice(0, 137)}…` : text;
}

function toSummary(session: IChatSession) {
  return {
    conversationId: session.conversationId ?? session.sessionKey,
    sessionKey: session.sessionKey,
    title: session.title || DEFAULT_TITLE,
    status: session.status,
    lastMessage: preview(session.messages),
    messageCount: session.messages.length,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

function toDetail(session: IChatSession) {
  return {
    ...toSummary(session),
    messages: session.messages.map((m) => ({ role: m.role, content: m.content, at: m.at })),
    requirements: session.extractedRequirements,
  };
}

function buildTitle(message: string): string {
  const clean = message.replace(/\s+/g, " ").trim();
  if (clean.length <= 60) return clean;
  return `${clean.slice(0, 57)}…`;
}

/* ------------------------------- customer -------------------------------- */

/** Create a new, empty conversation owned by the authenticated customer. */
export async function createConversation(
  req: Request<unknown, unknown, CreateConversationInput>,
  res: Response,
) {
  const customerId = currentCustomerId(req);
  const title = req.body.title?.trim() || DEFAULT_TITLE;

  const session = await ChatSession.create({
    customerId,
    title,
    status: "ACTIVE",
    messages: [],
  });

  res.status(201).json({ success: true, conversation: toSummary(session) });
}

/** List only the authenticated customer's conversations, newest first. */
export async function listConversations(req: Request, res: Response) {
  const customerId = currentCustomerId(req);
  const { page, limit, skip } = getPagination(req.query, 20);

  const requestedStatus = String(req.query.status ?? "ALL").trim().toUpperCase();
  const status =
    requestedStatus === "ACTIVE" || requestedStatus === "ARCHIVED" ? requestedStatus : "ALL";

  const filter: Record<string, unknown> = { customerId };
  if (status !== "ALL") filter.status = status;

  const [items, total] = await Promise.all([
    ChatSession.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).exec(),
    ChatSession.countDocuments(filter),
  ]);

  res.json({
    success: true,
    ...buildPaginated(items.map(toSummary), total, { page, limit, skip }),
  });
}

/** Read one conversation with its full message history. */
export async function getConversation(req: Request<{ id: string }>, res: Response) {
  const session = await findOwnedConversation(req.params.id, currentCustomerId(req));
  res.json({ success: true, conversation: toDetail(session) });
}

/** Rename or archive/restore a conversation. */
export async function updateConversation(
  req: Request<{ id: string }, unknown, UpdateConversationInput>,
  res: Response,
) {
  const session = await findOwnedConversation(req.params.id, currentCustomerId(req));

  if (req.body.title !== undefined) session.title = req.body.title;
  if (req.body.status !== undefined) session.status = req.body.status;

  await session.save();
  res.json({ success: true, conversation: toSummary(session) });
}

/** Permanently delete one conversation owned by the caller. */
export async function deleteConversation(req: Request<{ id: string }>, res: Response) {
  const session = await findOwnedConversation(req.params.id, currentCustomerId(req));
  const conversationId = session.conversationId ?? session.sessionKey;
  await session.deleteOne();
  res.json({ success: true, conversationId });
}

/**
 * Send a message in a conversation. A missing conversation id creates a new
 * conversation for the authenticated customer. Context is always loaded from
 * that customer's own conversation document only.
 */
export async function sendMessage(
  req: Request<unknown, unknown, ChatMessageInput>,
  res: Response,
) {
  const { message } = req.body;
  const customerId = currentCustomerId(req);
  const requestedId = req.body.conversationId ?? req.body.sessionKey;

  let session: IChatSession;
  if (requestedId) {
    session = await findOwnedConversation(requestedId, customerId);
    if (session.status === "ARCHIVED") {
      throw ApiError.badRequest("This conversation is archived. Restore it before sending messages.");
    }
  } else {
    session = await ChatSession.create({
      customerId,
      title: DEFAULT_TITLE,
      status: "ACTIVE",
      messages: [],
    });
  }

  if (!session.conversationId) session.conversationId = session.sessionKey;

  // Auto-title only when the conversation still has its placeholder title, so
  // a title the customer explicitly chose is never overwritten.
  if (!session.title || session.title === DEFAULT_TITLE) {
    session.title = buildTitle(message);
  }

  session.messages.push({ role: "user", content: message, at: new Date() });

  // Only send a trimmed window of history to the model; the stored history is
  // kept intact so the customer can reopen the full conversation later.
  const window = session.messages.slice(-10);
  const previous = session.extractedRequirements;

  const parsed = await parseRequest({
    messages: window,
    previous,
    userId: customerId,
    userRole: req.user?.role ?? "customer",
  });

  session.messages.push({ role: "assistant", content: parsed.reply, at: new Date() });
  session.extractedRequirements = parsed.requirements as typeof session.extractedRequirements;
  await session.save();

  let workers: unknown[] = [];
  let matchSummary: { total: number; weightsUsed: unknown } | null = null;

  if (
    parsed.requirements.search_ready &&
    parsed.requirements.service_category &&
    parsed.requirements.location
  ) {
    const result = await findMatches(
      {
        category: parsed.requirements.service_category,
        skills: parsed.requirements.required_skills,
        location: parsed.requirements.location,
        budget: parsed.requirements.budget,
        urgency: parsed.requirements.urgency,
      },
      { page: 1, limit: RESULT_LIMIT },
    );
    workers = result.workers;
    matchSummary = { total: result.total, weightsUsed: result.weightsUsed };
  }

  res.json({
    success: true,
    conversationId: session.conversationId ?? session.sessionKey,
    sessionKey: session.sessionKey,
    conversation: toSummary(session),
    reply: parsed.reply,
    requirements: parsed.requirements,
    workers,
    matchSummary,
    degraded: parsed.degraded,
  });
}
