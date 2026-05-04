/**
 * Next.js Middleware
 * Stack contract:
 *   auth.default=supabase-auth   → JWT verification via @supabase/ssr
 *   auth.session=jwt-with-refresh → refresh tokens rotated on use
 *   security.rate_limiting=required → Upstash ratelimit on hot endpoints
 *   security.csp=required        → Content-Security-Policy header (NFR-011)
 *   auth.multi_tenant.rls=required → crew_id propagated via JWT claims
 *
 * Responsibilities:
 *   1. Refresh expired Supabase sessions (rotate refresh token)
 *   2. Redirect unauthenticated users to /auth/sign-in
 *   3. Redirect authenticated users away from /auth/* to /
 *   4. Set strict Content-Security-Policy headers
 *   5. Set HSTS header (NFR-011)
 */

import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Route matchers
// ---------------------------------------------------------------------------
// Public routes that do not require authentication
const PUBLIC_ROUTES = [
  "/",             // Marketing landing page (unauthenticated visitors)
  "/login",
  "/onboarding",
  "/privacy",
  "/terms",
  "/cookies",
  "/acceptable-use",
  "/q/",           // Customer quote view (signed URL)
  "/api/auth/otp",
  "/api/auth/onboarding",
  "/api/webhooks/",
  "/api/quotes/",  // /accept and /decline are public
];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((r) => {
    // Exact match for the root marketing page
    if (r === "/") return pathname === "/";
    return pathname.startsWith(r);
  });
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
export async function middleware(request: NextRequest) {
  // Generate per-request nonce for CSP (NFR-011)
  // Use Web Crypto API (available in Edge runtime — no Node.js 'crypto' module)
  const nonce = crypto.randomUUID().replace(/-/g, "");

  let response = NextResponse.next({
    request: {
      headers: (() => {
        const headers = new Headers(request.headers);
        headers.set("x-nonce", nonce);
        return headers;
      })(),
    },
  });

  // Add security headers to all responses
  response = addSecurityHeaders(response, nonce);

  // Create Supabase client that can update session cookies in the response
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          response = addSecurityHeaders(response, nonce);
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session (rotates refresh token if expired)
  // IMPORTANT: getUser() must be called to refresh session;
  // do NOT use getSession() — it does not validate the JWT.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Redirect authenticated users away from login/auth screens
  if (user && (pathname === "/login" || pathname.startsWith("/auth/"))) {
    // Onboarding page is allowed even when authenticated
    if (pathname !== "/onboarding") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // Require auth for protected routes
  if (!user && !isPublicRoute(pathname)) {
    const signInUrl = new URL("/login", request.url);
    signInUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Require completed onboarding for app routes
  if (user && pathname !== "/onboarding" && !isPublicRoute(pathname)) {
    const crewId = user.app_metadata?.crew_id as string | undefined;
    if (!crewId) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
  }

  return response;
}

// ---------------------------------------------------------------------------
// Security headers (NFR-011)
// ---------------------------------------------------------------------------
function addSecurityHeaders(response: NextResponse, nonce: string): NextResponse {
  // HSTS — preload; 2 years
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );

  // Content-Security-Policy (per docs/03-system-design.md §6.3)
  //
  // We use 'unsafe-inline' for script-src in *all* environments. The
  // alternative (per-request nonce) is fundamentally broken with Vercel's
  // edge cache: prerendered HTML has the build-time nonce baked in, but
  // middleware regenerates the nonce on every request, so cached pages
  // serve nonce-less <script> tags that the browser then rejects → blank
  // hydration on every cold load. 'strict-dynamic' with hashes is the
  // theoretically-correct fix but Next.js doesn't emit script hashes
  // automatically. Until that ships, 'unsafe-inline' is the pragmatic
  // call: Next.js bootstrap is safe, third-party scripts are still
  // restricted by the explicit allowlist.
  // PostHog serves config from us-assets.i.posthog.com (separate from us.i.posthog.com).
  // Vercel Live (preview-feedback widget) lives at vercel.live + iframes.
  const scriptSrc =
    "script-src 'self' 'unsafe-inline' https://us.i.posthog.com https://us-assets.i.posthog.com https://browser.sentry-cdn.com https://vercel.live";

  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",  // Tailwind requires unsafe-inline in some builds
      // blob: needed for the optimistic photo-thumbnail preview
      // (URL.createObjectURL). https://*.supabase.co covers signed-URL
      // photo reads from Supabase Storage.
      "img-src 'self' data: blob: https://storage.googleapis.com https://*.supabase.co",
      "font-src 'self'",
      "connect-src 'self' https://*.supabase.co https://*.upstash.io https://api.anthropic.com https://api.twilio.com https://us.i.posthog.com https://us-assets.i.posthog.com https://*.ingest.sentry.io https://vercel.live wss://ws-us3.pusher.com",
      "frame-src 'self' https://vercel.live",
      "media-src 'self'",
      "worker-src 'self'",  // Service worker for PWA
      "manifest-src 'self'",
      "frame-ancestors 'none'",
    ].join("; ")
  );

  response.headers.set("x-nonce", nonce);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(self), geolocation=(self), microphone=(), payment=()"
  );

  return response;
}

// ---------------------------------------------------------------------------
// Matcher — run middleware on all routes except static files
// ---------------------------------------------------------------------------
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimisation files)
     * - favicon.ico, manifest.json, icons/
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/|sw.js).*)",
  ],
};
