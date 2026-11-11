import type { RequestHandler, Request } from "express";
import type { ZodType } from "zod";

interface ValidationSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

export const validate = ({ body, query, params }: ValidationSchemas): RequestHandler => {
  return (req, res, next) => {
    try {
      if (body) {
        req.body = body.parse(req.body);
      }

      if (query) {
        res.locals.query = query.parse(req.query);
      }

      if (params) {
        req.params = params.parse(req.params) as Request["params"];
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
