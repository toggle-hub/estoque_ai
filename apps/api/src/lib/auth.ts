import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { verify } from "hono/jwt";
import type { JWTPayload } from "hono/utils/jwt/types";
import type { Env as HonoPinoEnv } from "hono-pino";
import { db } from "../db";
import type { usersTable } from "../db/schema";
import { env } from "../env";
import { findActiveUserById } from "../repositories/user.repository";
import { logErrorResponse } from "./http-log";

type UserRecord = typeof usersTable.$inferSelect;

type AuthenticationResult =
  | { user: UserRecord; payload: JWTPayload & { sub: string } }
  | { response: Response };

/**
 * Extracts the JWT from a standard `Bearer <token>` authorization header.
 *
 * @param authorizationHeader Raw Authorization header value.
 * @returns JWT string when the header uses the Bearer scheme, otherwise `null`.
 */
const getBearerToken = (authorizationHeader?: string | null) => {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
};

/**
 * Reads the auth token from the session cookie first, then falls back to a bearer token.
 *
 * @param c Hono request context.
 * @returns JWT string when present, otherwise `null`.
 */
export const getAuthToken = (c: Context) =>
  getCookie(c, env.AUTH_COOKIE_NAME) ?? getBearerToken(c.req.header("authorization"));

/**
 * Persists the signed JWT in the configured HTTP-only session cookie.
 *
 * @param c Hono request context.
 * @param token Signed JWT value.
 */
export const setAuthCookie = (c: Context, token: string) => {
  setCookie(c, env.AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    maxAge: env.AUTH_COOKIE_TTL_SECONDS,
    path: "/",
    sameSite: "Lax",
    secure: true,
  });
};

/**
 * Removes sensitive user fields before returning user data to API clients.
 *
 * @param user Database user record.
 * @returns User payload safe to expose in API responses.
 */
export const sanitizeUser = (user: UserRecord) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  is_active: user.is_active,
  created_at: user.created_at,
  updated_at: user.updated_at,
});

/**
 * Resolves the current authenticated user from the JWT and returns an HTTP response on failure.
 *
 * @param c Hono request context.
 * @returns Authenticated user and token payload, or an HTTP response for auth failures.
 */
export const requireAuthenticatedUser = async (
  c: Context<HonoPinoEnv>,
): Promise<AuthenticationResult> => {
  const token = getAuthToken(c);

  if (!token) {
    logErrorResponse(c, "Missing authentication token");
    return {
      response: c.json({ error: "Missing authentication token" }, 401),
    };
  }

  let payload: JWTPayload & { sub?: string };
  try {
    payload = await verify(token, env.JWT_SECRET, "HS256");
  } catch {
    logErrorResponse(c, "Invalid token");
    return { response: c.json({ error: "Invalid token" }, 401) };
  }

  if (!payload.sub) {
    logErrorResponse(c, "Invalid token payload");
    return { response: c.json({ error: "Invalid token payload" }, 401) };
  }

  const user = await findActiveUserById(db, payload.sub);

  if (!user) {
    logErrorResponse(c, "User not found");
    return { response: c.json({ error: "User not found" }, 404) };
  }

  return {
    user,
    payload: payload as JWTPayload & { sub: string },
  };
};
