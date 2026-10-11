import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError, type ZodTypeAny } from "zod";
import ApiError from "../utils/ApiError.js";

type Source = "body" | "query" | "params";

function makeValidator(schema: ZodTypeAny, source: Source): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = (result.error as ZodError).issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
      return next(new ApiError(400, "Validation failed", "VALIDATION_ERROR", details));
    }
    // Replace with parsed (and coerced) values.
    (req as unknown as Record<string, unknown>)[source] = result.data;
    next();
  };
}

export const validateBody = (schema: ZodTypeAny) => makeValidator(schema, "body");
export const validateQuery = (schema: ZodTypeAny) => makeValidator(schema, "query");
export const validateParams = (schema: ZodTypeAny) => makeValidator(schema, "params");
