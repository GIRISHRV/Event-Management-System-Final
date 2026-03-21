import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/services/supabase/middleware";

// ✅ Function must be named "proxy" in Next.js 16 (was "middleware" in older versions)
export async function proxy(request: NextRequest) {
  const { user, supabaseResponse } = await updateSession(request);
  const path = request.nextUrl.pathname;

  const isAuthRoute = path === "/signin" || path === "/signup";

  // Define protected routes
  const isCustomerRoute = path.startsWith("/customer-dashboard");
  const isVendorRoute = path.startsWith("/vendor-dashboard");
  const isAdminRoute = path.startsWith("/admin-dashboard");
  const isProfileRoute = path.startsWith("/profile");

  const isProtectedRoute = isCustomerRoute || isVendorRoute || isAdminRoute || isProfileRoute;

  // 1. Unauthenticated users trying to access protected routes -> Redirect to signin
  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    url.searchParams.set("returnUrl", path);
    return NextResponse.redirect(url);
  }

  // 2. Authenticated users -> Role-based routing
  if (user) {
    // Extract role from JWT metadata instead of a DB query
    // Supabase puts custom claims in user_metadata or app_metadata
    const role = user.app_metadata?.role || user.user_metadata?.role || null;

    // Prevent vendors from accessing customer dashboards and vice versa
    if (isCustomerRoute && role !== "customer") {
      const url = request.nextUrl.clone();
      url.pathname = role === "vendor" ? "/vendor-dashboard" : "/";
      return NextResponse.redirect(url);
    }

    if (isVendorRoute && role !== "vendor") {
      const url = request.nextUrl.clone();
      url.pathname = role === "customer" ? "/customer-dashboard" : "/";
      return NextResponse.redirect(url);
    }

    // Redirect away from auth pages if already logged in
    if (isAuthRoute || path === "/") {
      const url = request.nextUrl.clone();
      if (role === "vendor") url.pathname = "/vendor-dashboard";
      else if (role === "customer") url.pathname = "/customer-dashboard";
      else url.pathname = "/";

      // Only redirect if we are actually moving to a dashboard
      if (url.pathname !== path) {
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api routes (if they handle their own auth)
     */
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};