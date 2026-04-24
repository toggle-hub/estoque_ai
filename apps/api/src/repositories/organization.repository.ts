import { and, eq, isNull } from "drizzle-orm";
import type { db } from "../db";
import { locationsTable, organizationsTable, userOrganizationsTable } from "../db/schema";

type Database = typeof db;

type OrganizationMembership = {
  organization: typeof organizationsTable.$inferSelect;
  role: string;
};

/**
 * Returns all active organization memberships for one user.
 *
 * @param database Database handle.
 * @param userId User identifier.
 * @returns Organization memberships ordered by organization name.
 */
export const listActiveOrganizationMembershipsByUserId = async (
  database: Database,
  userId: string,
): Promise<OrganizationMembership[]> =>
  database
    .select({
      organization: organizationsTable,
      role: userOrganizationsTable.role,
    })
    .from(userOrganizationsTable)
    .innerJoin(
      organizationsTable,
      and(
        eq(organizationsTable.id, userOrganizationsTable.organization_id),
        isNull(organizationsTable.deleted_at),
      ),
    )
    .where(
      and(eq(userOrganizationsTable.user_id, userId), isNull(userOrganizationsTable.deleted_at)),
    )
    .orderBy(organizationsTable.name);

/**
 * Returns one active organization membership for one user.
 *
 * @param database Database handle.
 * @param userId User identifier.
 * @param organizationId Organization identifier.
 * @returns Matching membership when found, otherwise `undefined`.
 */
export const findActiveOrganizationMembership = async (
  database: Database,
  userId: string,
  organizationId: string,
) => {
  const [membership] = await database
    .select({
      organization: organizationsTable,
      role: userOrganizationsTable.role,
    })
    .from(userOrganizationsTable)
    .innerJoin(
      organizationsTable,
      and(
        eq(organizationsTable.id, userOrganizationsTable.organization_id),
        isNull(organizationsTable.deleted_at),
      ),
    )
    .where(
      and(
        eq(userOrganizationsTable.user_id, userId),
        eq(userOrganizationsTable.organization_id, organizationId),
        isNull(userOrganizationsTable.deleted_at),
      ),
    )
    .limit(1);

  return membership;
};

/**
 * Creates an organization and active admin membership for its creator.
 *
 * @param database Database handle.
 * @param input Organization fields plus creator user id.
 * @returns Inserted organization and creator role.
 */
export const createOrganizationWithAdminMembership = async (
  database: Database,
  input: {
    userId: string;
    name: string;
    cnpj?: string;
    email?: string;
    phone?: string;
    plan_type?: string;
  },
) => {
  const [organization] = await database
    .insert(organizationsTable)
    .values({
      name: input.name,
      cnpj: input.cnpj,
      email: input.email,
      phone: input.phone,
      plan_type: input.plan_type,
    })
    .returning();

  await database.insert(userOrganizationsTable).values({
    user_id: input.userId,
    organization_id: organization.id,
    role: "admin",
  });

  return {
    organization,
    role: "admin" as const,
  };
};

/**
 * Creates a location owned by one organization.
 *
 * @param database Database handle.
 * @param input Location fields.
 * @returns Inserted location record.
 */
export const createLocation = async (
  database: Database,
  input: {
    organizationId: string;
    name: string;
    address?: string;
  },
) => {
  const [location] = await database
    .insert(locationsTable)
    .values({
      organization_id: input.organizationId,
      name: input.name,
      address: input.address,
    })
    .returning();

  return location;
};
