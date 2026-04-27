import { and, eq, isNull } from "drizzle-orm";
import type { db } from "../db";
import { categoriesTable } from "../db/schema";

type Database = typeof db;

/**
 * Returns one active category scoped to an organization.
 *
 * @param database Database handle.
 * @param categoryId Category identifier.
 * @param organizationId Organization identifier.
 * @returns Matching category when found, otherwise `undefined`.
 */
export const findActiveCategoryByIdAndOrganizationId = async (
  database: Database,
  categoryId: string,
  organizationId: string,
) => {
  const [category] = await database
    .select()
    .from(categoriesTable)
    .where(
      and(
        eq(categoriesTable.id, categoryId),
        eq(categoriesTable.organization_id, organizationId),
        isNull(categoriesTable.deleted_at),
      ),
    )
    .limit(1);

  return category;
};
