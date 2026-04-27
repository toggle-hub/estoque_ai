import type { organizationsTable } from "../db/schema";

/**
 * Builds the public organization response shape with an optional membership role.
 *
 * @param organization Persisted organization record.
 * @param role Membership role associated with the current user.
 * @returns Organization API payload with role when provided.
 */
export const serializeOrganization = (
  organization: typeof organizationsTable.$inferSelect,
  role?: string,
) => ({
  id: organization.id,
  name: organization.name,
  cnpj: organization.cnpj,
  email: organization.email,
  phone: organization.phone,
  plan_type: organization.plan_type,
  created_at: organization.created_at,
  updated_at: organization.updated_at,
  ...(role ? { role } : {}),
});
