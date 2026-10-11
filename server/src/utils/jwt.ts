import jwt from "jsonwebtoken";
import env from "../config/env.js";
import type { Role } from "../models/User.js";

export interface TokenPayload {
  sub: string;
  role: Role;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"] });
}

export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, env.jwtSecret);
  if (typeof decoded === "string" || !decoded.sub || !("role" in decoded)) {
    throw new Error("Invalid token payload");
  }
  return { sub: String(decoded.sub), role: (decoded as jwt.JwtPayload).role as Role };
}
