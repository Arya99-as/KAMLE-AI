import rateLimit from "express-rate-limit";
import env from "../config/env.js";

function handler(_req: unknown, res: { status: (n: number) => { json: (b: unknown) => void } }) {
  res.status(429).json({
    error: { message: "Too many requests, please try again later.", code: "TOO_MANY_REQUESTS" },
  });
}

export const generalLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

export const authLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

export const aiLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.aiMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});
