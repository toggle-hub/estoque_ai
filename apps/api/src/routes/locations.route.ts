import { Hono } from "hono";
import { db } from "../db";
import type { locationsTable } from "../db/schema";
import { type AuthenticatedAppEnv, authMiddleware, getAuthenticatedUser } from "../lib/auth";
import { logErrorResponse } from "../lib/http-log";
import { listActiveLocationsByOrganizationId } from "../repositories/location.repository";
import { findActiveOrganizationMembership } from "../repositories/organization.repository";

const locations = new Hono<AuthenticatedAppEnv>().basePath("/locations");

/**
 * Removes internal-only fields from a location record.
 *
 * @param location Persisted location record.
 * @returns Location payload safe to expose in API responses.
 */
const sanitizeLocation = (location: typeof locationsTable.$inferSelect) => ({
  id: location.id,
  organization_id: location.organization_id,
  name: location.name,
  address: location.address,
  is_active: location.is_active,
  created_at: location.created_at,
  updated_at: location.updated_at,
});

locations.use("*", authMiddleware);

/**
 * Lists all locations for one organization when the current user is a member.
 */
locations.get("/:orgId", async (c) => {
  const user = getAuthenticatedUser(c);
  const organizationId = c.req.param("orgId");

  const membership = await findActiveOrganizationMembership(db, user.id, organizationId);

  if (!membership) {
    logErrorResponse(c, "Organization not found");
    return c.json({ error: "Organization not found" }, 404);
  }

  const organizationLocations = await listActiveLocationsByOrganizationId(db, organizationId);

  return c.json({
    locations: organizationLocations.map(sanitizeLocation),
  });
});

export { locations };
