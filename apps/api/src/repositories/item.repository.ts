import { and, eq, isNull } from "drizzle-orm";
import type { db } from "../db";
import { categoriesTable, itemsTable, stockLevelsTable } from "../db/schema";

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
    locationId: string;
    categoryId?: string;
    sku: string;
    name: string;
    description?: string;
    unitPrice: string;
    reorderPoint?: number;
    quantity?: number;
  },
) =>
  database.transaction(async (tx) => {
    const [item] = await tx
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

    await tx.insert(stockLevelsTable).values({
      organization_id: input.organizationId,
      location_id: input.locationId,
      item_id: item.id,
      quantity: input.quantity ?? 0,
    });

    return item;
  });

/**
 * Lists active items linked to one location with their categories when available.
 *
 * @param database Database handle.
 * @param input Location and organization scope.
 * @returns Items ordered by item name with optional category payloads.
 */
export const listActiveItemsByLocation = async (
  database: Database,
  input: {
    locationId: string;
    organizationId: string;
  },
) =>
  database
    .select({
      item: itemsTable,
      category: categoriesTable,
      quantity: stockLevelsTable.quantity,
    })
    .from(stockLevelsTable)
    .innerJoin(
      itemsTable,
      and(eq(itemsTable.id, stockLevelsTable.item_id), isNull(itemsTable.deleted_at)),
    )
    .leftJoin(
      categoriesTable,
      and(eq(categoriesTable.id, itemsTable.category_id), isNull(categoriesTable.deleted_at)),
    )
    .where(
      and(
        eq(stockLevelsTable.location_id, input.locationId),
        eq(stockLevelsTable.organization_id, input.organizationId),
      ),
    )
    .orderBy(itemsTable.name);
