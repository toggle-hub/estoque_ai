import { and, eq, isNull } from "drizzle-orm";
import type { db } from "../db";
import { itemsTable, stockLevelsTable, transactionsTable } from "../db/schema";

type Database = typeof db;

type ReceivingTransactionResult = {
  transaction: typeof transactionsTable.$inferSelect;
  stock_level: typeof stockLevelsTable.$inferSelect;
};

/**
 * Receives stock into an existing location item stock row and records the immutable movement.
 *
 * @param database Database handle.
 * @param input Organization, location, item, and receiving transaction fields.
 * @returns Created transaction and updated stock level, or `undefined` when the item is not linked to the location.
 */
export const createReceivingTransaction = async (
  database: Database,
  input: {
    organizationId: string;
    locationId: string;
    itemId: string;
    quantity: number;
    reference?: string;
    notes?: string;
    performedBy: string;
  },
): Promise<ReceivingTransactionResult | undefined> =>
  database.transaction(async (tx) => {
    const [currentStockLevel] = await tx
      .select({ stockLevel: stockLevelsTable })
      .from(stockLevelsTable)
      .innerJoin(
        itemsTable,
        and(
          eq(itemsTable.id, stockLevelsTable.item_id),
          eq(itemsTable.organization_id, input.organizationId),
          eq(itemsTable.is_active, true),
          isNull(itemsTable.deleted_at),
        ),
      )
      .where(
        and(
          eq(stockLevelsTable.organization_id, input.organizationId),
          eq(stockLevelsTable.location_id, input.locationId),
          eq(stockLevelsTable.item_id, input.itemId),
        ),
      )
      .limit(1);

    if (!currentStockLevel) {
      return undefined;
    }

    const previousQuantity = currentStockLevel.stockLevel.quantity;
    const newQuantity = previousQuantity + input.quantity;

    const [stockLevel] = await tx
      .update(stockLevelsTable)
      .set({
        quantity: newQuantity,
        updated_at: new Date(),
      })
      .where(
        and(
          eq(stockLevelsTable.id, currentStockLevel.stockLevel.id),
          eq(stockLevelsTable.organization_id, input.organizationId),
        ),
      )
      .returning();

    const [transaction] = await tx
      .insert(transactionsTable)
      .values({
        organization_id: input.organizationId,
        location_id: input.locationId,
        item_id: input.itemId,
        type: "RECEIVING",
        quantity: input.quantity,
        previous_quantity: previousQuantity,
        new_quantity: newQuantity,
        reference: input.reference,
        notes: input.notes,
        performed_by: input.performedBy,
      })
      .returning();

    return { transaction, stock_level: stockLevel };
  });
