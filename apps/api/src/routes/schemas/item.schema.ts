import { z } from "zod";

export const itemSchema = z.object({
  category_id: z.uuid().optional(),
  sku: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1).optional(),
  unit_price: z.number().nonnegative(),
  reorder_point: z.number().int().nonnegative().optional(),
  quantity: z.number().int().nonnegative().optional(),
});
