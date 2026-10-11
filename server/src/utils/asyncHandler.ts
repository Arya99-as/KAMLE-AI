import type { NextFunction, Request, RequestHandler, Response } from "express";

// Wraps async route handlers so rejected promises reach the error middleware.
export function asyncHandler<
  P = Record<string, string>,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = unknown,
>(
  fn: (
    req: Request<P, ResBody, ReqBody, ReqQuery>,
    res: Response<ResBody>,
    next: NextFunction,
  ) => Promise<unknown> | unknown,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req as never, res as never, next)).catch(next);
  };
}

export default asyncHandler;
