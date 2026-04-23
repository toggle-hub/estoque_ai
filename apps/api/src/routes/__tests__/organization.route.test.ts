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
});
