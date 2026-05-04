import { z } from "zod";

export const itemSchema = z.object({
  category_id: z.string().optional(),
  sku: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1).optional(),
  unit_price: z
    .number()
    .nonnegative()
    .max(99999999.99, { message: "unit_price must be <= 99999999.99 (DECIMAL(10,2))" })
    .refine((value) => Math.abs(Math.round(value * 100) - value * 100) < Number.EPSILON * 100, {
      message: "unit_price must have at most 2 decimal places",
    }),
  reorder_point: z.number().int().nonnegative().optional(),
  quantity: z.number().int().nonnegative().optional(),
});
