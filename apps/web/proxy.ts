import { NextResponse, type NextRequest } from "next/server";

const authCookieName = process.env.AUTH_COOKIE_NAME ?? "__Host-estoque_ai_session";

/**
 * Redirects protected routes when no auth cookie is present.
 *
 * @param request Incoming Next.js request.
 * @returns Proxy response.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasAuthCookie = request.cookies.has(authCookieName);

  if (pathname.startsWith("/dashboard") && !hasAuthCookie) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("next", pathname);

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
