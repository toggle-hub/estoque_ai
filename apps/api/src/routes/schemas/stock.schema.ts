import { z } from "zod";
import { uuidSchema } from "./uuid.schema";

const booleanQuerySchema = z.enum(["true", "false"]).transform((value) => value === "true");

export const stockQuerySchema = z.object({
  location_id: uuidSchema.optional(),
  item_id: uuidSchema.optional(),
  low_stock: booleanQuerySchema.optional(),
});
