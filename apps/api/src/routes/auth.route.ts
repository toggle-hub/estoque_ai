import { compare, hash } from "bcrypt";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import type { Env as HonoPinoEnv } from "hono-pino";
import { z } from "zod";
import { db } from "../db";
import { env } from "../env";
import { requireAuthenticatedUser, sanitizeUser, setAuthCookie } from "../lib/auth";
import { logErrorResponse, logGenericErrorResponse } from "../lib/http-log";
import { createUser, findActiveUserByEmail } from "../repositories/user.repository";

const auth = new Hono<HonoPinoEnv>().basePath("/auth");

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

  const hashedPassword = await hash(parsed.data.password, env.BCRYPT_SALT);

  const user = await createUser(db, {
    email: parsed.data.email,
    name: parsed.data.name,
    password_hash: hashedPassword,
  });

  const safeUser = sanitizeUser(user);
  const token = await sign({ sub: user.id, user: safeUser }, env.JWT_SECRET);
  setAuthCookie(c, token);

  return c.json({ user: safeUser }, 201);
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

  const user = await findActiveUserByEmail(db, parsed.data.email);

  if (!user) {
    logErrorResponse(c, "Invalid credentials");
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const passwordMatches = await compare(parsed.data.password, user.password_hash);

  if (!passwordMatches) {
    logErrorResponse(c, "Invalid credentials");
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const safeUser = sanitizeUser(user);
  const token = await sign({ sub: user.id, user: safeUser }, env.JWT_SECRET);
  setAuthCookie(c, token);

  return c.json({ user: safeUser });
});

/**
 * Returns the current authenticated user derived from the session token.
 */
auth.get("/me", async (c) => {
  const authResult = await requireAuthenticatedUser(c);

  if ("response" in authResult) {
    return authResult.response;
  }

  return c.json({ user: sanitizeUser(authResult.user) });
});

export { auth };
