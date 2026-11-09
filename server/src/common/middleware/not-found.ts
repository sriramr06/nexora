import type { RequestHandler } from "express";
import { AppError } from "../errors/app-error";

export const notFound: RequestHandler = (_req, _res, next) => {
  next(AppError.notFound("Route not found"));
};
