import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require Host authentication
const PROTECTED_ROUTES = ["/", "/editor", "/assign", "/host"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Always allow Guest routes, Login route, and static Next.js assets
  if (
    pathname.startsWith("/guest") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // 2. Check if the user is trying to access a protected Host route
  const isProtected = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isProtected) {
    const sessionCookie = request.cookies.get("wayfinder_host_session")?.value;

    // If no session token exists, kick them immediately to /login
    if (!sessionCookie) {
      const loginUrl = new URL("/login", request.url);
      // Save the URL they tried to visit so we can send them back after login
      loginUrl.searchParams.set("redirect", pathname + request.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};