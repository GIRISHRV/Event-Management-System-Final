/**
 * Safely extract an error message from an unknown caught value.
 * Avoids the need for `catch (err: any)` throughout the codebase.
 */
export function getErrorMessage(err: unknown, fallback = "An unexpected error occurred"): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return fallback;
}

/**
 * Safely extract an error code from an unknown caught value (e.g. Supabase errors).
 */
export function getErrorCode(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null && "code" in err) {
    return String((err as { code: unknown }).code);
  }
  return undefined;
}
