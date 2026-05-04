import { z } from "zod";

export const organizationSchema = z.object({
  name: z.string().trim().min(1),
  cnpj: z.string().trim().min(1).max(18).optional(),
  email: z.email().optional(),
  phone: z.string().trim().min(1).max(20).optional(),
  plan_type: z.string().trim().min(1).max(50).optional(),
});
