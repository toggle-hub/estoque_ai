import { createAdaptorServer } from "@hono/node-server";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sign } from "hono/jwt";
import { Pool } from "pg";
import request from "supertest";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const postgresUser = "test";
const postgresPassword = "test";
const postgresDatabase = "estoque_ai_test";
const jwtSecret = "integration-test-secret";
const bcryptSalt = "$2b$04$KYVbZ5JFVfqu0oV98LnF5e";

let postgresContainer: StartedTestContainer | undefined;
let cleanupPool: Pool | undefined;
let appServer: ReturnType<typeof createAdaptorServer> | undefined;
let appDbPool: Pool | undefined;
let resolvedJwtSecret: string | undefined;

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

const containerStartupTimeout = 120_000;
const testTimeout = 30_000;
const authCookieName = "__Host-estoque_ai_test_session";
const authCookieTtlSeconds = 3_600;

const registerUser = () =>
  request(getAppServer()).post("/api/auth/register").send({
    email: "ada@example.com",
    name: "Ada Lovelace",
    password: "password123",
  });

const getSetCookieHeaders = (response: request.Response) => {
  const setCookieHeader = response.headers["set-cookie"];

  if (!setCookieHeader) {
    throw new Error("Expected set-cookie header");
  }

  return Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
};

const expectAuthCookie = (response: request.Response) => {
  expect(getSetCookieHeaders(response)).toEqual(
    expect.arrayContaining([
      expect.stringContaining(`${authCookieName}=`),
      expect.stringContaining("HttpOnly"),
      expect.stringContaining(`Max-Age=${authCookieTtlSeconds}`),
      expect.stringContaining("Secure"),
      expect.stringContaining("SameSite=Lax"),
      expect.stringContaining("Path=/"),
    ]),
  );
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
  process.env.LOG_LEVEL = "silent";

  cleanupPool = new Pool({ connectionString: databaseUrl });
  await migrate(drizzle(cleanupPool), { migrationsFolder: "drizzle" });

  const [{ app }, dbModule, envModule] = await Promise.all([
    import("../index"),
    import("../db"),
    import("../env"),
  ]);
  appDbPool = dbModule.pool;
  appServer = createAdaptorServer({ fetch: app.fetch });
  resolvedJwtSecret = envModule.env.JWT_SECRET;
}, containerStartupTimeout);

beforeEach(async () => {
  await cleanupPool?.query("TRUNCATE TABLE users RESTART IDENTITY CASCADE");
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

describe("auth routes", () => {
  it(
    "registers a user and sets an auth cookie with sanitized user data",
    async () => {
      const response = await registerUser().expect(201);

      expectAuthCookie(response);
      expect(response.body.user).toMatchObject({
        email: "ada@example.com",
        name: "Ada Lovelace",
        is_active: true,
      });
      expect(response.body.user.id).toEqual(expect.any(String));
      expect(response.body.user.password_hash).toBeUndefined();
    },
    testTimeout,
  );

  it(
    "rejects duplicate registrations",
    async () => {
      await registerUser().expect(201);

      const response = await registerUser().expect(409);

      expect(response.body).toEqual({ error: "Email already in use" });
    },
    testTimeout,
  );

  it(
    "logs in an existing user and sets an auth cookie",
    async () => {
      await registerUser().expect(201);

      const response = await request(getAppServer())
        .post("/api/auth/login")
        .send({
          email: "ada@example.com",
          password: "password123",
        })
        .expect(200);

      expectAuthCookie(response);
      expect(response.body.user).toMatchObject({
        email: "ada@example.com",
        name: "Ada Lovelace",
      });
    },
    testTimeout,
  );

  it(
    "rejects invalid login credentials",
    async () => {
      await registerUser().expect(201);

      const response = await request(getAppServer())
        .post("/api/auth/login")
        .send({
          email: "ada@example.com",
          password: "wrong-password",
        })
        .expect(401);

      expect(response.body).toEqual({ error: "Invalid credentials" });
    },
    testTimeout,
  );

  it(
    "returns the current user for a valid auth cookie",
    async () => {
      const registerResponse = await request(getAppServer()).post("/api/auth/register").send({
        email: "ada@example.com",
        name: "Ada Lovelace",
        password: "password123",
      });

      expect(registerResponse.status).toBe(201);

      const response = await request(getAppServer())
        .get("/api/auth/me")
        .set("Cookie", getAuthCookie(registerResponse))
        .expect(200);

      expect(response.body.user).toMatchObject({
        id: registerResponse.body.user.id,
        email: "ada@example.com",
        name: "Ada Lovelace",
      });
      expect(response.body.user.password_hash).toBeUndefined();
    },
    testTimeout,
  );

  it(
    "rejects missing and invalid auth tokens",
    async () => {
      const missingTokenResponse = await request(getAppServer()).get("/api/auth/me").expect(401);

      expect(missingTokenResponse.body).toEqual({
        error: "Missing authentication token",
      });

      const invalidTokenResponse = await request(getAppServer())
        .get("/api/auth/me")
        .set("Cookie", `${authCookieName}=not-a-real-token`)
        .expect(401);

      expect(invalidTokenResponse.body).toEqual({ error: "Invalid token" });
    },
    testTimeout,
  );

  it(
    "returns not found when token user does not exist",
    async () => {
      const missingUserId = "00000000-0000-0000-0000-000000000000";
      const token = await sign({ sub: missingUserId }, resolvedJwtSecret ?? jwtSecret, "HS256");

      const response = await request(getAppServer())
        .get("/api/auth/me")
        .set("Cookie", `${authCookieName}=${token}`)
        .expect(404);

      expect(response.body).toEqual({ error: "User not found" });
    },
    testTimeout,
  );
});
