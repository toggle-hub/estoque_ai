import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db";
import { type AuthenticatedAppEnv, authMiddleware, getAuthenticatedUser } from "../lib/auth";
import { getDatabaseError, isUniqueConstraintViolation } from "../lib/database-errors";
import { logErrorResponse } from "../lib/http-log";
import { findActiveCategoryByIdAndOrganizationId } from "../repositories/category.repository";
import { createItem, listActiveItemsByLocation } from "../repositories/item.repository";
import { findActiveLocationById } from "../repositories/location.repository";
import { findActiveOrganizationMembership } from "../repositories/organization.repository";

const locations = new Hono<AuthenticatedAppEnv>().basePath("/locations");

const itemSchema = z.object({
  category_id: z.uuid().optional(),
  sku: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1).optional(),
  unit_price: z.number().nonnegative(),
  reorder_point: z.number().int().nonnegative().optional(),
  quantity: z.number().int().nonnegative().optional(),
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

  return c.json({ location });
});

/**
 * Lists items for one location when the current user belongs to its organization.
 */
locations.get("/:locationId/items", async (c) => {
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

  const locationItems = await listActiveItemsByLocation(db, {
    locationId,
    organizationId: location.organization_id,
  });

  return c.json({
    items: locationItems.map(({ item, category, quantity }) => ({
      ...item,
      category,
      quantity,
    })),
  });
});

/**
 * Creates an item for the location organization when the current user can manage it.
 */
locations.post("/:locationId/items", async (c) => {
  const user = getAuthenticatedUser(c);
  const locationId = c.req.param("locationId");
  const payload = await c.req.json().catch(() => null);
  const parsed = itemSchema.safeParse(payload);

  if (!parsed.success) {
    logErrorResponse(c, "Invalid request body");
    return c.json({ error: "Invalid request body", issues: z.treeifyError(parsed.error) }, 400);
  }

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

  if (membership.role === "viewer") {
    logErrorResponse(c, "Insufficient permissions");
    return c.json({ error: "Insufficient permissions" }, 403);
  }

  let category: Awaited<ReturnType<typeof findActiveCategoryByIdAndOrganizationId>> | null = null;
  if (parsed.data.category_id) {
    category = await findActiveCategoryByIdAndOrganizationId(
      db,
      parsed.data.category_id,
      location.organization_id,
    );

    if (!category) {
      logErrorResponse(c, "Invalid category_id");
      return c.json({ error: "Invalid category_id" }, 400);
    }
  }

  try {
    const item = await createItem(db, {
      organizationId: location.organization_id,
      locationId,
      categoryId: parsed.data.category_id,
      sku: parsed.data.sku,
      name: parsed.data.name,
      description: parsed.data.description,
      unitPrice: parsed.data.unit_price.toFixed(2),
      reorderPoint: parsed.data.reorder_point,
      quantity: parsed.data.quantity,
    });

    return c.json(
      {
        item: {
          ...item,
          category,
          quantity: parsed.data.quantity ?? 0,
        },
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
            locationId,
            sku: parsed.data.sku,
            userId: user.id,
          },
        },
        "Item create failed due to duplicate SKU",
      );
      logErrorResponse(c, "Item SKU already in use");
      return c.json({ error: "SKU already in use" }, 409);
    }

    throw error;
  }
});

export { locations };
