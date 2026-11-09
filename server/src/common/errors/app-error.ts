import { ERROR_CODES, type ErrorCode } from "./error-codes";

export interface ErrorDetail {
  field: string;
  message: string;
}

export class AppError extends Error {
  public readonly status: number;
  public readonly code: ErrorCode;
  public readonly details?: ErrorDetail[];

  constructor(status: number, code: ErrorCode, message: string, details?: ErrorDetail[]) {
    super(message);

    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;

    Object.setPrototypeOf(this, new.target.prototype);
  }

  static validation(message = "Some fields are invalid.", details?: ErrorDetail[]) {
    return new AppError(400, ERROR_CODES.VALIDATION_ERROR, message, details);
  }

  static unauthenticated(message = "Authentication required.") {
    return new AppError(401, ERROR_CODES.UNAUTHENTICATED, message);
  }

  static tokenExpired(message = "Access token expired.") {
    return new AppError(401, ERROR_CODES.TOKEN_EXPIRED, message);
  }

  static forbidden(message = "You do not have permission to perform this action.") {
    return new AppError(403, ERROR_CODES.FORBIDDEN, message);
  }

  static notFound(message = "Resource not found.") {
    return new AppError(404, ERROR_CODES.NOT_FOUND, message);
  }

  static duplicate(message = "Resource already exists.") {
    return new AppError(409, ERROR_CODES.DUPLICATE, message);
  }

  static rateLimited(message = "Too many requests.") {
    return new AppError(429, ERROR_CODES.RATE_LIMITED, message);
  }

  static internal(message = "An unexpected error occurred.") {
    return new AppError(500, ERROR_CODES.INTERNAL_ERROR, message);
  }
}
