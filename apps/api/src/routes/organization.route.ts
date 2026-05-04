import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db";
import { type AuthenticatedAppEnv, authMiddleware, getAuthenticatedUser } from "../lib/auth";
import { getDatabaseError, isUniqueConstraintViolation } from "../lib/database-errors";
import { logErrorResponse } from "../lib/http-log";
import { createCategory } from "../repositories/category.repository";
import { listActiveLocationsByOrganizationId } from "../repositories/location.repository";
import {
  createLocation,
  createOrganizationWithAdminMembership,
  findActiveOrganizationMembership,
  listActiveOrganizationMembershipsByUserId,
} from "../repositories/organization.repository";
import { serializeOrganization } from "../serializers/organization.serializer";
import { sanitizeUser } from "../serializers/user.serializer";

const organizations = new Hono<AuthenticatedAppEnv>().basePath("/organizations");

const organizationSchema = z.object({
  name: z.string().trim().min(1),
  cnpj: z.string().trim().min(1).max(18).optional(),
  email: z.email().optional(),
  phone: z.string().trim().min(1).max(20).optional(),
  plan_type: z.string().trim().min(1).max(50).optional(),
});

const locationSchema = z.object({
  name: z.string().trim().min(1),
  address: z.string().trim().min(1).optional(),
});

const categorySchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1).optional(),
});

organizations.use("*", authMiddleware);

/**
 * Lists the organizations the current user belongs to.
 */
organizations.get("/", async (c) => {
  const user = getAuthenticatedUser(c);

  const memberships = await listActiveOrganizationMembershipsByUserId(db, user.id);

  return c.json({
    organizations: memberships.map(({ organization, role }) =>
      serializeOrganization(organization, role),
    ),
  });
});

/**
 * Creates a new organization and grants the creator admin membership.
 */
organizations.post("/", async (c) => {
  const user = getAuthenticatedUser(c);
  const payload = await c.req.json().catch(() => null);
  const parsed = organizationSchema.safeParse(payload);

  if (!parsed.success) {
    logErrorResponse(c, "Invalid request body");
    return c.json({ error: "Invalid request body", issues: z.treeifyError(parsed.error) }, 400);
  }

  try {
    const { organization, role } = await createOrganizationWithAdminMembership(db, {
      userId: user.id,
      name: parsed.data.name,
      cnpj: parsed.data.cnpj,
      email: parsed.data.email,
      phone: parsed.data.phone,
      plan_type: parsed.data.plan_type,
    });

    return c.json(
      {
        organization: serializeOrganization(organization, role),
        user: sanitizeUser(user),
      },
      201,
    );
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      const databaseError = getDatabaseError(error);
      const logger = c.get("logger");

      logger.error(
        {
          error: {
            code: databaseError?.code,
            constraint: databaseError?.constraint,
            cnpj: parsed.data.cnpj,
            userId: user.id,
          },
        },
        "Organization create failed due to duplicate CNPJ",
      );
      logErrorResponse(c, "Organization CNPJ already in use");
      return c.json({ error: "CNPJ already in use" }, 409);
    }

    throw error;
  }
});

/**
 * Returns one organization when the current user has an active membership in it.
 */
organizations.get("/:organizationId", async (c) => {
  const user = getAuthenticatedUser(c);

  const organizationId = c.req.param("organizationId");

  const membership = await findActiveOrganizationMembership(db, user.id, organizationId);

  if (!membership) {
    logErrorResponse(c, "Organization not found");
    return c.json({ error: "Organization not found" }, 404);
  }

  return c.json({
    organization: serializeOrganization(membership.organization, membership.role),
  });
});

/**
 * Lists all locations for one organization when the current user is a member.
 */
organizations.get("/:organizationId/locations", async (c) => {
  const user = getAuthenticatedUser(c);
  const organizationId = c.req.param("organizationId");

  const membership = await findActiveOrganizationMembership(db, user.id, organizationId);

  if (!membership) {
    logErrorResponse(c, "Organization not found");
    return c.json({ error: "Organization not found" }, 404);
  }

  const organizationLocations = await listActiveLocationsByOrganizationId(db, organizationId);

  return c.json({
    locations: organizationLocations,
  });
});

/**
 * Creates a location for one organization when the current user can manage it.
 */
organizations.post("/:organizationId/locations", async (c) => {
  const user = getAuthenticatedUser(c);
  const organizationId = c.req.param("organizationId");
  const payload = await c.req.json().catch(() => null);
  const parsed = locationSchema.safeParse(payload);

  if (!parsed.success) {
    logErrorResponse(c, "Invalid request body");
    return c.json({ error: "Invalid request body", issues: z.treeifyError(parsed.error) }, 400);
  }

  const membership = await findActiveOrganizationMembership(db, user.id, organizationId);

  if (!membership) {
    logErrorResponse(c, "Organization not found");
    return c.json({ error: "Organization not found" }, 404);
  }

  if (!["admin", "manager"].includes(membership.role)) {
    logErrorResponse(c, "Insufficient permissions");
    return c.json({ error: "Insufficient permissions" }, 403);
  }

  const location = await createLocation(db, {
    organizationId,
    name: parsed.data.name,
    address: parsed.data.address,
  });

  return c.json({ location }, 201);
});

/**
 * Creates a category for one organization when the current user can manage it.
 */
organizations.post("/:organizationId/categories", async (c) => {
  const user = getAuthenticatedUser(c);
  const organizationId = c.req.param("organizationId");
  const payload = await c.req.json().catch(() => null);
  const parsed = categorySchema.safeParse(payload);

  if (!parsed.success) {
    logErrorResponse(c, "Invalid request body");
    return c.json({ error: "Invalid request body", issues: z.treeifyError(parsed.error) }, 400);
  }

  const membership = await findActiveOrganizationMembership(db, user.id, organizationId);

  if (!membership) {
    logErrorResponse(c, "Organization not found");
    return c.json({ error: "Organization not found" }, 404);
  }

  if (!["admin", "manager"].includes(membership.role)) {
    logErrorResponse(c, "Insufficient permissions");
    return c.json({ error: "Insufficient permissions" }, 403);
  }

  const category = await createCategory(db, {
    organizationId,
    name: parsed.data.name,
    description: parsed.data.description,
  });

  return c.json({ category }, 201);
});

export { organizations };
