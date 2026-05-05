import { and, eq, sql } from "drizzle-orm";
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
    const [stockLevel] = await tx
      .update(stockLevelsTable)
      .set({
        quantity: sql`${stockLevelsTable.quantity} + ${input.quantity}`,
        updated_at: new Date(),
      })
      .where(
        and(
          eq(stockLevelsTable.organization_id, input.organizationId),
          eq(stockLevelsTable.location_id, input.locationId),
          eq(stockLevelsTable.item_id, input.itemId),
          sql`exists (
            select 1
            from ${itemsTable}
            where ${itemsTable.id} = ${stockLevelsTable.item_id}
              and ${itemsTable.organization_id} = ${input.organizationId}
              and ${itemsTable.is_active} = true
              and ${itemsTable.deleted_at} is null
          )`,
        ),
      )
      .returning();

    if (!stockLevel) {
      return undefined;
    }

    const previousQuantity = stockLevel.quantity - input.quantity;

    const [transaction] = await tx
      .insert(transactionsTable)
      .values({
        organization_id: input.organizationId,
        location_id: input.locationId,
        item_id: input.itemId,
        type: "RECEIVING",
        quantity: input.quantity,
        previous_quantity: previousQuantity,
        new_quantity: stockLevel.quantity,
        reference: input.reference,
        notes: input.notes,
        performed_by: input.performedBy,
      })
      .returning();

    return { transaction, stock_level: stockLevel };
  });
