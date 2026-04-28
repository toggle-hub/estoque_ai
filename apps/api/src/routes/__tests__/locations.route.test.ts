import { resolve } from "node:path";
import { createAdaptorServer } from "@hono/node-server";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import request from "supertest";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { categoriesTable, itemsTable, locationsTable, stockLevelsTable } from "../../db/schema";

config({ path: resolve(process.cwd(), ".env.test") });

const postgresUser = process.env.POSTGRES_USER;
const postgresPassword = process.env.POSTGRES_PASSWORD;
const postgresDatabase = process.env.POSTGRES_DB;
const jwtSecret = process.env.JWT_SECRET;
const bcryptSalt = process.env.BCRYPT_SALT;
const authCookieName = process.env.AUTH_COOKIE_NAME;
const authCookieTtlSeconds = Number(process.env.AUTH_COOKIE_TTL_SECONDS);
const containerStartupTimeout = Number(process.env.CONTAINER_STARTUP_TIMEOUT_MS);
const testTimeout = Number(process.env.TEST_TIMEOUT_MS);

if (
  !postgresUser ||
  !postgresPassword ||
  !postgresDatabase ||
  !jwtSecret ||
  !bcryptSalt ||
  !authCookieName ||
  Number.isNaN(authCookieTtlSeconds) ||
  Number.isNaN(containerStartupTimeout) ||
  Number.isNaN(testTimeout)
) {
  throw new Error("Missing required test environment variables");
}

let postgresContainer: StartedTestContainer | undefined;
let cleanupPool: Pool | undefined;
let appServer: ReturnType<typeof createAdaptorServer> | undefined;
let appDbPool: Pool | undefined;
let appDb: Awaited<typeof import("../../db")>["db"] | undefined;

const getDatabaseUrl = () => {
  if (!postgresContainer) {
    throw new Error("Postgres container has not started");
  }

  const host = postgresContainer.getHost();
  const port = postgresContainer.getMappedPort(5432);

  return `postgresql://${postgresUser}:${postgresPassword}@${host}:${port}/${postgresDatabase}`;
};

const getAppServer = () => {
  if (!appServer) {
    throw new Error("App server has not started");
  }

  return appServer;
};

const getDatabase = () => {
  if (!appDb) {
    throw new Error("App database has not started");
  }

  return appDb;
};

const getSetCookieHeaders = (response: request.Response) => {
  const setCookieHeader = response.headers["set-cookie"];

  if (!setCookieHeader) {
    throw new Error("Expected set-cookie header");
  }

  return Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
};

const getAuthCookie = (response: request.Response) => {
  const authCookie = getSetCookieHeaders(response).find((cookie) =>
    cookie.startsWith(`${authCookieName}=`),
  );

  if (!authCookie) {
    throw new Error("Expected auth cookie to be set");
  }

  return authCookie.split(";")[0];
};

const registerUser = async (email: string, name: string) => {
  const response = await request(getAppServer()).post("/api/auth/register").send({
    email,
    name,
    password: "password123",
  });

  expect(response.status).toBe(201);

  return response;
};

beforeAll(async () => {
  postgresContainer = await new GenericContainer("postgres:16-alpine")
    .withEnvironment({
      POSTGRES_DB: postgresDatabase,
      POSTGRES_PASSWORD: postgresPassword,
      POSTGRES_USER: postgresUser,
    })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage("database system is ready to accept connections", 2))
    .withStartupTimeout(containerStartupTimeout)
    .start();

  const databaseUrl = getDatabaseUrl();
  process.env.DATABASE_URL = databaseUrl;
  process.env.JWT_SECRET = jwtSecret;
  process.env.BCRYPT_SALT = bcryptSalt;
  process.env.AUTH_COOKIE_NAME = authCookieName;
  process.env.AUTH_COOKIE_TTL_SECONDS = String(authCookieTtlSeconds);
  process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? "silent";

  cleanupPool = new Pool({ connectionString: databaseUrl });
  await migrate(drizzle(cleanupPool), { migrationsFolder: "drizzle" });

  const [{ app }, dbModule] = await Promise.all([import("../../index"), import("../../db")]);
  appDb = dbModule.db;
  appDbPool = dbModule.pool;
  appServer = createAdaptorServer({ fetch: app.fetch });
}, containerStartupTimeout);

beforeEach(async () => {
  await cleanupPool?.query(
    "TRUNCATE TABLE stock_levels, items, categories, locations, user_organizations, organizations, users RESTART IDENTITY CASCADE",
  );
}, testTimeout);

afterAll(async () => {
  if (appServer?.listening) {
    await new Promise<void>((resolve, reject) => {
      appServer?.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
  await appDbPool?.end();
  await cleanupPool?.end();
  await postgresContainer?.stop();
}, containerStartupTimeout);

describe("location routes", () => {
  it(
    "creates an item for a location when the user can manage the organization",
    async () => {
      const adaResponse = await registerUser("ada@example.com", "Ada Lovelace");

      const createResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(adaResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const organizationId = createResponse.body.organization.id;

      const [[location], [category]] = await Promise.all([
        getDatabase()
          .insert(locationsTable)
          .values({
            organization_id: organizationId,
            name: "Main Warehouse",
          })
          .returning(),
        getDatabase()
          .insert(categoriesTable)
          .values({
            organization_id: organizationId,
            name: "Components",
          })
          .returning(),
      ]);

      const response = await request(getAppServer())
        .post(`/api/locations/${location.id}/items`)
        .set("Cookie", getAuthCookie(adaResponse))
        .send({
          category_id: category.id,
          sku: "COMP-001",
          name: "Industrial Sensor",
          description: "Temperature sensor",
          unit_price: 199.9,
          reorder_point: 5,
          quantity: 12,
        })
        .expect(201);

      expect(response.body.item).toMatchObject({
        id: expect.any(String),
        organization_id: organizationId,
        category_id: category.id,
        sku: "COMP-001",
        name: "Industrial Sensor",
        description: "Temperature sensor",
        unit_price: "199.90",
        reorder_point: 5,
        quantity: 12,
        is_active: true,
        category: expect.objectContaining({
          id: category.id,
          organization_id: organizationId,
          name: "Components",
        }),
      });

      const createdItems = await getDatabase().select().from(itemsTable);
      expect(createdItems).toHaveLength(1);
      expect(createdItems[0]).toMatchObject({
        organization_id: organizationId,
        category_id: category.id,
        sku: "COMP-001",
      });

      const createdStockLevels = await getDatabase().select().from(stockLevelsTable);
      expect(createdStockLevels).toHaveLength(1);
      expect(createdStockLevels[0]).toMatchObject({
        organization_id: organizationId,
        location_id: location.id,
        item_id: response.body.item.id,
        quantity: 12,
      });
    },
    testTimeout,
  );

  it(
    "lists location items with categories for organization members",
    async () => {
      const adaResponse = await registerUser("ada@example.com", "Ada Lovelace");
      const graceResponse = await registerUser("grace@example.com", "Grace Hopper");

      const createResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(adaResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const organizationId = createResponse.body.organization.id;

      const [[location], [otherLocation], [category]] = await Promise.all([
        getDatabase()
          .insert(locationsTable)
          .values({
            organization_id: organizationId,
            name: "Main Warehouse",
          })
          .returning(),
        getDatabase()
          .insert(locationsTable)
          .values({
            organization_id: organizationId,
            name: "Secondary Store",
          })
          .returning(),
        getDatabase()
          .insert(categoriesTable)
          .values({
            organization_id: organizationId,
            name: "Components",
          })
          .returning(),
      ]);

      await cleanupPool?.query(
        `
          INSERT INTO user_organizations (user_id, organization_id, role)
          VALUES ($1, $2, $3)
        `,
        [graceResponse.body.user.id, organizationId, "viewer"],
      );

      const createItemResponse = await request(getAppServer())
        .post(`/api/locations/${location.id}/items`)
        .set("Cookie", getAuthCookie(adaResponse))
        .send({
          category_id: category.id,
          sku: "COMP-001",
          name: "Industrial Sensor",
          unit_price: 199.9,
          reorder_point: 5,
        })
        .expect(201);

      await request(getAppServer())
        .post(`/api/locations/${otherLocation.id}/items`)
        .set("Cookie", getAuthCookie(adaResponse))
        .send({
          category_id: category.id,
          sku: "COMP-002",
          name: "Pressure Sensor",
          unit_price: 149.9,
        })
        .expect(201);

      const response = await request(getAppServer())
        .get(`/api/locations/${location.id}/items`)
        .set("Cookie", getAuthCookie(graceResponse))
        .expect(200);

      expect(response.body.items).toEqual([
        expect.objectContaining({
          id: createItemResponse.body.item.id,
          organization_id: organizationId,
          category_id: category.id,
          sku: "COMP-001",
          name: "Industrial Sensor",
          unit_price: "199.90",
          reorder_point: 5,
          quantity: 0,
          category: expect.objectContaining({
            id: category.id,
            organization_id: organizationId,
            name: "Components",
          }),
        }),
      ]);
    },
    testTimeout,
  );

  it(
    "gets one location item with its category for organization members",
    async () => {
      const adaResponse = await registerUser("ada@example.com", "Ada Lovelace");
      const graceResponse = await registerUser("grace@example.com", "Grace Hopper");

      const createResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(adaResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const organizationId = createResponse.body.organization.id;

      const [[location], [category]] = await Promise.all([
        getDatabase()
          .insert(locationsTable)
          .values({
            organization_id: organizationId,
            name: "Main Warehouse",
          })
          .returning(),
        getDatabase()
          .insert(categoriesTable)
          .values({
            organization_id: organizationId,
            name: "Components",
          })
          .returning(),
      ]);

      await cleanupPool?.query(
        `
          INSERT INTO user_organizations (user_id, organization_id, role)
          VALUES ($1, $2, $3)
        `,
        [graceResponse.body.user.id, organizationId, "viewer"],
      );

      const createItemResponse = await request(getAppServer())
        .post(`/api/locations/${location.id}/items`)
        .set("Cookie", getAuthCookie(adaResponse))
        .send({
          category_id: category.id,
          sku: "COMP-001",
          name: "Industrial Sensor",
          unit_price: 199.9,
          quantity: 7,
        })
        .expect(201);

      const response = await request(getAppServer())
        .get(`/api/locations/${location.id}/items/${createItemResponse.body.item.id}`)
        .set("Cookie", getAuthCookie(graceResponse))
        .expect(200);

      expect(response.body.item).toMatchObject({
        id: createItemResponse.body.item.id,
        organization_id: organizationId,
        category_id: category.id,
        sku: "COMP-001",
        name: "Industrial Sensor",
        unit_price: "199.90",
        quantity: 7,
        category: expect.objectContaining({
          id: category.id,
          organization_id: organizationId,
          name: "Components",
        }),
      });
    },
    testTimeout,
  );

  it(
    "does not get a location item when the user does not belong to the organization",
    async () => {
      const adaResponse = await registerUser("ada@example.com", "Ada Lovelace");
      const graceResponse = await registerUser("grace@example.com", "Grace Hopper");

      const createResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(adaResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const [location] = await getDatabase()
        .insert(locationsTable)
        .values({
          organization_id: createResponse.body.organization.id,
          name: "Main Warehouse",
        })
        .returning();

      const createItemResponse = await request(getAppServer())
        .post(`/api/locations/${location.id}/items`)
        .set("Cookie", getAuthCookie(adaResponse))
        .send({
          sku: "COMP-001",
          name: "Industrial Sensor",
          unit_price: 199.9,
        })
        .expect(201);

      const response = await request(getAppServer())
        .get(`/api/locations/${location.id}/items/${createItemResponse.body.item.id}`)
        .set("Cookie", getAuthCookie(graceResponse))
        .expect(404);

      expect(response.body).toEqual({
        error: "Location not found",
      });
    },
    testTimeout,
  );

  it(
    "does not get an item from another location",
    async () => {
      const adaResponse = await registerUser("ada@example.com", "Ada Lovelace");

      const createResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(adaResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const organizationId = createResponse.body.organization.id;

      const [location, otherLocation] = await getDatabase()
        .insert(locationsTable)
        .values([
          {
            organization_id: organizationId,
            name: "Main Warehouse",
          },
          {
            organization_id: organizationId,
            name: "Secondary Store",
          },
        ])
        .returning();

      const createItemResponse = await request(getAppServer())
        .post(`/api/locations/${otherLocation.id}/items`)
        .set("Cookie", getAuthCookie(adaResponse))
        .send({
          sku: "COMP-001",
          name: "Industrial Sensor",
          unit_price: 199.9,
        })
        .expect(201);

      const response = await request(getAppServer())
        .get(`/api/locations/${location.id}/items/${createItemResponse.body.item.id}`)
        .set("Cookie", getAuthCookie(adaResponse))
        .expect(404);

      expect(response.body).toEqual({
        error: "Item not found",
      });
    },
    testTimeout,
  );

  it(
    "rejects location item listing when the user does not belong to the organization",
    async () => {
      const adaResponse = await registerUser("ada@example.com", "Ada Lovelace");
      const graceResponse = await registerUser("grace@example.com", "Grace Hopper");

      const createResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(adaResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const [location] = await getDatabase()
        .insert(locationsTable)
        .values({
          organization_id: createResponse.body.organization.id,
          name: "Main Warehouse",
        })
        .returning();

      const response = await request(getAppServer())
        .get(`/api/locations/${location.id}/items`)
        .set("Cookie", getAuthCookie(graceResponse))
        .expect(404);

      expect(response.body).toEqual({
        error: "Location not found",
      });
    },
    testTimeout,
  );

  it(
    "rejects location item listing without authentication",
    async () => {
      const response = await request(getAppServer())
        .get("/api/locations/test-location/items")
        .expect(401);

      expect(response.body).toEqual({
        error: "Missing authentication token",
      });
    },
    testTimeout,
  );

  it(
    "rejects item creation when the user is a viewer",
    async () => {
      const adaResponse = await registerUser("ada@example.com", "Ada Lovelace");
      const graceResponse = await registerUser("grace@example.com", "Grace Hopper");

      const createResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(adaResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const organizationId = createResponse.body.organization.id;

      const [location] = await getDatabase()
        .insert(locationsTable)
        .values({
          organization_id: organizationId,
          name: "Main Warehouse",
        })
        .returning();

      await cleanupPool?.query(
        `
          INSERT INTO user_organizations (user_id, organization_id, role)
          VALUES ($1, $2, $3)
        `,
        [graceResponse.body.user.id, organizationId, "viewer"],
      );

      const response = await request(getAppServer())
        .post(`/api/locations/${location.id}/items`)
        .set("Cookie", getAuthCookie(graceResponse))
        .send({
          sku: "COMP-001",
          name: "Industrial Sensor",
          unit_price: 199.9,
        })
        .expect(403);

      expect(response.body).toEqual({
        error: "Insufficient permissions",
      });
    },
    testTimeout,
  );

  it(
    "rejects item creation when the category is not in the location organization",
    async () => {
      const adaResponse = await registerUser("ada@example.com", "Ada Lovelace");

      const firstOrganizationResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(adaResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const secondOrganizationResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(adaResponse))
        .send({ name: "Grace Retail" })
        .expect(201);

      const [location] = await getDatabase()
        .insert(locationsTable)
        .values({
          organization_id: firstOrganizationResponse.body.organization.id,
          name: "Main Warehouse",
        })
        .returning();

      const [category] = await getDatabase()
        .insert(categoriesTable)
        .values({
          organization_id: secondOrganizationResponse.body.organization.id,
          name: "Other Organization Category",
        })
        .returning();

      const response = await request(getAppServer())
        .post(`/api/locations/${location.id}/items`)
        .set("Cookie", getAuthCookie(adaResponse))
        .send({
          category_id: category.id,
          sku: "COMP-001",
          name: "Industrial Sensor",
          unit_price: 199.9,
        })
        .expect(400);

      expect(response.body).toEqual({
        error: "Invalid category_id",
      });
    },
    testTimeout,
  );

  it(
    "rejects item creation with an invalid payload",
    async () => {
      const adaResponse = await registerUser("ada@example.com", "Ada Lovelace");

      const createResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(adaResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const [location] = await getDatabase()
        .insert(locationsTable)
        .values({
          organization_id: createResponse.body.organization.id,
          name: "Main Warehouse",
        })
        .returning();

      const response = await request(getAppServer())
        .post(`/api/locations/${location.id}/items`)
        .set("Cookie", getAuthCookie(adaResponse))
        .send({
          sku: "",
          name: "Industrial Sensor",
          unit_price: -1,
        })
        .expect(400);

      expect(response.body.error).toBe("Invalid request body");
    },
    testTimeout,
  );

  it(
    "rejects item creation without authentication",
    async () => {
      const response = await request(getAppServer())
        .post("/api/locations/test-location/items")
        .send({
          sku: "COMP-001",
          name: "Industrial Sensor",
          unit_price: 199.9,
        })
        .expect(401);

      expect(response.body).toEqual({
        error: "Missing authentication token",
      });
    },
    testTimeout,
  );

  it(
    "returns a location only when the current user belongs to its organization",
    async () => {
      const adaResponse = await registerUser("ada@example.com", "Ada Lovelace");
      const graceResponse = await registerUser("grace@example.com", "Grace Hopper");

      const createResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(adaResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const organizationId = createResponse.body.organization.id;

      const [location] = await getDatabase()
        .insert(locationsTable)
        .values({
          organization_id: organizationId,
          name: "Main Warehouse",
          address: "Rua A, 100",
          is_active: true,
        })
        .returning();

      const ownLocationResponse = await request(getAppServer())
        .get(`/api/locations/${location.id}`)
        .set("Cookie", getAuthCookie(adaResponse))
        .expect(200);

      expect(ownLocationResponse.body.location).toMatchObject({
        id: location.id,
        name: "Main Warehouse",
        organization_id: organizationId,
        address: "Rua A, 100",
        is_active: true,
      });

      const missingMembershipResponse = await request(getAppServer())
        .get(`/api/locations/${location.id}`)
        .set("Cookie", getAuthCookie(graceResponse))
        .expect(404);

      expect(missingMembershipResponse.body).toEqual({
        error: "Location not found",
      });
    },
    testTimeout,
  );

  it(
    "does not return deleted locations",
    async () => {
      const adaResponse = await registerUser("ada@example.com", "Ada Lovelace");

      const createResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(adaResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const [location] = await getDatabase()
        .insert(locationsTable)
        .values({
          organization_id: createResponse.body.organization.id,
          name: "Archived Location",
          deleted_at: new Date(),
        })
        .returning();

      const response = await request(getAppServer())
        .get(`/api/locations/${location.id}`)
        .set("Cookie", getAuthCookie(adaResponse))
        .expect(404);

      expect(response.body).toEqual({
        error: "Location not found",
      });
    },
    testTimeout,
  );

  it(
    "rejects location fetching without authentication",
    async () => {
      const response = await request(getAppServer())
        .get("/api/locations/test-location")
        .expect(401);

      expect(response.body).toEqual({
        error: "Missing authentication token",
      });
    },
    testTimeout,
  );

  it(
    "lists active organization locations for members only",
    async () => {
      const adaResponse = await registerUser("ada@example.com", "Ada Lovelace");
      const graceResponse = await registerUser("grace@example.com", "Grace Hopper");

      const createResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(adaResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const organizationId = createResponse.body.organization.id;

      await getDatabase()
        .insert(locationsTable)
        .values([
          {
            organization_id: organizationId,
            name: "Main Warehouse",
            address: "Rua A, 100",
            is_active: true,
          },
          {
            organization_id: organizationId,
            name: "Secondary Store",
            address: "Rua B, 200",
            is_active: false,
          },
          {
            organization_id: organizationId,
            name: "Archived Location",
            address: "Rua C, 300",
            deleted_at: new Date(),
          },
        ]);

      const ownLocationsResponse = await request(getAppServer())
        .get(`/api/organizations/${organizationId}/locations`)
        .set("Cookie", getAuthCookie(adaResponse))
        .expect(200);

      expect(ownLocationsResponse.body.locations).toHaveLength(2);
      expect(ownLocationsResponse.body.locations).toEqual([
        expect.objectContaining({
          name: "Main Warehouse",
          organization_id: organizationId,
          address: "Rua A, 100",
          is_active: true,
        }),
        expect.objectContaining({
          name: "Secondary Store",
          organization_id: organizationId,
          address: "Rua B, 200",
          is_active: false,
        }),
      ]);

      const missingMembershipResponse = await request(getAppServer())
        .get(`/api/organizations/${organizationId}/locations`)
        .set("Cookie", getAuthCookie(graceResponse))
        .expect(404);

      expect(missingMembershipResponse.body).toEqual({
        error: "Organization not found",
      });
    },
    testTimeout,
  );

  it(
    "rejects location listing without authentication",
    async () => {
      const response = await request(getAppServer())
        .get("/api/organizations/test-org/locations")
        .expect(401);

      expect(response.body).toEqual({
        error: "Missing authentication token",
      });
    },
    testTimeout,
  );
});
