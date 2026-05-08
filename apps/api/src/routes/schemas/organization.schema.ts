import { z } from "zod";

export const organizationSchema = z.object({
  name: z.string().trim().min(1),
  cnpj: z.string().trim().min(1).max(18).optional(),
  email: z.email().optional(),
  phone: z.string().trim().min(1).max(20).optional(),
  plan_type: z.string().trim().min(1).max(50).optional(),
});

/**
 * Builds an optional trimmed profile field that stores empty values as null.
 *
 * @param maxLength Maximum accepted string length.
 * @returns Zod schema for optional nullable profile values.
 */
const optionalProfileValue = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .transform((value) => value || null)
    .nullable()
    .optional();

export const organizationUpdateSchema = z.object({
  name: z.string().trim().min(1),
  cnpj: optionalProfileValue(18),
  email: z
    .union([z.email(), z.literal("")])
    .transform((value) => value || null)
    .nullable()
    .optional(),
  phone: optionalProfileValue(20),
  plan_type: optionalProfileValue(50),
});
