import { Hono } from "hono";
import { db } from "../db";
import type { locationsTable } from "../db/schema";
import { type AuthenticatedAppEnv, authMiddleware, getAuthenticatedUser } from "../lib/auth";
import { logErrorResponse } from "../lib/http-log";
import { findActiveLocationById } from "../repositories/location.repository";
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
 * Returns one location when the current user belongs to its parent organization.
 */
locations.get("/:locationId", async (c) => {
  const user = getAuthenticatedUser(c);
  const locationId = c.req.param("locationId");

  const location = await findActiveLocationById(db, locationId);

  if (!location?.organization_id) {
    logErrorResponse(c, "Location not found");
    return c.json({ error: "Location not found" }, 404);
  }

  const membership = await findActiveOrganizationMembership(db, user.id, location.organization_id);

  if (!membership) {
    logErrorResponse(c, "Location not found");
    return c.json({ error: "Location not found" }, 404);
  }

  return c.json({ location: sanitizeLocation(location) });
});

export { locations };
