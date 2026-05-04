import { NextResponse, type NextRequest } from "next/server";

const authCookieName = process.env.AUTH_COOKIE_NAME ?? "__Host-estoque_ai_session";
const sessionVerificationTimeoutMs = 3_000;

/**
 * Builds an API URL from the optional public API origin.
 *
 * @param request Incoming Next.js request.
 * @param path API path beginning with a slash.
 * @returns Same-origin path or absolute API URL.
 */
const getApiUrl = (request: NextRequest, path: string) => {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");

  return apiBaseUrl ? `${apiBaseUrl}${path}` : new URL(path, request.url).toString();
};

/**
 * Extracts the auth cookie from a Cookie header.
 *
 * @param cookieHeader Raw Cookie header value.
 * @returns Cookie header containing only the auth cookie.
 */
const getAuthCookie = (cookieHeader: string | null) => {
  const authCookie = cookieHeader
    ?.split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${authCookieName}=`));

  return authCookie ?? "";
};

/**
 * Verifies the current request cookie against the auth API.
 *
 * @param request Incoming Next.js request.
 * @returns True when the session token resolves to an active user.
 */
const verifySession = async (request: NextRequest) => {
  if (!request.cookies.has(authCookieName)) {
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), sessionVerificationTimeoutMs);
  const authCookie = getAuthCookie(request.headers.get("cookie"));

  const response = await fetch(getApiUrl(request, "/api/auth/me"), {
    headers: {
      cookie: authCookie,
    },
    signal: controller.signal,
  }).catch(() => null);

  clearTimeout(timeout);

  return response?.ok ?? false;
};

/**
 * Redirects protected routes when the current session cannot be verified.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasValidSession = await verifySession(request);

  if (pathname.startsWith("/dashboard") && !hasValidSession) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
