import type { NextFunction, Request, Response } from "express";
import ApiError from "../utils/ApiError.js";
import { verifyToken } from "../utils/jwt.js";
import User, { type Role } from "../models/User.js";

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7).trim();
  return null;
}

/** Requires a valid, active user. Loads the user from the DB to honour suspensions. */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractToken(req);
    if (!token) throw ApiError.unauthorized();

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      throw ApiError.unauthorized("Invalid or expired session");
    }

    const user = await User.findById(payload.sub);
    if (!user) throw ApiError.unauthorized("Account no longer exists");
    if (user.accountStatus === "suspended") throw ApiError.forbidden("This account is suspended");
    if (user.accountStatus === "deactivated") throw ApiError.forbidden("This account is deactivated");

    req.user = { id: String(user._id), role: user.role };
    next();
  } catch (err) {
    next(err);
  }
}

/** Optional auth: attaches the user when a valid token is present, never rejects. */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = verifyToken(token);
    const user = await User.findById(payload.sub);
    if (user && user.accountStatus === "active") {
      req.user = { id: String(user._id), role: user.role };
    }
  } catch {
    // ignore invalid tokens on optional routes
  }
  next();
}

/** Role guard. Use after authenticate(). Authorization is always enforced server-side. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden("Your role cannot access this resource"));
    }
    next();
  };
}
