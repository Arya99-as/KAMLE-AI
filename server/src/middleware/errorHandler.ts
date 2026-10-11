import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import mongoose from "mongoose";
import multer from "multer";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";
import env from "../config/env.js";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

interface ErrorBody {
  error: {
    message: string;
    code: string;
    details?: unknown;
  };
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response<ErrorBody>,
  _next: NextFunction,
): void {
  let status = 500;
  let code = "INTERNAL_ERROR";
  let message = "Something went wrong";
  let details: unknown;

  if (err instanceof ApiError) {
    status = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    status = 400;
    code = "VALIDATION_ERROR";
    message = "Validation failed";
    details = err.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    code = "VALIDATION_ERROR";
    message = "Validation failed";
    details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    code = "BAD_REQUEST";
    message = "Invalid identifier";
  } else if (typeof err === "object" && err !== null && (err as { code?: number }).code === 11000) {
    status = 409;
    code = "DUPLICATE";
    message = "A record with these details already exists";
  } else if (err instanceof multer.MulterError) {
    status = 400;
    code = "UPLOAD_ERROR";
    message = err.message;
  } else if (err instanceof Error) {
    message = env.isProd ? "Something went wrong" : err.message;
  }

  if (status >= 500) {
    logger.error("Unhandled error", err instanceof Error ? err : new Error(String(err)));
  }

  res.status(status).json({ error: { message, code, details } });
}
