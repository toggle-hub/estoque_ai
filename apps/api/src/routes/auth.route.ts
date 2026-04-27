import { compare, hash } from "bcrypt";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import type { Env as HonoPinoEnv } from "hono-pino";
import { z } from "zod";
import { db } from "../db";
import { env } from "../env";
import {
  type AuthenticatedAppEnv,
  authMiddleware,
  getAuthenticatedUser,
  setAuthCookie,
} from "../lib/auth";
import { getDatabaseError, isUniqueConstraintViolation } from "../lib/database-errors";
import { logErrorResponse, logGenericErrorResponse } from "../lib/http-log";
import { createUser, findActiveUserByEmail } from "../repositories/user.repository";
import { sanitizeUser } from "../serializers/user.serializer";

const auth = new Hono<HonoPinoEnv>().basePath("/auth");
const protectedAuth = new Hono<AuthenticatedAppEnv>();

const registerSchema = z.object({
  email: z.email(),
  name: z.string().trim().min(1),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

/**
 * Creates a user account and immediately establishes an authenticated session.
 */
auth.post("/register", async (c) => {
  const payload = await c.req.json().catch(() => null);
  const parsed = registerSchema.safeParse(payload);

  if (!parsed.success) {
    logErrorResponse(c, "Invalid request body");
    return c.json({ error: "Invalid request body", issues: z.treeifyError(parsed.error) }, 400);
  }

  const existingUser = await findActiveUserByEmail(db, parsed.data.email);

  if (existingUser) {
    logGenericErrorResponse(c);
    return c.json({ error: "Email already in use" }, 409);
  }

  let hashedPassword: string;
  try {
    hashedPassword = await hash(parsed.data.password, env.BCRYPT_SALT);
  } catch (error) {
    const logger = c.get("logger");

    logger.error(
      {
        error,
        email: parsed.data.email,
      },
      "Password hashing failed during user registration",
    );
    logGenericErrorResponse(c);
    return c.json({ error: "Internal server error" }, 500);
  }

  try {
    const user = await createUser(db, {
      email: parsed.data.email,
      name: parsed.data.name,
      password_hash: hashedPassword,
    });

    const safeUser = sanitizeUser(user);
    let token: string;
    try {
      token = await sign({ sub: user.id, user: safeUser }, env.JWT_SECRET);
    } catch (error) {
      const logger = c.get("logger");

      logger.error(
        {
          error,
          userId: user.id,
        },
        "JWT signing failed during user registration",
      );
      logGenericErrorResponse(c);
      return c.json({ error: "Internal server error" }, 500);
    }
    setAuthCookie(c, token);

    return c.json({ user: safeUser }, 201);
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      const databaseError = getDatabaseError(error);
      const logger = c.get("logger");

      logger.error(
        {
          error: {
            code: databaseError?.code,
            constraint: databaseError?.constraint,
            email: parsed.data.email,
          },
        },
        "User register failed due to duplicate email",
      );
      logGenericErrorResponse(c);
      return c.json({ error: "Email already in use" }, 409);
    }

    throw error;
  }
});

/**
 * Authenticates an existing user and refreshes the session cookie.
 */
auth.post("/login", async (c) => {
  const payload = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(payload);

  if (!parsed.success) {
    logErrorResponse(c, "Invalid request body");
    return c.json({ error: "Invalid request body", issues: z.treeifyError(parsed.error) }, 400);
  }

  let user: Awaited<ReturnType<typeof findActiveUserByEmail>>;
  try {
    user = await findActiveUserByEmail(db, parsed.data.email);
  } catch (error) {
    const logger = c.get("logger");

    logger.error(
      {
        error,
        email: parsed.data.email,
      },
      "User lookup failed during login",
    );
    logGenericErrorResponse(c);
    return c.json({ error: "Internal server error" }, 500);
  }

  if (!user) {
    logErrorResponse(c, "Invalid credentials");
    return c.json({ error: "Invalid credentials" }, 401);
  }

  let passwordMatches: boolean;
  try {
    passwordMatches = await compare(parsed.data.password, user.password_hash);
  } catch (error) {
    const logger = c.get("logger");

    logger.error(
      {
        error,
        userId: user.id,
      },
      "Password comparison failed during login",
    );
    logGenericErrorResponse(c);
    return c.json({ error: "Internal server error" }, 500);
  }

  if (!passwordMatches) {
    logErrorResponse(c, "Invalid credentials");
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const safeUser = sanitizeUser(user);
  let token: string;
  try {
    token = await sign({ sub: user.id, user: safeUser }, env.JWT_SECRET);
  } catch (error) {
    const logger = c.get("logger");

    logger.error(
      {
        error,
        userId: user.id,
      },
      "JWT signing failed during login",
    );
    logGenericErrorResponse(c);
    return c.json({ error: "Internal server error" }, 500);
  }
  setAuthCookie(c, token);

  return c.json({ user: safeUser });
});

protectedAuth.use("/me", authMiddleware);

/**
 * Returns the current authenticated user derived from the session token.
 */
protectedAuth.get("/me", async (c) => c.json({ user: sanitizeUser(getAuthenticatedUser(c)) }));

auth.route("/", protectedAuth);

export { auth };
