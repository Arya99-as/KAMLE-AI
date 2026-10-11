export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, code = "ERROR", details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = "ApiError";
  }

  static badRequest(message = "Bad request", details?: unknown) {
    return new ApiError(400, message, "BAD_REQUEST", details);
  }
  static unauthorized(message = "Authentication required") {
    return new ApiError(401, message, "UNAUTHORIZED");
  }
  static forbidden(message = "You do not have permission to perform this action") {
    return new ApiError(403, message, "FORBIDDEN");
  }
  static notFound(message = "Resource not found") {
    return new ApiError(404, message, "NOT_FOUND");
  }
  static conflict(message = "Conflict", details?: unknown) {
    return new ApiError(409, message, "CONFLICT", details);
  }
  static tooMany(message = "Too many requests") {
    return new ApiError(429, message, "TOO_MANY_REQUESTS");
  }
  static internal(message = "Something went wrong") {
    return new ApiError(500, message, "INTERNAL_ERROR");
  }
}

export default ApiError;
