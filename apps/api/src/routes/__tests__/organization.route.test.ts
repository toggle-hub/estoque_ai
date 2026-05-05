import { resolve } from "node:path";
import { createAdaptorServer } from "@hono/node-server";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import request from "supertest";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

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
  appDbPool = dbModule.pool;
  appServer = createAdaptorServer({ fetch: app.fetch });
}, containerStartupTimeout);

beforeEach(async () => {
  await cleanupPool?.query(
    "TRUNCATE TABLE user_organizations, organizations, users RESTART IDENTITY CASCADE",
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

describe("organization routes", () => {
  it(
    "creates an organization and assigns the creator as admin",
    async () => {
      const registerResponse = await registerUser("ada@example.com", "Ada Lovelace");

      const response = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(registerResponse))
        .send({
          name: "Ada Industries",
          cnpj: "12.345.678/0001-90",
          email: "finance@ada.example.com",
          phone: "+55 11 99999-9999",
          plan_type: "pro",
        })
        .expect(201);

      expect(response.body.organization).toMatchObject({
        id: expect.any(String),
        name: "Ada Industries",
        cnpj: "12.345.678/0001-90",
        email: "finance@ada.example.com",
        phone: "+55 11 99999-9999",
        plan_type: "pro",
        role: "admin",
      });
      expect(response.body.user).toMatchObject({
        id: registerResponse.body.user.id,
        email: "ada@example.com",
      });
    },
    testTimeout,
  );

  it(
    "lists only organizations the current user belongs to",
    async () => {
      const adaResponse = await registerUser("ada@example.com", "Ada Lovelace");
      const graceResponse = await registerUser("grace@example.com", "Grace Hopper");

      const adaCookie = getAuthCookie(adaResponse);
      const graceCookie = getAuthCookie(graceResponse);

      await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", adaCookie)
        .send({ name: "Ada Industries" })
        .expect(201);

      await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", graceCookie)
        .send({ name: "Grace Systems" })
        .expect(201);

      const response = await request(getAppServer())
        .get("/api/organizations")
        .set("Cookie", adaCookie)
        .expect(200);

      expect(response.body.organizations).toHaveLength(1);
      expect(response.body.organizations[0]).toMatchObject({
        name: "Ada Industries",
        role: "admin",
      });
    },
    testTimeout,
  );

  it(
    "rejects organization creation when the cnpj is already in use",
    async () => {
      const adaResponse = await registerUser("ada@example.com", "Ada Lovelace");
      const graceResponse = await registerUser("grace@example.com", "Grace Hopper");
      const cnpj = "12.345.678/0001-90";

      await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(adaResponse))
        .send({
          name: "Ada Industries",
          cnpj,
        })
        .expect(201);

      const response = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(graceResponse))
        .send({
          name: "Grace Systems",
          cnpj,
        })
        .expect(409);

      expect(response.body).toEqual({
        error: "CNPJ already in use",
      });
    },
    testTimeout,
  );

  it(
    "returns an organization only when the current user belongs to it",
    async () => {
      const adaResponse = await registerUser("ada@example.com", "Ada Lovelace");
      const graceResponse = await registerUser("grace@example.com", "Grace Hopper");

      const createResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(adaResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const organizationId = createResponse.body.organization.id;

      const ownOrganizationResponse = await request(getAppServer())
        .get(`/api/organizations/${organizationId}`)
        .set("Cookie", getAuthCookie(adaResponse))
        .expect(200);

      expect(ownOrganizationResponse.body.organization).toMatchObject({
        id: organizationId,
        name: "Ada Industries",
        role: "admin",
      });

      const missingMembershipResponse = await request(getAppServer())
        .get(`/api/organizations/${organizationId}`)
        .set("Cookie", getAuthCookie(graceResponse))
        .expect(404);

      expect(missingMembershipResponse.body).toEqual({
        error: "Organization not found",
      });
    },
    testTimeout,
  );

  it(
    "rejects organization fetching with an invalid organization id",
    async () => {
      const registerResponse = await registerUser("ada@example.com", "Ada Lovelace");

      const response = await request(getAppServer())
        .get("/api/organizations/test-org")
        .set("Cookie", getAuthCookie(registerResponse))
        .expect(400);

      expect(response.body).toEqual({
        error: "Invalid organizationId",
      });
    },
    testTimeout,
  );

  it(
    "rejects organization routes without authentication",
    async () => {
      const listResponse = await request(getAppServer()).get("/api/organizations").expect(401);

      expect(listResponse.body).toEqual({
        error: "Missing authentication token",
      });

      const createResponse = await request(getAppServer())
        .post("/api/organizations")
        .send({ name: "No Auth Org" })
        .expect(401);

      expect(createResponse.body).toEqual({
        error: "Missing authentication token",
      });
    },
    testTimeout,
  );

  it(
    "creates a location for an organization when the user is an admin",
    async () => {
      const registerResponse = await registerUser("ada@example.com", "Ada Lovelace");

      const organizationResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(registerResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const organizationId = organizationResponse.body.organization.id;

      const response = await request(getAppServer())
        .post(`/api/organizations/${organizationId}/locations`)
        .set("Cookie", getAuthCookie(registerResponse))
        .send({
          name: "Main Warehouse",
          address: "Rua das Flores, 100",
        })
        .expect(201);

      expect(response.body.location).toMatchObject({
        id: expect.any(String),
        organization_id: organizationId,
        name: "Main Warehouse",
        address: "Rua das Flores, 100",
        is_active: true,
      });
    },
    testTimeout,
  );

  it(
    "rejects location creation with an invalid payload",
    async () => {
      const registerResponse = await registerUser("ada@example.com", "Ada Lovelace");

      const organizationResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(registerResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const organizationId = organizationResponse.body.organization.id;

      const response = await request(getAppServer())
        .post(`/api/organizations/${organizationId}/locations`)
        .set("Cookie", getAuthCookie(registerResponse))
        .send({
          name: "   ",
        })
        .expect(400);

      expect(response.body.error).toBe("Invalid request body");
    },
    testTimeout,
  );

  it(
    "rejects location creation when the current user does not belong to the organization",
    async () => {
      const adaResponse = await registerUser("ada@example.com", "Ada Lovelace");
      const graceResponse = await registerUser("grace@example.com", "Grace Hopper");

      const organizationResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(adaResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const organizationId = organizationResponse.body.organization.id;

      const response = await request(getAppServer())
        .post(`/api/organizations/${organizationId}/locations`)
        .set("Cookie", getAuthCookie(graceResponse))
        .send({ name: "Main Warehouse" })
        .expect(404);

      expect(response.body).toEqual({
        error: "Organization not found",
      });
    },
    testTimeout,
  );

  it(
    "rejects location creation when the current user is a viewer",
    async () => {
      const adaResponse = await registerUser("ada@example.com", "Ada Lovelace");
      const graceResponse = await registerUser("grace@example.com", "Grace Hopper");

      const organizationResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(adaResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const organizationId = organizationResponse.body.organization.id;

      await cleanupPool?.query(
        `
          INSERT INTO user_organizations (user_id, organization_id, role)
          VALUES ($1, $2, $3)
        `,
        [graceResponse.body.user.id, organizationId, "viewer"],
      );

      const response = await request(getAppServer())
        .post(`/api/organizations/${organizationId}/locations`)
        .set("Cookie", getAuthCookie(graceResponse))
        .send({ name: "Main Warehouse" })
        .expect(403);

      expect(response.body).toEqual({
        error: "Insufficient permissions",
      });
    },
    testTimeout,
  );

  it(
    "rejects location creation without authentication",
    async () => {
      const response = await request(getAppServer())
        .post("/api/organizations/test-org/locations")
        .send({ name: "No Auth Warehouse" })
        .expect(401);

      expect(response.body).toEqual({
        error: "Missing authentication token",
      });
    },
    testTimeout,
  );

  it(
    "rejects location listing with an invalid organization id",
    async () => {
      const registerResponse = await registerUser("ada@example.com", "Ada Lovelace");

      const response = await request(getAppServer())
        .get("/api/organizations/test-org/locations")
        .set("Cookie", getAuthCookie(registerResponse))
        .expect(400);

      expect(response.body).toEqual({
        error: "Invalid organizationId",
      });
    },
    testTimeout,
  );

  it(
    "creates a category for an organization when the user is an admin",
    async () => {
      const registerResponse = await registerUser("ada@example.com", "Ada Lovelace");

      const organizationResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(registerResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const organizationId = organizationResponse.body.organization.id;

      const response = await request(getAppServer())
        .post(`/api/organizations/${organizationId}/categories`)
        .set("Cookie", getAuthCookie(registerResponse))
        .send({
          name: "Raw Materials",
          description: "Inputs used in production",
        })
        .expect(201);

      expect(response.body.category).toMatchObject({
        id: expect.any(String),
        organization_id: organizationId,
        name: "Raw Materials",
        description: "Inputs used in production",
      });
    },
    testTimeout,
  );

  it(
    "lists categories for an organization when the user belongs to it",
    async () => {
      const registerResponse = await registerUser("ada@example.com", "Ada Lovelace");

      const firstOrganizationResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(registerResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const secondOrganizationResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(registerResponse))
        .send({ name: "Grace Retail" })
        .expect(201);

      const organizationId = firstOrganizationResponse.body.organization.id;

      await cleanupPool?.query(
        `
          INSERT INTO categories (organization_id, name, description, deleted_at)
          VALUES
            ($1, $2, $3, NULL),
            ($1, $4, $5, NULL),
            ($1, $6, $7, NOW()),
            ($8, $9, $10, NULL)
        `,
        [
          organizationId,
          "Beta Supplies",
          "Listed second",
          "Alpha Materials",
          "Listed first",
          "Deleted Category",
          "Filtered out",
          secondOrganizationResponse.body.organization.id,
          "Other Organization Category",
          "Filtered by organization",
        ],
      );

      const response = await request(getAppServer())
        .get(`/api/organizations/${organizationId}/categories`)
        .set("Cookie", getAuthCookie(registerResponse))
        .expect(200);

      expect(response.body.categories).toHaveLength(2);
      expect(response.body.categories).toEqual([
        expect.objectContaining({
          id: expect.any(String),
          organization_id: organizationId,
          name: "Alpha Materials",
          description: "Listed first",
        }),
        expect.objectContaining({
          id: expect.any(String),
          organization_id: organizationId,
          name: "Beta Supplies",
          description: "Listed second",
        }),
      ]);
      expect(response.body.pagination).toEqual({
        limit: 50,
        offset: 0,
        nextOffset: null,
        hasMore: false,
      });
    },
    testTimeout,
  );

  it(
    "paginates categories for infinite scrolling",
    async () => {
      const registerResponse = await registerUser("ada@example.com", "Ada Lovelace");

      const organizationResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(registerResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const organizationId = organizationResponse.body.organization.id;

      await cleanupPool?.query(
        `
          INSERT INTO categories (organization_id, name)
          VALUES
            ($1, $2),
            ($1, $3),
            ($1, $4)
        `,
        [organizationId, "Alpha Materials", "Beta Supplies", "Gamma Tools"],
      );

      const firstPageResponse = await request(getAppServer())
        .get(`/api/organizations/${organizationId}/categories?limit=2`)
        .set("Cookie", getAuthCookie(registerResponse))
        .expect(200);

      expect(firstPageResponse.body.categories).toEqual([
        expect.objectContaining({
          name: "Alpha Materials",
        }),
        expect.objectContaining({
          name: "Beta Supplies",
        }),
      ]);
      expect(firstPageResponse.body.pagination).toEqual({
        limit: 2,
        offset: 0,
        nextOffset: 2,
        hasMore: true,
      });

      const secondPageResponse = await request(getAppServer())
        .get(`/api/organizations/${organizationId}/categories?limit=2&offset=2`)
        .set("Cookie", getAuthCookie(registerResponse))
        .expect(200);

      expect(secondPageResponse.body.categories).toEqual([
        expect.objectContaining({
          name: "Gamma Tools",
        }),
      ]);
      expect(secondPageResponse.body.pagination).toEqual({
        limit: 2,
        offset: 2,
        nextOffset: null,
        hasMore: false,
      });
    },
    testTimeout,
  );

  it(
    "rejects category listing with invalid pagination parameters",
    async () => {
      const registerResponse = await registerUser("ada@example.com", "Ada Lovelace");

      const organizationResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(registerResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const response = await request(getAppServer())
        .get(`/api/organizations/${organizationResponse.body.organization.id}/categories?limit=0`)
        .set("Cookie", getAuthCookie(registerResponse))
        .expect(400);

      expect(response.body.error).toBe("Invalid query parameters");
    },
    testTimeout,
  );

  it(
    "returns an empty category list for an organization without categories",
    async () => {
      const registerResponse = await registerUser("ada@example.com", "Ada Lovelace");

      const organizationResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(registerResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const response = await request(getAppServer())
        .get(`/api/organizations/${organizationResponse.body.organization.id}/categories`)
        .set("Cookie", getAuthCookie(registerResponse))
        .expect(200);

      expect(response.body).toEqual({
        categories: [],
        pagination: {
          limit: 50,
          offset: 0,
          nextOffset: null,
          hasMore: false,
        },
      });
    },
    testTimeout,
  );

  it(
    "rejects category listing when the current user does not belong to the organization",
    async () => {
      const adaResponse = await registerUser("ada@example.com", "Ada Lovelace");
      const graceResponse = await registerUser("grace@example.com", "Grace Hopper");

      const organizationResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(adaResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const response = await request(getAppServer())
        .get(`/api/organizations/${organizationResponse.body.organization.id}/categories`)
        .set("Cookie", getAuthCookie(graceResponse))
        .expect(404);

      expect(response.body).toEqual({
        error: "Organization not found",
      });
    },
    testTimeout,
  );

  it(
    "rejects category listing with an invalid organization id",
    async () => {
      const registerResponse = await registerUser("ada@example.com", "Ada Lovelace");

      const response = await request(getAppServer())
        .get("/api/organizations/test-org/categories")
        .set("Cookie", getAuthCookie(registerResponse))
        .expect(400);

      expect(response.body).toEqual({
        error: "Invalid organizationId",
      });
    },
    testTimeout,
  );

  it(
    "rejects category listing without authentication",
    async () => {
      const response = await request(getAppServer())
        .get("/api/organizations/test-org/categories")
        .expect(401);

      expect(response.body).toEqual({
        error: "Missing authentication token",
      });
    },
    testTimeout,
  );

  it(
    "lists stock levels with item and location summaries for organization members",
    async () => {
      const registerResponse = await registerUser("ada@example.com", "Ada Lovelace");

      const organizationResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(registerResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const organizationId = organizationResponse.body.organization.id;
      const stockSeed = await cleanupPool?.query<{
        main_location_id: string;
        widget_id: string;
        gadget_id: string;
      }>(
        `
          WITH inserted_locations AS (
            INSERT INTO locations (organization_id, name, is_active, deleted_at)
            VALUES
              ($1, $2, TRUE, NULL),
              ($1, $3, FALSE, NOW())
            RETURNING id, name
          ),
          inserted_items AS (
            INSERT INTO items (
              organization_id,
              sku,
              name,
              unit_price,
              reorder_point,
              is_active,
              deleted_at
            )
            VALUES
              ($1, $4, $5, $6, $7, TRUE, NULL),
              ($1, $8, $9, $10, $11, TRUE, NULL),
              ($1, $12, $13, $14, $15, FALSE, NOW())
            RETURNING id, name
          )
          SELECT
            (SELECT id FROM inserted_locations WHERE name = $2) AS main_location_id,
            (SELECT id FROM inserted_items WHERE name = $5) AS widget_id,
            (SELECT id FROM inserted_items WHERE name = $9) AS gadget_id,
            (SELECT id FROM inserted_items WHERE name = $13) AS deleted_item_id,
            (SELECT id FROM inserted_locations WHERE name = $3) AS deleted_location_id
        `,
        [
          organizationId,
          "Main Warehouse",
          "Archived Warehouse",
          "W-1",
          "Widget",
          "10.00",
          5,
          "G-1",
          "Gadget",
          "20.00",
          2,
          "D-1",
          "Deleted Item",
          "30.00",
          1,
        ],
      );
      const seed = stockSeed?.rows[0];

      if (!seed) {
        throw new Error("Expected stock seed to be created");
      }

      await cleanupPool?.query(
        `
          INSERT INTO stock_levels (organization_id, location_id, item_id, quantity)
          VALUES
            ($1, $2, $3, $4),
            ($1, $2, $5, $6),
            ($1, $2, (SELECT id FROM items WHERE name = $7), $8),
            ($1, (SELECT id FROM locations WHERE name = $9), $3, $10)
        `,
        [
          organizationId,
          seed.main_location_id,
          seed.widget_id,
          4,
          seed.gadget_id,
          8,
          "Deleted Item",
          1,
          "Archived Warehouse",
          3,
        ],
      );

      const response = await request(getAppServer())
        .get(`/api/organizations/${organizationId}/stock`)
        .set("Cookie", getAuthCookie(registerResponse))
        .expect(200);

      expect(response.body.stock).toHaveLength(2);
      expect(response.body.stock).toEqual([
        expect.objectContaining({
          organization_id: organizationId,
          location_id: seed.main_location_id,
          item_id: seed.gadget_id,
          quantity: 8,
          item: expect.objectContaining({
            id: seed.gadget_id,
            sku: "G-1",
            name: "Gadget",
            unit_price: "20.00",
            reorder_point: 2,
          }),
          location: expect.objectContaining({
            id: seed.main_location_id,
            name: "Main Warehouse",
          }),
        }),
        expect.objectContaining({
          organization_id: organizationId,
          location_id: seed.main_location_id,
          item_id: seed.widget_id,
          quantity: 4,
          item: expect.objectContaining({
            id: seed.widget_id,
            sku: "W-1",
            name: "Widget",
            unit_price: "10.00",
            reorder_point: 5,
          }),
          location: expect.objectContaining({
            id: seed.main_location_id,
            name: "Main Warehouse",
          }),
        }),
      ]);
      expect(response.body.pagination).toEqual({
        limit: 50,
        offset: 0,
        nextOffset: null,
        hasMore: false,
      });
    },
    testTimeout,
  );

  it(
    "filters stock levels by location, item, and low-stock status",
    async () => {
      const registerResponse = await registerUser("ada@example.com", "Ada Lovelace");

      const organizationResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(registerResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const organizationId = organizationResponse.body.organization.id;
      const locationResponse = await cleanupPool?.query<{ id: string }>(
        `
          INSERT INTO locations (organization_id, name)
          VALUES ($1, $2), ($1, $3)
          RETURNING id
        `,
        [organizationId, "Main Warehouse", "Outlet Store"],
      );
      const itemResponse = await cleanupPool?.query<{ id: string }>(
        `
          INSERT INTO items (organization_id, sku, name, reorder_point)
          VALUES ($1, $2, $3, $4), ($1, $5, $6, $7)
          RETURNING id
        `,
        [organizationId, "W-1", "Widget", 5, "G-1", "Gadget", 2],
      );
      const mainLocationId = locationResponse?.rows[0]?.id;
      const outletLocationId = locationResponse?.rows[1]?.id;
      const widgetId = itemResponse?.rows[0]?.id;
      const gadgetId = itemResponse?.rows[1]?.id;

      if (!mainLocationId || !outletLocationId || !widgetId || !gadgetId) {
        throw new Error("Expected stock filter seed to be created");
      }

      await cleanupPool?.query(
        `
          INSERT INTO stock_levels (organization_id, location_id, item_id, quantity)
          VALUES
            ($1, $2, $3, $4),
            ($1, $2, $5, $6),
            ($1, $7, $3, $8)
        `,
        [organizationId, mainLocationId, widgetId, 4, gadgetId, 8, outletLocationId, 12],
      );

      const locationResponseBody = await request(getAppServer())
        .get(`/api/organizations/${organizationId}/stock?location_id=${mainLocationId}`)
        .set("Cookie", getAuthCookie(registerResponse))
        .expect(200);

      expect(locationResponseBody.body.stock).toHaveLength(2);
      expect(locationResponseBody.body.stock).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ location_id: mainLocationId, item_id: widgetId }),
          expect.objectContaining({ location_id: mainLocationId, item_id: gadgetId }),
        ]),
      );

      const itemResponseBody = await request(getAppServer())
        .get(`/api/organizations/${organizationId}/stock?item_id=${widgetId}`)
        .set("Cookie", getAuthCookie(registerResponse))
        .expect(200);

      expect(itemResponseBody.body.stock).toHaveLength(2);
      expect(itemResponseBody.body.stock).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ location_id: mainLocationId, item_id: widgetId }),
          expect.objectContaining({ location_id: outletLocationId, item_id: widgetId }),
        ]),
      );

      const lowStockResponse = await request(getAppServer())
        .get(`/api/organizations/${organizationId}/stock?low_stock=true`)
        .set("Cookie", getAuthCookie(registerResponse))
        .expect(200);

      expect(lowStockResponse.body.stock).toEqual([
        expect.objectContaining({
          location_id: mainLocationId,
          item_id: widgetId,
          quantity: 4,
        }),
      ]);
    },
    testTimeout,
  );

  it(
    "paginates stock levels for an organization",
    async () => {
      const registerResponse = await registerUser("ada@example.com", "Ada Lovelace");

      const organizationResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(registerResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const organizationId = organizationResponse.body.organization.id;
      const locationResponse = await cleanupPool?.query<{ id: string }>(
        `
          INSERT INTO locations (organization_id, name)
          VALUES ($1, $2)
          RETURNING id
        `,
        [organizationId, "Main Warehouse"],
      );
      const locationId = locationResponse?.rows[0]?.id;

      if (!locationId) {
        throw new Error("Expected stock pagination location to be created");
      }

      await cleanupPool?.query(
        `
          WITH inserted_items AS (
            INSERT INTO items (organization_id, sku, name)
            VALUES
              ($1, $2, $3),
              ($1, $4, $5),
              ($1, $6, $7)
            RETURNING id, name
          )
          INSERT INTO stock_levels (organization_id, location_id, item_id, quantity)
          SELECT $1, $8, id, 1
          FROM inserted_items
        `,
        [organizationId, "A-1", "Alpha", "B-1", "Beta", "G-1", "Gamma", locationId],
      );

      const firstPageResponse = await request(getAppServer())
        .get(`/api/organizations/${organizationId}/stock?limit=2`)
        .set("Cookie", getAuthCookie(registerResponse))
        .expect(200);

      expect(firstPageResponse.body.stock).toEqual([
        expect.objectContaining({ item: expect.objectContaining({ name: "Alpha" }) }),
        expect.objectContaining({ item: expect.objectContaining({ name: "Beta" }) }),
      ]);
      expect(firstPageResponse.body.pagination).toEqual({
        limit: 2,
        offset: 0,
        nextOffset: 2,
        hasMore: true,
      });

      const secondPageResponse = await request(getAppServer())
        .get(`/api/organizations/${organizationId}/stock?limit=2&offset=2`)
        .set("Cookie", getAuthCookie(registerResponse))
        .expect(200);

      expect(secondPageResponse.body.stock).toEqual([
        expect.objectContaining({ item: expect.objectContaining({ name: "Gamma" }) }),
      ]);
      expect(secondPageResponse.body.pagination).toEqual({
        limit: 2,
        offset: 2,
        nextOffset: null,
        hasMore: false,
      });
    },
    testTimeout,
  );

  it(
    "lists low-stock rows for an organization",
    async () => {
      const registerResponse = await registerUser("ada@example.com", "Ada Lovelace");

      const organizationResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(registerResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const organizationId = organizationResponse.body.organization.id;
      const seedResponse = await cleanupPool?.query<{
        location_id: string;
        low_item_id: string;
        exact_item_id: string;
      }>(
        `
          WITH inserted_locations AS (
            INSERT INTO locations (organization_id, name)
            VALUES ($1, $2)
            RETURNING id, name
          ),
          inserted_items AS (
            INSERT INTO items (organization_id, sku, name, unit_price, reorder_point)
            VALUES
              ($1, $3, $4, $5, $6),
              ($1, $7, $8, $9, $10),
              ($1, $11, $12, $13, $14)
            RETURNING id, name
          )
          SELECT
            (SELECT id FROM inserted_locations WHERE name = $2) AS location_id,
            (SELECT id FROM inserted_items WHERE name = $4) AS low_item_id,
            (SELECT id FROM inserted_items WHERE name = $8) AS exact_item_id,
            (SELECT id FROM inserted_items WHERE name = $12) AS healthy_item_id
        `,
        [
          organizationId,
          "Main Warehouse",
          "LOW-1",
          "Bolt",
          "2.50",
          5,
          "EXACT-1",
          "Nut",
          "1.25",
          3,
          "OK-1",
          "Washer",
          "0.50",
          10,
        ],
      );
      const seed = seedResponse?.rows[0];

      if (!seed) {
        throw new Error("Expected low-stock seed to be created");
      }

      await cleanupPool?.query(
        `
          INSERT INTO stock_levels (organization_id, location_id, item_id, quantity)
          VALUES
            ($1, $2, $3, $4),
            ($1, $2, $5, $6),
            ($1, $2, (SELECT id FROM items WHERE name = $7), $8)
        `,
        [
          organizationId,
          seed.location_id,
          seed.low_item_id,
          2,
          seed.exact_item_id,
          3,
          "Washer",
          12,
        ],
      );

      const response = await request(getAppServer())
        .get(`/api/organizations/${organizationId}/stock/low`)
        .set("Cookie", getAuthCookie(registerResponse))
        .expect(200);

      expect(response.body.stock).toEqual([
        expect.objectContaining({
          organization_id: organizationId,
          location_id: seed.location_id,
          item_id: seed.low_item_id,
          quantity: 2,
          item: expect.objectContaining({
            id: seed.low_item_id,
            sku: "LOW-1",
            name: "Bolt",
            unit_price: "2.50",
            reorder_point: 5,
          }),
          location: expect.objectContaining({
            id: seed.location_id,
            name: "Main Warehouse",
          }),
        }),
        expect.objectContaining({
          organization_id: organizationId,
          location_id: seed.location_id,
          item_id: seed.exact_item_id,
          quantity: 3,
          item: expect.objectContaining({
            id: seed.exact_item_id,
            sku: "EXACT-1",
            name: "Nut",
            unit_price: "1.25",
            reorder_point: 3,
          }),
          location: expect.objectContaining({
            id: seed.location_id,
            name: "Main Warehouse",
          }),
        }),
      ]);
      expect(response.body.pagination).toEqual({
        limit: 50,
        offset: 0,
        nextOffset: null,
        hasMore: false,
      });
    },
    testTimeout,
  );

  it(
    "paginates low-stock rows for an organization",
    async () => {
      const registerResponse = await registerUser("ada@example.com", "Ada Lovelace");

      const organizationResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(registerResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const organizationId = organizationResponse.body.organization.id;
      const locationResponse = await cleanupPool?.query<{ id: string }>(
        `
          INSERT INTO locations (organization_id, name)
          VALUES ($1, $2)
          RETURNING id
        `,
        [organizationId, "Main Warehouse"],
      );
      const locationId = locationResponse?.rows[0]?.id;

      if (!locationId) {
        throw new Error("Expected low-stock pagination location to be created");
      }

      await cleanupPool?.query(
        `
          WITH inserted_items AS (
            INSERT INTO items (organization_id, sku, name, reorder_point)
            VALUES
              ($1, $2, $3, $4),
              ($1, $5, $6, $7),
              ($1, $8, $9, $10)
            RETURNING id
          )
          INSERT INTO stock_levels (organization_id, location_id, item_id, quantity)
          SELECT $1, $11, id, 1
          FROM inserted_items
        `,
        [organizationId, "A-1", "Alpha", 5, "B-1", "Beta", 5, "G-1", "Gamma", 5, locationId],
      );

      const firstPageResponse = await request(getAppServer())
        .get(`/api/organizations/${organizationId}/stock/low?limit=2`)
        .set("Cookie", getAuthCookie(registerResponse))
        .expect(200);

      expect(firstPageResponse.body.stock).toEqual([
        expect.objectContaining({ item: expect.objectContaining({ name: "Alpha" }) }),
        expect.objectContaining({ item: expect.objectContaining({ name: "Beta" }) }),
      ]);
      expect(firstPageResponse.body.pagination).toEqual({
        limit: 2,
        offset: 0,
        nextOffset: 2,
        hasMore: true,
      });

      const secondPageResponse = await request(getAppServer())
        .get(`/api/organizations/${organizationId}/stock/low?limit=2&offset=2`)
        .set("Cookie", getAuthCookie(registerResponse))
        .expect(200);

      expect(secondPageResponse.body.stock).toEqual([
        expect.objectContaining({ item: expect.objectContaining({ name: "Gamma" }) }),
      ]);
      expect(secondPageResponse.body.pagination).toEqual({
        limit: 2,
        offset: 2,
        nextOffset: null,
        hasMore: false,
      });
    },
    testTimeout,
  );

  it(
    "returns an empty low-stock list when there are no matches",
    async () => {
      const registerResponse = await registerUser("ada@example.com", "Ada Lovelace");

      const organizationResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(registerResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const organizationId = organizationResponse.body.organization.id;

      await cleanupPool?.query(
        `
          WITH inserted_location AS (
            INSERT INTO locations (organization_id, name)
            VALUES ($1, $2)
            RETURNING id
          ),
          inserted_item AS (
            INSERT INTO items (organization_id, sku, name, reorder_point)
            VALUES ($1, $3, $4, $5)
            RETURNING id
          )
          INSERT INTO stock_levels (organization_id, location_id, item_id, quantity)
          SELECT $1, inserted_location.id, inserted_item.id, $6
          FROM inserted_location, inserted_item
        `,
        [organizationId, "Main Warehouse", "OK-1", "Washer", 10, 12],
      );

      const response = await request(getAppServer())
        .get(`/api/organizations/${organizationId}/stock/low`)
        .set("Cookie", getAuthCookie(registerResponse))
        .expect(200);

      expect(response.body).toEqual({
        stock: [],
        pagination: {
          limit: 50,
          offset: 0,
          nextOffset: null,
          hasMore: false,
        },
      });
    },
    testTimeout,
  );

  it(
    "rejects low-stock listing when the current user does not belong to the organization",
    async () => {
      const adaResponse = await registerUser("ada@example.com", "Ada Lovelace");
      const graceResponse = await registerUser("grace@example.com", "Grace Hopper");

      const organizationResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(adaResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const response = await request(getAppServer())
        .get(`/api/organizations/${organizationResponse.body.organization.id}/stock/low`)
        .set("Cookie", getAuthCookie(graceResponse))
        .expect(404);

      expect(response.body).toEqual({
        error: "Organization not found",
      });
    },
    testTimeout,
  );

  it(
    "excludes soft-deleted items and locations from low-stock listing",
    async () => {
      const registerResponse = await registerUser("ada@example.com", "Ada Lovelace");

      const organizationResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(registerResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const organizationId = organizationResponse.body.organization.id;
      const seedResponse = await cleanupPool?.query<{
        active_location_id: string;
        active_item_id: string;
      }>(
        `
          WITH inserted_locations AS (
            INSERT INTO locations (organization_id, name, is_active, deleted_at)
            VALUES
              ($1, $2, TRUE, NULL),
              ($1, $3, FALSE, NOW())
            RETURNING id, name
          ),
          inserted_items AS (
            INSERT INTO items (organization_id, sku, name, reorder_point, is_active, deleted_at)
            VALUES
              ($1, $4, $5, $6, TRUE, NULL),
              ($1, $7, $8, $9, FALSE, NOW())
            RETURNING id, name
          )
          SELECT
            (SELECT id FROM inserted_locations WHERE name = $2) AS active_location_id,
            (SELECT id FROM inserted_locations WHERE name = $3) AS deleted_location_id,
            (SELECT id FROM inserted_items WHERE name = $5) AS active_item_id,
            (SELECT id FROM inserted_items WHERE name = $8) AS deleted_item_id
        `,
        [
          organizationId,
          "Main Warehouse",
          "Archived Warehouse",
          "A-1",
          "Active Bolt",
          5,
          "D-1",
          "Deleted Bolt",
          5,
        ],
      );
      const seed = seedResponse?.rows[0];

      if (!seed) {
        throw new Error("Expected soft-delete seed to be created");
      }

      await cleanupPool?.query(
        `
          INSERT INTO stock_levels (organization_id, location_id, item_id, quantity)
          VALUES
            ($1, $2, $3, $4),
            ($1, $2, (SELECT id FROM items WHERE name = $5), $6),
            ($1, (SELECT id FROM locations WHERE name = $7), $3, $8)
        `,
        [
          organizationId,
          seed.active_location_id,
          seed.active_item_id,
          1,
          "Deleted Bolt",
          1,
          "Archived Warehouse",
          1,
        ],
      );

      const response = await request(getAppServer())
        .get(`/api/organizations/${organizationId}/stock/low`)
        .set("Cookie", getAuthCookie(registerResponse))
        .expect(200);

      expect(response.body.stock).toEqual([
        expect.objectContaining({
          organization_id: organizationId,
          location_id: seed.active_location_id,
          item_id: seed.active_item_id,
          quantity: 1,
          item: expect.objectContaining({
            name: "Active Bolt",
            reorder_point: 5,
          }),
          location: expect.objectContaining({
            name: "Main Warehouse",
          }),
        }),
      ]);
      expect(response.body.pagination).toEqual({
        limit: 50,
        offset: 0,
        nextOffset: null,
        hasMore: false,
      });
    },
    testTimeout,
  );

  it(
    "rejects low-stock listing with invalid pagination parameters",
    async () => {
      const registerResponse = await registerUser("ada@example.com", "Ada Lovelace");

      const organizationResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(registerResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const response = await request(getAppServer())
        .get(`/api/organizations/${organizationResponse.body.organization.id}/stock/low?limit=0`)
        .set("Cookie", getAuthCookie(registerResponse))
        .expect(400);

      expect(response.body.error).toBe("Invalid query parameters");
    },
    testTimeout,
  );

  it(
    "returns aggregate stock summary for an organization",
    async () => {
      const registerResponse = await registerUser("ada@example.com", "Ada Lovelace");

      const organizationResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(registerResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const organizationId = organizationResponse.body.organization.id;
      const seedResponse = await cleanupPool?.query<{
        main_location_id: string;
        store_location_id: string;
        bolt_id: string;
        nut_id: string;
        washer_id: string;
      }>(
        `
          WITH inserted_locations AS (
            INSERT INTO locations (organization_id, name)
            VALUES
              ($1, $2),
              ($1, $3)
            RETURNING id, name
          ),
          inserted_items AS (
            INSERT INTO items (organization_id, sku, name, unit_price, reorder_point)
            VALUES
              ($1, $4, $5, $6, $7),
              ($1, $8, $9, $10, $11),
              ($1, $12, $13, $14, $15)
            RETURNING id, name
          )
          SELECT
            (SELECT id FROM inserted_locations WHERE name = $2) AS main_location_id,
            (SELECT id FROM inserted_locations WHERE name = $3) AS store_location_id,
            (SELECT id FROM inserted_items WHERE name = $5) AS bolt_id,
            (SELECT id FROM inserted_items WHERE name = $9) AS nut_id,
            (SELECT id FROM inserted_items WHERE name = $13) AS washer_id
        `,
        [
          organizationId,
          "Main Warehouse",
          "Outlet Store",
          "BOLT-1",
          "Bolt",
          "10.00",
          5,
          "NUT-1",
          "Nut",
          "2.50",
          5,
          "WASH-1",
          "Washer",
          "1.25",
          1,
        ],
      );
      const seed = seedResponse?.rows[0];

      if (!seed) {
        throw new Error("Expected stock summary seed to be created");
      }

      await cleanupPool?.query(
        `
          INSERT INTO stock_levels (organization_id, location_id, item_id, quantity)
          VALUES
            ($1, $2, $3, $4),
            ($1, $2, $5, $6),
            ($1, $7, $8, $9)
        `,
        [
          organizationId,
          seed.main_location_id,
          seed.bolt_id,
          2,
          seed.nut_id,
          5,
          seed.store_location_id,
          seed.washer_id,
          7,
        ],
      );

      const response = await request(getAppServer())
        .get(`/api/organizations/${organizationId}/stock/summary`)
        .set("Cookie", getAuthCookie(registerResponse))
        .expect(200);

      expect(response.body).toEqual({
        summary: {
          item_count: 3,
          total_quantity: 14,
          total_stock_value: "41.25",
          low_stock_count: 2,
          location_count: 2,
        },
      });
    },
    testTimeout,
  );

  it(
    "returns zero stock summary for an empty organization",
    async () => {
      const registerResponse = await registerUser("ada@example.com", "Ada Lovelace");

      const organizationResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(registerResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const response = await request(getAppServer())
        .get(`/api/organizations/${organizationResponse.body.organization.id}/stock/summary`)
        .set("Cookie", getAuthCookie(registerResponse))
        .expect(200);

      expect(response.body).toEqual({
        summary: {
          item_count: 0,
          total_quantity: 0,
          total_stock_value: "0.00",
          low_stock_count: 0,
          location_count: 0,
        },
      });
    },
    testTimeout,
  );

  it(
    "rejects stock summary when the current user does not belong to the organization",
    async () => {
      const adaResponse = await registerUser("ada@example.com", "Ada Lovelace");
      const graceResponse = await registerUser("grace@example.com", "Grace Hopper");

      const organizationResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(adaResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const response = await request(getAppServer())
        .get(`/api/organizations/${organizationResponse.body.organization.id}/stock/summary`)
        .set("Cookie", getAuthCookie(graceResponse))
        .expect(404);

      expect(response.body).toEqual({
        error: "Organization not found",
      });
    },
    testTimeout,
  );

  it(
    "excludes soft-deleted items and locations from stock summary",
    async () => {
      const registerResponse = await registerUser("ada@example.com", "Ada Lovelace");

      const organizationResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(registerResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const organizationId = organizationResponse.body.organization.id;
      const seedResponse = await cleanupPool?.query<{
        active_location_id: string;
        active_item_id: string;
      }>(
        `
          WITH inserted_locations AS (
            INSERT INTO locations (organization_id, name, is_active, deleted_at)
            VALUES
              ($1, $2, TRUE, NULL),
              ($1, $3, FALSE, NOW())
            RETURNING id, name
          ),
          inserted_items AS (
            INSERT INTO items (organization_id, sku, name, unit_price, reorder_point, is_active, deleted_at)
            VALUES
              ($1, $4, $5, $6, $7, TRUE, NULL),
              ($1, $8, $9, $10, $11, FALSE, NOW())
            RETURNING id, name
          )
          SELECT
            (SELECT id FROM inserted_locations WHERE name = $2) AS active_location_id,
            (SELECT id FROM inserted_locations WHERE name = $3) AS deleted_location_id,
            (SELECT id FROM inserted_items WHERE name = $5) AS active_item_id,
            (SELECT id FROM inserted_items WHERE name = $9) AS deleted_item_id
        `,
        [
          organizationId,
          "Main Warehouse",
          "Archived Warehouse",
          "A-1",
          "Active Bolt",
          "2.00",
          5,
          "D-1",
          "Deleted Bolt",
          "100.00",
          5,
        ],
      );
      const seed = seedResponse?.rows[0];

      if (!seed) {
        throw new Error("Expected soft-delete summary seed to be created");
      }

      await cleanupPool?.query(
        `
          INSERT INTO stock_levels (organization_id, location_id, item_id, quantity)
          VALUES
            ($1, $2, $3, $4),
            ($1, $2, (SELECT id FROM items WHERE name = $5), $6),
            ($1, (SELECT id FROM locations WHERE name = $7), $3, $8)
        `,
        [
          organizationId,
          seed.active_location_id,
          seed.active_item_id,
          3,
          "Deleted Bolt",
          10,
          "Archived Warehouse",
          10,
        ],
      );

      const response = await request(getAppServer())
        .get(`/api/organizations/${organizationId}/stock/summary`)
        .set("Cookie", getAuthCookie(registerResponse))
        .expect(200);

      expect(response.body).toEqual({
        summary: {
          item_count: 1,
          total_quantity: 3,
          total_stock_value: "6.00",
          low_stock_count: 1,
          location_count: 1,
        },
      });
    },
    testTimeout,
  );

  it(
    "rejects stock listing when the current user does not belong to the organization",
    async () => {
      const adaResponse = await registerUser("ada@example.com", "Ada Lovelace");
      const graceResponse = await registerUser("grace@example.com", "Grace Hopper");

      const organizationResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(adaResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const response = await request(getAppServer())
        .get(`/api/organizations/${organizationResponse.body.organization.id}/stock`)
        .set("Cookie", getAuthCookie(graceResponse))
        .expect(404);

      expect(response.body).toEqual({
        error: "Organization not found",
      });
    },
    testTimeout,
  );

  it(
    "returns an empty stock list for an organization without stock levels",
    async () => {
      const registerResponse = await registerUser("ada@example.com", "Ada Lovelace");

      const organizationResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(registerResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const response = await request(getAppServer())
        .get(`/api/organizations/${organizationResponse.body.organization.id}/stock`)
        .set("Cookie", getAuthCookie(registerResponse))
        .expect(200);

      expect(response.body).toEqual({
        stock: [],
        pagination: {
          limit: 50,
          offset: 0,
          nextOffset: null,
          hasMore: false,
        },
      });
    },
    testTimeout,
  );

  it(
    "rejects stock listing with an invalid organization id",
    async () => {
      const registerResponse = await registerUser("ada@example.com", "Ada Lovelace");

      const response = await request(getAppServer())
        .get("/api/organizations/not-a-uuid/stock")
        .set("Cookie", getAuthCookie(registerResponse))
        .expect(400);

      expect(response.body).toEqual({
        error: "Invalid organizationId",
      });
    },
    testTimeout,
  );

  it(
    "rejects stock listing with invalid UUID query parameters",
    async () => {
      const registerResponse = await registerUser("ada@example.com", "Ada Lovelace");

      const organizationResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(registerResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const organizationId = organizationResponse.body.organization.id;

      const locationResponse = await request(getAppServer())
        .get(`/api/organizations/${organizationId}/stock?location_id=not-a-uuid`)
        .set("Cookie", getAuthCookie(registerResponse))
        .expect(400);

      expect(locationResponse.body.error).toBe("Invalid query parameters");

      const itemResponse = await request(getAppServer())
        .get(`/api/organizations/${organizationId}/stock?item_id=not-a-uuid`)
        .set("Cookie", getAuthCookie(registerResponse))
        .expect(400);

      expect(itemResponse.body.error).toBe("Invalid query parameters");
    },
    testTimeout,
  );

  it(
    "rejects stock listing with invalid low-stock query values",
    async () => {
      const registerResponse = await registerUser("ada@example.com", "Ada Lovelace");

      const organizationResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(registerResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const organizationId = organizationResponse.body.organization.id;

      const textResponse = await request(getAppServer())
        .get(`/api/organizations/${organizationId}/stock?low_stock=notabool`)
        .set("Cookie", getAuthCookie(registerResponse))
        .expect(400);

      expect(textResponse.body.error).toBe("Invalid query parameters");

      const numericResponse = await request(getAppServer())
        .get(`/api/organizations/${organizationId}/stock?low_stock=123`)
        .set("Cookie", getAuthCookie(registerResponse))
        .expect(400);

      expect(numericResponse.body.error).toBe("Invalid query parameters");
    },
    testTimeout,
  );

  it(
    "gets a category for an organization when the user belongs to it",
    async () => {
      const registerResponse = await registerUser("ada@example.com", "Ada Lovelace");

      const organizationResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(registerResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const organizationId = organizationResponse.body.organization.id;

      const createCategoryResponse = await request(getAppServer())
        .post(`/api/organizations/${organizationId}/categories`)
        .set("Cookie", getAuthCookie(registerResponse))
        .send({
          name: "Raw Materials",
          description: "Inputs used in production",
        })
        .expect(201);

      const response = await request(getAppServer())
        .get(
          `/api/organizations/${organizationId}/categories/${createCategoryResponse.body.category.id}`,
        )
        .set("Cookie", getAuthCookie(registerResponse))
        .expect(200);

      expect(response.body.category).toMatchObject({
        id: createCategoryResponse.body.category.id,
        organization_id: organizationId,
        name: "Raw Materials",
        description: "Inputs used in production",
      });
    },
    testTimeout,
  );

  it(
    "rejects category fetching when the category is missing",
    async () => {
      const registerResponse = await registerUser("ada@example.com", "Ada Lovelace");

      const organizationResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(registerResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const response = await request(getAppServer())
        .get(
          `/api/organizations/${organizationResponse.body.organization.id}/categories/00000000-0000-4000-8000-000000000001`,
        )
        .set("Cookie", getAuthCookie(registerResponse))
        .expect(404);

      expect(response.body).toEqual({
        error: "Category not found",
      });
    },
    testTimeout,
  );

  it(
    "rejects category fetching with an invalid organization id",
    async () => {
      const registerResponse = await registerUser("ada@example.com", "Ada Lovelace");

      const response = await request(getAppServer())
        .get("/api/organizations/not-a-uuid/categories/00000000-0000-4000-8000-000000000001")
        .set("Cookie", getAuthCookie(registerResponse))
        .expect(400);

      expect(response.body).toEqual({
        error: "Invalid organizationId",
      });
    },
    testTimeout,
  );

  it(
    "rejects category fetching with an invalid category id",
    async () => {
      const registerResponse = await registerUser("ada@example.com", "Ada Lovelace");

      const organizationResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(registerResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const response = await request(getAppServer())
        .get(
          `/api/organizations/${organizationResponse.body.organization.id}/categories/not-a-uuid`,
        )
        .set("Cookie", getAuthCookie(registerResponse))
        .expect(400);

      expect(response.body).toEqual({
        error: "Invalid categoryId",
      });
    },
    testTimeout,
  );

  it(
    "rejects category fetching when the category belongs to another organization",
    async () => {
      const registerResponse = await registerUser("ada@example.com", "Ada Lovelace");

      const firstOrganizationResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(registerResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const secondOrganizationResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(registerResponse))
        .send({ name: "Grace Retail" })
        .expect(201);

      const createCategoryResponse = await request(getAppServer())
        .post(`/api/organizations/${secondOrganizationResponse.body.organization.id}/categories`)
        .set("Cookie", getAuthCookie(registerResponse))
        .send({ name: "Other Organization Category" })
        .expect(201);

      const response = await request(getAppServer())
        .get(
          `/api/organizations/${firstOrganizationResponse.body.organization.id}/categories/${createCategoryResponse.body.category.id}`,
        )
        .set("Cookie", getAuthCookie(registerResponse))
        .expect(404);

      expect(response.body).toEqual({
        error: "Category not found",
      });
    },
    testTimeout,
  );

  it(
    "rejects category fetching when the current user does not belong to the organization",
    async () => {
      const adaResponse = await registerUser("ada@example.com", "Ada Lovelace");
      const graceResponse = await registerUser("grace@example.com", "Grace Hopper");

      const organizationResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(adaResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const organizationId = organizationResponse.body.organization.id;

      const createCategoryResponse = await request(getAppServer())
        .post(`/api/organizations/${organizationId}/categories`)
        .set("Cookie", getAuthCookie(adaResponse))
        .send({ name: "Raw Materials" })
        .expect(201);

      const response = await request(getAppServer())
        .get(
          `/api/organizations/${organizationId}/categories/${createCategoryResponse.body.category.id}`,
        )
        .set("Cookie", getAuthCookie(graceResponse))
        .expect(404);

      expect(response.body).toEqual({
        error: "Organization not found",
      });
    },
    testTimeout,
  );

  it(
    "rejects category fetching when the category is soft deleted",
    async () => {
      const registerResponse = await registerUser("ada@example.com", "Ada Lovelace");

      const organizationResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(registerResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const organizationId = organizationResponse.body.organization.id;

      const deletedCategoryResponse = await cleanupPool?.query<{ id: string }>(
        `
          INSERT INTO categories (organization_id, name, deleted_at)
          VALUES ($1, $2, NOW())
          RETURNING id
        `,
        [organizationId, "Archived Category"],
      );
      const category = deletedCategoryResponse?.rows[0];

      if (!category) {
        throw new Error("Expected deleted category to be created");
      }

      const response = await request(getAppServer())
        .get(`/api/organizations/${organizationId}/categories/${category.id}`)
        .set("Cookie", getAuthCookie(registerResponse))
        .expect(404);

      expect(response.body).toEqual({
        error: "Category not found",
      });
    },
    testTimeout,
  );

  it(
    "rejects category fetching without authentication",
    async () => {
      const response = await request(getAppServer())
        .get(
          "/api/organizations/00000000-0000-4000-8000-000000000001/categories/00000000-0000-4000-8000-000000000002",
        )
        .expect(401);

      expect(response.body).toEqual({
        error: "Missing authentication token",
      });
    },
    testTimeout,
  );

  it(
    "creates a category for an organization when the user is a manager",
    async () => {
      const adaResponse = await registerUser("ada@example.com", "Ada Lovelace");
      const graceResponse = await registerUser("grace@example.com", "Grace Hopper");

      const organizationResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(adaResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const organizationId = organizationResponse.body.organization.id;

      await cleanupPool?.query(
        `
          INSERT INTO user_organizations (user_id, organization_id, role)
          VALUES ($1, $2, $3)
        `,
        [graceResponse.body.user.id, organizationId, "manager"],
      );

      const response = await request(getAppServer())
        .post(`/api/organizations/${organizationId}/categories`)
        .set("Cookie", getAuthCookie(graceResponse))
        .send({
          name: "Raw Materials",
          description: "Inputs used in production",
        })
        .expect(201);

      expect(response.body.category).toMatchObject({
        id: expect.any(String),
        organization_id: organizationId,
        name: "Raw Materials",
        description: "Inputs used in production",
      });
    },
    testTimeout,
  );

  it(
    "rejects category creation with an invalid payload",
    async () => {
      const registerResponse = await registerUser("ada@example.com", "Ada Lovelace");

      const organizationResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(registerResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const organizationId = organizationResponse.body.organization.id;

      const response = await request(getAppServer())
        .post(`/api/organizations/${organizationId}/categories`)
        .set("Cookie", getAuthCookie(registerResponse))
        .send({
          name: "   ",
        })
        .expect(400);

      expect(response.body.error).toBe("Invalid request body");
    },
    testTimeout,
  );

  it(
    "rejects category creation when the current user does not belong to the organization",
    async () => {
      const adaResponse = await registerUser("ada@example.com", "Ada Lovelace");
      const graceResponse = await registerUser("grace@example.com", "Grace Hopper");

      const organizationResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(adaResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const organizationId = organizationResponse.body.organization.id;

      const response = await request(getAppServer())
        .post(`/api/organizations/${organizationId}/categories`)
        .set("Cookie", getAuthCookie(graceResponse))
        .send({ name: "Raw Materials" })
        .expect(404);

      expect(response.body).toEqual({
        error: "Organization not found",
      });
    },
    testTimeout,
  );

  it(
    "rejects category creation with an invalid organization id",
    async () => {
      const registerResponse = await registerUser("ada@example.com", "Ada Lovelace");

      const response = await request(getAppServer())
        .post("/api/organizations/test-org/categories")
        .set("Cookie", getAuthCookie(registerResponse))
        .send({ name: "Raw Materials" })
        .expect(400);

      expect(response.body).toEqual({
        error: "Invalid organizationId",
      });
    },
    testTimeout,
  );

  it(
    "rejects category creation when the current user is a viewer",
    async () => {
      const adaResponse = await registerUser("ada@example.com", "Ada Lovelace");
      const graceResponse = await registerUser("grace@example.com", "Grace Hopper");

      const organizationResponse = await request(getAppServer())
        .post("/api/organizations")
        .set("Cookie", getAuthCookie(adaResponse))
        .send({ name: "Ada Industries" })
        .expect(201);

      const organizationId = organizationResponse.body.organization.id;

      await cleanupPool?.query(
        `
          INSERT INTO user_organizations (user_id, organization_id, role)
          VALUES ($1, $2, $3)
        `,
        [graceResponse.body.user.id, organizationId, "viewer"],
      );

      const response = await request(getAppServer())
        .post(`/api/organizations/${organizationId}/categories`)
        .set("Cookie", getAuthCookie(graceResponse))
        .send({ name: "Raw Materials" })
        .expect(403);

      expect(response.body).toEqual({
        error: "Insufficient permissions",
      });
    },
    testTimeout,
  );

  it(
    "rejects category creation without authentication",
    async () => {
      const response = await request(getAppServer())
        .post("/api/organizations/test-org/categories")
        .send({ name: "No Auth Category" })
        .expect(401);

      expect(response.body).toEqual({
        error: "Missing authentication token",
      });
    },
    testTimeout,
  );
});
