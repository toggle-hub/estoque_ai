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
