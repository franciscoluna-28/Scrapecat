import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    const { pathname } = request.nextUrl;

    if (
      !pathname.startsWith("/demo") &&
      !pathname.startsWith("/api") &&
      !pathname.startsWith("/_next/static") &&
      !pathname.startsWith("/_next/image") &&
      pathname !== "/favicon.ico"
    ) {
      return NextResponse.redirect(new URL("/demo", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
