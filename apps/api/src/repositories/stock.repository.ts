import { and, eq, isNull, lte } from "drizzle-orm";
import type { db } from "../db";
import { itemsTable, locationsTable, stockLevelsTable } from "../db/schema";

type Database = typeof db;

type StockFilterInput = {
  organizationId: string;
  locationId?: string;
  itemId?: string;
  lowStock?: boolean;
  limit: number;
  offset: number;
};

/**
 * Builds stock list filters that preserve organization and active row isolation.
 *
 * @param input Organization scope and optional stock filters.
 * @returns Drizzle filter expressions for the stock list query.
 */
const buildStockFilters = (input: StockFilterInput) => {
  const filters = [
    eq(stockLevelsTable.organization_id, input.organizationId),
    eq(itemsTable.organization_id, input.organizationId),
    eq(locationsTable.organization_id, input.organizationId),
    eq(itemsTable.is_active, true),
    eq(locationsTable.is_active, true),
    isNull(itemsTable.deleted_at),
    isNull(locationsTable.deleted_at),
  ];

  if (input.locationId) {
    filters.push(eq(stockLevelsTable.location_id, input.locationId));
  }

  if (input.itemId) {
    filters.push(eq(stockLevelsTable.item_id, input.itemId));
  }

  if (input.lowStock) {
    filters.push(lte(stockLevelsTable.quantity, itemsTable.reorder_point));
  }

  return filters;
};

/**
 * Lists active stock levels for one organization with item and location summaries.
 *
 * @param database Database handle.
 * @param input Organization scope and optional stock filters.
 * @returns Stock rows ordered by item and location names plus one extra row when another page exists.
 */
export const listActiveStockLevelsByOrganizationId = async (
  database: Database,
  input: StockFilterInput,
) =>
  database
    .select({
      id: stockLevelsTable.id,
      organization_id: stockLevelsTable.organization_id,
      location_id: stockLevelsTable.location_id,
      item_id: stockLevelsTable.item_id,
      quantity: stockLevelsTable.quantity,
      created_at: stockLevelsTable.created_at,
      updated_at: stockLevelsTable.updated_at,
      item: {
        id: itemsTable.id,
        sku: itemsTable.sku,
        name: itemsTable.name,
        unit_price: itemsTable.unit_price,
        reorder_point: itemsTable.reorder_point,
      },
      location: {
        id: locationsTable.id,
        name: locationsTable.name,
      },
    })
    .from(stockLevelsTable)
    .innerJoin(itemsTable, eq(itemsTable.id, stockLevelsTable.item_id))
    .innerJoin(locationsTable, eq(locationsTable.id, stockLevelsTable.location_id))
    .where(and(...buildStockFilters(input)))
    .orderBy(itemsTable.name, locationsTable.name)
    .limit(input.limit + 1)
    .offset(input.offset);
