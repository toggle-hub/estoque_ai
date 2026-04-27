import type { db } from "../db";
import { itemsTable } from "../db/schema";

type Database = typeof db;

/**
 * Creates an item owned by one organization.
 *
 * @param database Database handle.
 * @param input Item fields.
 * @returns Inserted item record.
 */
export const createItem = async (
  database: Database,
  input: {
    organizationId: string;
    categoryId?: string;
    sku: string;
    name: string;
    description?: string;
    unitPrice: string;
    reorderPoint?: number;
  },
) => {
  const [item] = await database
    .insert(itemsTable)
    .values({
      organization_id: input.organizationId,
      category_id: input.categoryId,
      sku: input.sku,
      name: input.name,
      description: input.description,
      unit_price: input.unitPrice,
      reorder_point: input.reorderPoint,
    })
    .returning();

  return item;
};
