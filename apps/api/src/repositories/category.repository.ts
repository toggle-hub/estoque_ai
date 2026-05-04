import { and, eq, isNull } from "drizzle-orm";
import type { db } from "../db";
import { categoriesTable } from "../db/schema";

type Database = typeof db;

/**
 * Returns active categories for one organization ordered by category name.
 *
 * @param database Database handle.
 * @param organizationId Organization identifier.
 * @returns Matching categories.
 */
export const listActiveCategoriesByOrganizationId = async (
  database: Database,
  organizationId: string,
) =>
  database
    .select()
    .from(categoriesTable)
    .where(
      and(eq(categoriesTable.organization_id, organizationId), isNull(categoriesTable.deleted_at)),
    )
    .orderBy(categoriesTable.name);

/**
 * Creates a category owned by one organization.
 *
 * @param database Database handle.
 * @param input Category attributes and organization scope.
 * @returns Inserted category.
 */
export const createCategory = async (
  database: Database,
  input: {
    organizationId: string;
    name: string;
    description?: string;
  },
) => {
  const [category] = await database
    .insert(categoriesTable)
    .values({
      organization_id: input.organizationId,
      name: input.name,
      description: input.description,
    })
    .returning();

  return category;
};

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
