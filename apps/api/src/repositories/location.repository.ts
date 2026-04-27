import { and, eq, isNull } from "drizzle-orm";
import type { db } from "../db";
import { locationsTable } from "../db/schema";

type Database = typeof db;

/**
 * Returns all active locations for one organization.
 *
 * @param database Database handle.
 * @param organizationId Organization identifier.
 * @returns Active locations ordered by name.
 */
export const listActiveLocationsByOrganizationId = async (
  database: Database,
  organizationId: string,
) =>
  database
    .select()
    .from(locationsTable)
    .where(
      and(eq(locationsTable.organization_id, organizationId), isNull(locationsTable.deleted_at)),
    )
    .orderBy(locationsTable.name);

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
