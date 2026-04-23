import type { DatabaseError } from "pg";

type ErrorWithCause = {
  cause?: unknown;
};

/**
 * Unwraps nested database driver errors carried through generic `cause` chains.
 *
 * @param error Unknown thrown value.
 * @returns Deepest available cause when present, otherwise the original value.
 */
const unwrapErrorCause = (error: unknown): unknown => {
  let current = error;

  while (
    typeof current === "object" &&
    current !== null &&
    "cause" in current &&
    (current as ErrorWithCause).cause
  ) {
    current = (current as ErrorWithCause).cause;
  }

  return current;
};

/**
 * Returns the underlying PostgreSQL error when present through nested causes.
 *
 * @param error Unknown thrown value.
 * @returns Unwrapped PostgreSQL error when detected, otherwise `null`.
 */
export const getDatabaseError = (error: unknown): DatabaseError | null => {
  const candidate = unwrapErrorCause(error);

  if (
    typeof candidate === "object" &&
    candidate !== null &&
    "code" in candidate &&
    candidate.code === "23505"
  ) {
    return candidate as DatabaseError;
  }

  return null;
};

/**
 * Returns true when the error is a PostgreSQL unique constraint violation.
 *
 * @param error Unknown thrown value.
 * @param constraint Expected constraint name when a specific index should match.
 * @returns Whether the error matches PostgreSQL error code `23505`.
 */
export const isUniqueConstraintViolation = (error: unknown, constraint?: string): boolean => {
  const databaseError = getDatabaseError(error);

  if (databaseError?.code !== "23505") {
    return false;
  }

  if (!constraint) {
    return true;
  }

  return databaseError.constraint === constraint;
};
