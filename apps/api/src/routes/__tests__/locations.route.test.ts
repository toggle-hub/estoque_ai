import { resolve } from "node:path";
import { createAdaptorServer } from "@hono/node-server";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import request from "supertest";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { locationsTable } from "../../db/schema";

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
    "TRUNCATE TABLE locations, user_organizations, organizations, users RESTART IDENTITY CASCADE",
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
        .get(`/api/locations/${organizationId}`)
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
        .get(`/api/locations/${organizationId}`)
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
      const response = await request(getAppServer()).get("/api/locations/test-org").expect(401);

      expect(response.body).toEqual({
        error: "Missing authentication token",
      });
    },
    testTimeout,
  );
});
