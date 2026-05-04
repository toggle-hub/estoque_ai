import { type Context, Hono } from "hono";
import { z } from "zod";
import { db } from "../db";
import { type AuthenticatedAppEnv, authMiddleware, getAuthenticatedUser } from "../lib/auth";
import { getDatabaseError, isUniqueConstraintViolation } from "../lib/database-errors";
import { logErrorResponse } from "../lib/http-log";
import { findActiveCategoryByIdAndOrganizationId } from "../repositories/category.repository";
import {
  createItem,
  findActiveItemByLocation,
  listActiveItemsByLocation,
  softDeleteItemByLocation,
} from "../repositories/item.repository";
import { findActiveLocationById } from "../repositories/location.repository";
import { findActiveOrganizationMembership } from "../repositories/organization.repository";
import { itemSchema } from "./schemas/item.schema";
import { paginationQuerySchema } from "./schemas/pagination.schema";
import { uuidSchema } from "./schemas/uuid.schema";

const locations = new Hono<AuthenticatedAppEnv>().basePath("/locations");

locations.use("*", authMiddleware);

/**
 * Loads the active location and current user's membership for location-scoped routes.
 *
 * @param c Hono request context.
 * @param options Permission requirements for the route.
 * @returns Location context or an HTTP response when access should stop.
 */
const getLocationContext = async (
  c: Context<AuthenticatedAppEnv>,
  options: { requireWrite?: boolean } = {},
) => {
  const user = getAuthenticatedUser(c);
  const locationId = c.req.param("locationId");

  if (!uuidSchema.safeParse(locationId).success) {
    logErrorResponse(c, "Invalid locationId");
    return { response: c.json({ error: "Invalid locationId" }, 400) };
  }

  const location = await findActiveLocationById(db, locationId);
  const organizationId = location?.organization_id;

  if (!location || !organizationId) {
    logErrorResponse(c, "Location not found");
    return { response: c.json({ error: "Location not found" }, 404) };
  }

  const membership = await findActiveOrganizationMembership(db, user.id, organizationId);

  if (!membership) {
    logErrorResponse(c, "User is not a member of the location organization");
    return { response: c.json({ error: "Location not found" }, 404) };
  }

  if (options.requireWrite && membership.role === "viewer") {
    logErrorResponse(c, "Insufficient permissions");
    return { response: c.json({ error: "Insufficient permissions" }, 403) };
  }

  return { location, locationId, membership, organizationId, response: null, user };
};

/**
 * Returns one location when the current user belongs to its parent organization.
 */
locations.get("/:locationId", async (c) => {
  const locationContext = await getLocationContext(c);

  if (locationContext.response !== null) {
    return locationContext.response;
  }

  return c.json({ location: locationContext.location });
});

/**
 * Lists items for one location when the current user belongs to its organization.
 */
locations.get("/:locationId/items", async (c) => {
  const locationContext = await getLocationContext(c);

  if (locationContext.response !== null) {
    return locationContext.response;
  }

  const parsedQuery = paginationQuerySchema.safeParse({
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });

  if (!parsedQuery.success) {
    logErrorResponse(c, "Invalid query parameters");
    return c.json(
      { error: "Invalid query parameters", issues: z.treeifyError(parsedQuery.error) },
      400,
    );
  }

  const itemPage = await listActiveItemsByLocation(db, {
    locationId: locationContext.locationId,
    organizationId: locationContext.organizationId,
    limit: parsedQuery.data.limit,
    offset: parsedQuery.data.offset,
  });
  const hasMore = itemPage.length > parsedQuery.data.limit;
  const locationItems = hasMore ? itemPage.slice(0, parsedQuery.data.limit) : itemPage;

  return c.json({
    items: locationItems.map(({ item, category, quantity }) => ({
      ...item,
      category,
      quantity,
    })),
    pagination: {
      limit: parsedQuery.data.limit,
      offset: parsedQuery.data.offset,
      nextOffset: hasMore ? parsedQuery.data.offset + parsedQuery.data.limit : null,
      hasMore,
    },
  });
});

/**
 * Returns one item from one location when the current user belongs to its organization.
 */
locations.get("/:locationId/items/:itemId", async (c) => {
  const locationContext = await getLocationContext(c);
  const itemId = c.req.param("itemId");

  if (!uuidSchema.safeParse(itemId).success) {
    logErrorResponse(c, "Invalid itemId");
    return c.json({ error: "Invalid itemId" }, 400);
  }

  if (locationContext.response !== null) {
    return locationContext.response;
  }

  const locationItem = await findActiveItemByLocation(db, {
    itemId,
    locationId: locationContext.locationId,
    organizationId: locationContext.organizationId,
  });

  if (!locationItem) {
    logErrorResponse(c, "Item not found");
    return c.json({ error: "Item not found" }, 404);
  }

  return c.json({
    item: {
      ...locationItem.item,
      category: locationItem.category,
      quantity: locationItem.quantity,
    },
  });
});

/**
 * Soft deletes one item from a location when the current user can manage it.
 */
locations.delete("/:locationId/items/:itemId", async (c) => {
  const locationContext = await getLocationContext(c, { requireWrite: true });
  const itemId = c.req.param("itemId");

  if (!uuidSchema.safeParse(itemId).success) {
    logErrorResponse(c, "Invalid itemId");
    return c.json({ error: "Invalid itemId" }, 400);
  }

  if (locationContext.response !== null) {
    return locationContext.response;
  }

  const item = await softDeleteItemByLocation(db, {
    itemId,
    locationId: locationContext.locationId,
    organizationId: locationContext.organizationId,
  });

  if (!item) {
    logErrorResponse(c, "Item not found");
    return c.json({ error: "Item not found" }, 404);
  }

  return c.body(null, 204);
});

/**
 * Creates an item for the location organization when the current user can manage it.
 */
locations.post("/:locationId/items", async (c) => {
  const payload = await c.req.json().catch(() => null);
  const parsed = itemSchema.safeParse(payload);

  if (!parsed.success) {
    logErrorResponse(c, "Invalid request body");
    return c.json({ error: "Invalid request body", issues: z.treeifyError(parsed.error) }, 400);
  }

  const locationContext = await getLocationContext(c, { requireWrite: true });

  if (locationContext.response !== null) {
    return locationContext.response;
  }

  let category: Awaited<ReturnType<typeof findActiveCategoryByIdAndOrganizationId>> | null = null;
  if (parsed.data.category_id) {
    if (!uuidSchema.safeParse(parsed.data.category_id).success) {
      logErrorResponse(c, "Invalid category_id");
      return c.json({ error: "Invalid category_id" }, 400);
    }

    category = await findActiveCategoryByIdAndOrganizationId(
      db,
      parsed.data.category_id,
      locationContext.organizationId,
    );

    if (!category) {
      logErrorResponse(c, "Invalid category_id");
      return c.json({ error: "Invalid category_id" }, 400);
    }
  }

  try {
    const item = await createItem(db, {
      organizationId: locationContext.organizationId,
      locationId: locationContext.locationId,
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
            locationId: locationContext.locationId,
            sku: parsed.data.sku,
            userId: locationContext.user.id,
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
