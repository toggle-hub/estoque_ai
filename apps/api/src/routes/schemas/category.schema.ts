import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1).optional(),
});
