import type { Response } from "express";

export interface PagePagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CursorPagination {
  nextCursor: string | null;
  hasMore: boolean;
}

export const sendData = <T>(res: Response, data: T, status = 200): Response => {
  return res.status(status).json({ data });
};

export const sendCreated = <T>(res: Response, data: T): Response => {
  return sendData(res, data, 201);
};

export const sendList = <T>(
  res: Response,
  items: T[],
  pagination: PagePagination | CursorPagination,
): Response => {
  return res.status(200).json({
    data: items,
    pagination,
  });
};

export const sendNoContent = (res: Response): Response => {
  return res.status(204).end();
};
