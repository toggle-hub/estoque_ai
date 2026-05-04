import { and, eq, isNull } from "drizzle-orm";
import type { db } from "../db";
import { locationsTable } from "../db/schema";

type Database = typeof db;

/**
 * Returns all active locations for one organization.
 *
 * @param database Database handle.
 * @param input Organization scope and pagination controls.
 * @returns Active locations ordered by name plus one extra row when another page exists.
 */
export const listActiveLocationsByOrganizationId = async (
  database: Database,
  input: {
    organizationId: string;
    limit: number;
    offset: number;
  },
) =>
  database
    .select()
    .from(locationsTable)
    .where(
      and(
        eq(locationsTable.organization_id, input.organizationId),
        isNull(locationsTable.deleted_at),
      ),
    )
    .orderBy(locationsTable.name)
    .limit(input.limit + 1)
    .offset(input.offset);

/**
 * Returns one active location by id.
 *
 * @param database Database handle.
 * @param locationId Location identifier.
 * @returns Matching location when found, otherwise `undefined`.
 */
export const findActiveLocationById = async (database: Database, locationId: string) => {
  const [location] = await database
    .select()
    .from(locationsTable)
    .where(and(eq(locationsTable.id, locationId), isNull(locationsTable.deleted_at)))
    .limit(1);

  return location;
};
