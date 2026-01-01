import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/chat(.*)",
  "/sandbox(.*)",
  "/rabbitholes(.*)",
  "/archetype(.*)",
  "/speak(.*)",
  "/settings(.*)",
  "/(api|trpc)(.*)",
]);

/**
 * Make sure /api/webhooks stays public
 */

// Simple in-memory rate limiter (use Redis in production)
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 5; // 5 chats per minute

function chatMiddleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/chat") {
    // Use x-forwarded-for header as a fallback since NextRequest.ip is not available
    const userId =
      request.headers.get("x-clerk-user-id") ||
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    const now = Date.now();

    // Clean old entries
    const requests = rateLimitMap.get(userId) || [];
    const recentRequests = requests.filter(
      (time) => now - time < RATE_LIMIT_WINDOW
    );

    if (recentRequests.length >= MAX_REQUESTS) {
      // Redirect to home page if too many requests
      return NextResponse.redirect(new URL("/", request.url), { status: 302 });
    }

    recentRequests.push(now);
    rateLimitMap.set(userId, recentRequests);
  }

  return NextResponse.next();
}

export default clerkMiddleware(async (auth, req) => {
  // Create a base response we can mutate
  const res = NextResponse.next();

  // Exclude webhooks from protection
  if (
    isProtectedRoute(req) &&
    !req.nextUrl.pathname.startsWith("/api/webhooks")
  ) {
    await auth.protect();
  }

  return chatMiddleware(req);
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
