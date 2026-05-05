import { z } from "zod";
import { uuidSchema } from "./uuid.schema";

export const receivingTransactionSchema = z.object({
  item_id: uuidSchema,
  quantity: z.number().int().positive(),
  reference: z.string().trim().min(1).max(255).optional(),
  notes: z.string().trim().min(1).optional(),
});
