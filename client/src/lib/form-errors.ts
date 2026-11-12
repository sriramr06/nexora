import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { toApiError } from "./api-error";

// FE §7: put server VALIDATION_ERROR details on their fields; anything else
// becomes a form-level ("root") message shown above the submit button.
export const applyServerErrors = <T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): void => {
  const apiError = toApiError(error);
  let placed = false;

  for (const detail of apiError.details) {
    if ((fields as readonly string[]).includes(detail.field)) {
      setError(detail.field as Path<T>, { message: detail.message });
      placed = true;
    }
  }

  if (!placed) setError("root", { message: apiError.message });
};
