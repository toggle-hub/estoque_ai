import { Hono } from "hono";
import type { Env as HonoPinoEnv } from "hono-pino";
import { z } from "zod";
import { db } from "../db";
import type { organizationsTable } from "../db/schema";
import { requireAuthenticatedUser, sanitizeUser } from "../lib/auth";
import { logErrorResponse } from "../lib/http-log";
import {
  createOrganizationWithAdminMembership,
  findActiveOrganizationMembership,
  listActiveOrganizationMembershipsByUserId,
} from "../repositories/organization.repository";

const organizations = new Hono<HonoPinoEnv>().basePath("/organizations");

const organizationSchema = z.object({
  name: z.string().trim().min(1),
  cnpj: z.string().trim().min(1).max(18).optional(),
  email: z.email().optional(),
  phone: z.string().trim().min(1).max(20).optional(),
  plan_type: z.string().trim().min(1).max(50).optional(),
});

/**
 * Removes internal-only fields and optionally adds the caller's membership role.
 *
 * @param organization Persisted organization record.
 * @param role Membership role associated with the current user.
 * @returns Organization payload safe to expose in API responses.
 */
const sanitizeOrganization = (
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

/**
 * Lists the organizations the current user belongs to.
 */
organizations.get("/", async (c) => {
  const authResult = await requireAuthenticatedUser(c);

  if ("response" in authResult) {
    return authResult.response;
  }

  const memberships = await listActiveOrganizationMembershipsByUserId(db, authResult.user.id);

  return c.json({
    organizations: memberships.map(({ organization, role }) =>
      sanitizeOrganization(organization, role),
    ),
  });
});

/**
 * Creates a new organization and grants the creator admin membership.
 */
organizations.post("/", async (c) => {
  const authResult = await requireAuthenticatedUser(c);

  if ("response" in authResult) {
    return authResult.response;
  }

  const payload = await c.req.json().catch(() => null);
  const parsed = organizationSchema.safeParse(payload);

  if (!parsed.success) {
    logErrorResponse(c, "Invalid request body");
    return c.json({ error: "Invalid request body", issues: z.treeifyError(parsed.error) }, 400);
  }

  const { organization, role } = await createOrganizationWithAdminMembership(db, {
    userId: authResult.user.id,
    name: parsed.data.name,
    cnpj: parsed.data.cnpj,
    email: parsed.data.email,
    phone: parsed.data.phone,
    plan_type: parsed.data.plan_type,
  });

  return c.json(
    {
      organization: sanitizeOrganization(organization, role),
      user: sanitizeUser(authResult.user),
    },
    201,
  );
});

/**
 * Returns one organization when the current user has an active membership in it.
 */
organizations.get("/:organizationId", async (c) => {
  const authResult = await requireAuthenticatedUser(c);

  if ("response" in authResult) {
    return authResult.response;
  }

  const organizationId = c.req.param("organizationId");

  const membership = await findActiveOrganizationMembership(db, authResult.user.id, organizationId);

  if (!membership) {
    logErrorResponse(c, "Organization not found");
    return c.json({ error: "Organization not found" }, 404);
  }

  return c.json({
    organization: sanitizeOrganization(membership.organization, membership.role),
  });
});

export { organizations };
