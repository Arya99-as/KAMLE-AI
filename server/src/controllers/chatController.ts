import crypto from "node:crypto";
import type { Request, Response } from "express";
import ChatSession from "../models/ChatSession.js";
import parseRequest from "../services/aiService.js";
import findMatches from "../services/matchingService.js";
import ApiError from "../utils/ApiError.js";
import type { ChatMessageInput } from "../validators/chat.js";

const RESULT_LIMIT = 6;

export async function sendMessage(req: Request<unknown, unknown, ChatMessageInput>, res: Response) {
  const { message } = req.body;
  const sessionKey = req.body.sessionKey || crypto.randomUUID();
  const customerId = req.user?.id ?? null;

  let session = await ChatSession.findOne({ sessionKey });
  if (!session) {
    session = await ChatSession.create({
      sessionKey,
      customerId: customerId ?? undefined,
      messages: [],
    });
  } else if (customerId && session.customerId && String(session.customerId) !== customerId) {
    throw ApiError.forbidden("You do not have access to this conversation session");
  }
  if (customerId && !session.customerId) {
    session.customerId = customerId as unknown as typeof session.customerId;
  }

  session.messages.push({ role: "user", content: message, at: new Date() });

  // Only send a trimmed window of history to the model.
  const window = session.messages.slice(-10);
  const previous = session.extractedRequirements;

  const parsed = await parseRequest({
    messages: window,
    previous,
    userId: customerId ?? undefined,
    userRole: req.user?.role ?? "customer",
  });

  session.messages.push({ role: "assistant", content: parsed.reply, at: new Date() });
  session.extractedRequirements = parsed.requirements as typeof session.extractedRequirements;

  // Trim stored history to a reasonable size (data retention).
  if (session.messages.length > 40) {
    session.messages = session.messages.slice(-40);
  }
  await session.save();

  let workers: unknown[] = [];
  let matchSummary: { total: number; weightsUsed: unknown } | null = null;

  if (parsed.requirements.search_ready && parsed.requirements.service_category && parsed.requirements.location) {
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
    sessionKey,
    reply: parsed.reply,
    requirements: parsed.requirements,
    workers,
    matchSummary,
    degraded: parsed.degraded,
  });
}
