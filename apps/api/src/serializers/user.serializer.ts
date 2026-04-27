import type { usersTable } from "../db/schema";

type UserRecord = typeof usersTable.$inferSelect;

/**
 * Removes sensitive fields before returning user data to API clients.
 *
 * @param user Database user record.
 * @returns User payload safe to expose in API responses.
 */
export const sanitizeUser = (user: UserRecord) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  is_active: user.is_active,
  created_at: user.created_at,
  updated_at: user.updated_at,
});
