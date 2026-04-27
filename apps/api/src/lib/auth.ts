import type { Context, Input, MiddlewareHandler } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { verify } from "hono/jwt";
import {
  type JWTPayload,
  JwtAlgorithmMismatch,
  JwtAlgorithmNotAllowed,
  JwtAlgorithmRequired,
  JwtHeaderInvalid,
  JwtHeaderRequiresKid,
  JwtPayloadRequiresAud,
  JwtSymmetricAlgorithmNotAllowed,
  JwtTokenAudience,
  JwtTokenExpired,
  JwtTokenInvalid,
  JwtTokenIssuedAt,
  JwtTokenIssuer,
  JwtTokenNotBefore,
  JwtTokenSignatureMismatched,
} from "hono/utils/jwt/types";
import type { Env as HonoPinoEnv } from "hono-pino";
import { db } from "../db";
import type { usersTable } from "../db/schema";
import { env } from "../env";
import { findActiveUserById } from "../repositories/user.repository";
import { logErrorResponse, logGenericErrorResponse } from "./http-log";

type UserRecord = typeof usersTable.$inferSelect;

export type AuthenticatedPayload = JWTPayload & { sub: string };

export type AuthenticatedAppEnv = HonoPinoEnv & {
  Variables: HonoPinoEnv["Variables"] & {
    authUser: UserRecord;
    authTokenPayload: AuthenticatedPayload;
  };
};

const isJwtClientError = (error: unknown) =>
  error instanceof JwtAlgorithmMismatch ||
  error instanceof JwtAlgorithmNotAllowed ||
  error instanceof JwtAlgorithmRequired ||
  error instanceof JwtHeaderInvalid ||
  error instanceof JwtHeaderRequiresKid ||
  error instanceof JwtPayloadRequiresAud ||
  error instanceof JwtSymmetricAlgorithmNotAllowed ||
  error instanceof JwtTokenAudience ||
  error instanceof JwtTokenExpired ||
  error instanceof JwtTokenInvalid ||
  error instanceof JwtTokenIssuedAt ||
  error instanceof JwtTokenIssuer ||
  error instanceof JwtTokenNotBefore ||
  error instanceof JwtTokenSignatureMismatched;

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
 * Resolves the current authenticated user from the JWT and returns an HTTP response on failure.
 *
 * @param c Hono request context.
 * @returns Authenticated user and token payload, or an HTTP response for auth failures.
 */
export const resolveAuthenticatedUser = async <
  E extends HonoPinoEnv,
  P extends string,
  I extends Input,
>(
  c: Context<E, P, I>,
) => {
  const token = getAuthToken(c);

  if (!token) {
    logErrorResponse(c, "Missing authentication token");
    return { response: c.json({ error: "Missing authentication token" }, 401) };
  }

  let payload: JWTPayload & { sub?: string };
  try {
    payload = await verify(token, env.JWT_SECRET, "HS256");
  } catch (error) {
    if (isJwtClientError(error)) {
      logErrorResponse(c, "Invalid token");
      return { response: c.json({ error: "Invalid token" }, 401) };
    }

    const logger = c.get("logger");

    logger.error(
      {
        error,
      },
      "Token verification failed unexpectedly",
    );
    logGenericErrorResponse(c);
    return { response: c.json({ error: "Internal server error" }, 500) };
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
    payload: payload as AuthenticatedPayload,
  };
};

/**
 * Authenticates the request and stores the current user in the Hono context.
 */
export const authMiddleware: MiddlewareHandler<AuthenticatedAppEnv> = async (c, next) => {
  const authResult = await resolveAuthenticatedUser(c);

  if ("response" in authResult) {
    return authResult.response;
  }

  c.set("authUser", authResult.user);
  c.set("authTokenPayload", authResult.payload);

  await next();
};

/**
 * Returns the authenticated user injected by the auth middleware.
 *
 * @param c Hono request context.
 * @returns Current authenticated user.
 */
export const getAuthenticatedUser = (c: Context<AuthenticatedAppEnv>) => c.get("authUser");
