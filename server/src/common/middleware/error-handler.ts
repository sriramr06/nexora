import type { ErrorRequestHandler, Response } from "express";
import { ZodError } from "zod";
import { AppError, type ErrorDetail } from "../errors/app-error";
import { ERROR_CODES, type ErrorCode } from "../errors/error-codes";

interface ErrorResponseBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetail[];
    requestId: string;
  };
}

function send(
  res: Response,
  status: number,
  code: ErrorCode,
  message: string,
  requestId: string,
  details?: ErrorDetail[],
) {
  const body: ErrorResponseBody = { error: { code, message, requestId } };
  if (details?.length) body.error.details = details;
  return res.status(status).json(body);
}

// Body-parser errors carry a `type` field (e.g. invalid JSON, body too large).
function bodyParserErrorType(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null && "type" in err && typeof err.type === "string") {
    return err.type;
  }
  return undefined;
}

// Central error handler: every error becomes the standard API error format.
// Must be registered last, after all routes and the not-found handler.
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  // The response has already started streaming; let Express close the connection.
  if (res.headersSent) return next(err);

  const requestId = String(req.id);

  if (err instanceof AppError) {
    return send(res, err.status, err.code, err.message, requestId, err.details);
  }

  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    return send(
      res,
      400,
      ERROR_CODES.VALIDATION_ERROR,
      "Some fields are invalid.",
      requestId,
      details,
    );
  }

  const parserErrorType = bodyParserErrorType(err);
  if (parserErrorType === "entity.parse.failed") {
    return send(res, 400, ERROR_CODES.VALIDATION_ERROR, "Invalid JSON body.", requestId);
  }
  if (parserErrorType === "entity.too.large") {
    return send(res, 413, ERROR_CODES.VALIDATION_ERROR, "Request body too large.", requestId);
  }

  // Unexpected error: log the details, return a generic message (no stack trace).
  req.log.error({ err }, "Unhandled error");
  return send(res, 500, ERROR_CODES.INTERNAL_ERROR, "An unexpected error occurred.", requestId);
};
