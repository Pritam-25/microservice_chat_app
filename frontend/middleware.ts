import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const jwt = req.cookies.get("jwt")?.value

  // Protect chat route
  if (pathname.startsWith("/chat")) {
    if (!jwt) {
      const url = req.nextUrl.clone()
      url.pathname = "/login"
      url.searchParams.set("from", pathname)
      return NextResponse.redirect(url)
    }
  }

  // If already logged in, avoid auth pages
  const isAuthPage = ["/login", "/signup", "/forgot-password"].some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/reset-password")
  if (jwt && isAuthPage) {
    const url = req.nextUrl.clone()
    url.pathname = "/chat"
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/chat",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password/:path*",
  ],
}
