import { z } from "zod";
import { uuidSchema } from "./uuid.schema";

/**
 * Parses stock boolean query values.
 *
 * @param value Expected "true" or "false" query value.
 * @returns Parsed boolean value.
 */
const parseBooleanQuery = (value: string) => value === "true";

const booleanQuerySchema = z.enum(["true", "false"]).transform(parseBooleanQuery);

export const stockQuerySchema = z.object({
  location_id: uuidSchema.optional(),
  item_id: uuidSchema.optional(),
  low_stock: booleanQuerySchema.optional(),
});
