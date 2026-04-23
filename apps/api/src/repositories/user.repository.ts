import { and, eq, isNull } from "drizzle-orm";
import type { db } from "../db";
import { usersTable } from "../db/schema";

type Database = typeof db;

/**
 * Returns one active, non-deleted user by email.
 *
 * @param database Database handle.
 * @param email User email address.
 * @returns Matching active user record when found, otherwise `undefined`.
 */
export const findActiveUserByEmail = async (database: Database, email: string) => {
  const [user] = await database
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.email, email), isNull(usersTable.deleted_at)))
    .limit(1);

  return user;
};

/**
 * Returns one active, non-deleted user by identifier.
 *
 * @param database Database handle.
 * @param id User identifier.
 * @returns Matching active user record when found, otherwise `undefined`.
 */
export const findActiveUserById = async (database: Database, id: string) => {
  const [user] = await database
    .select()
    .from(usersTable)
    .where(
      and(eq(usersTable.id, id), isNull(usersTable.deleted_at), eq(usersTable.is_active, true)),
    )
    .limit(1);

  return user;
};

/**
 * Creates a user record.
 *
 * @param database Database handle.
 * @param input Persisted user fields.
 * @returns Inserted user record.
 */
export const createUser = async (
  database: Database,
  input: { email: string; name: string; password_hash: string },
) => {
  const [user] = await database.insert(usersTable).values(input).returning();

  return user;
};
