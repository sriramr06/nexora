import { isAxiosError } from "axios";

export interface ApiErrorDetail {
  field: string;
  message: string;
}

// Every failed request becomes an ApiError, so components can switch on `code` (FE §6).
export class ApiError extends Error {
  constructor(
    public readonly status: number, // 0 = no response (network error)
    public readonly code: string,
    message: string,
    public readonly details: ApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string; details?: ApiErrorDetail[] };
}

export const toApiError = (error: unknown): ApiError => {
  if (error instanceof ApiError) return error;

  if (isAxiosError<ErrorBody>(error)) {
    if (!error.response) {
      return new ApiError(0, "NETWORK_ERROR", "Cannot reach the server. Check your connection.");
    }
    const body = error.response.data?.error;
    return new ApiError(
      error.response.status,
      body?.code ?? "INTERNAL_ERROR",
      body?.message ?? "Something went wrong. Please try again.",
      body?.details ?? [],
    );
  }

  return new ApiError(0, "INTERNAL_ERROR", "Something went wrong. Please try again.");
};
