import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const method = request.method;

  /**
   * POST /api/auth/*: kein getUser() im Middleware-Pfad – vermeidet seltene Fälle, in denen
   * der Request-Body vor dem Route Handler nicht mehr lesbar ist (z. B. Tunnel + Browser).
   */
  if (
    method === "POST" &&
    (path === "/api/auth/signup" || path === "/api/auth/login" || path === "/api/auth/logout")
  ) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (path.startsWith("/api/")) {
    return supabaseResponse;
  }

  /**
   * Alte deutsche URLs → neue Routen. PKCE/E-Mail: /auth/callback durchlassen.
   * Sonstige /auth/* → Login (Legacy).
   */
  if (path.startsWith("/auth/callback")) {
    /* durchlassen */
  } else if (path.startsWith("/auth/registrieren")) {
    const url = request.nextUrl.clone();
    url.pathname = "/signup";
    return NextResponse.redirect(url);
  } else if (path.startsWith("/auth/anmelden")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  } else if (path.startsWith("/auth/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const needsAuth =
    path.startsWith("/dashboard") ||
    path.startsWith("/dokumentenliste") ||
    path.startsWith("/upload") ||
    path.startsWith("/documents") ||
    path.startsWith("/fragen") ||
    path.startsWith("/fristen") ||
    path.startsWith("/finanzen") ||
    path.startsWith("/vertraege") ||
    path.startsWith("/analytics");

  if (!user && needsAuth) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("weiter", path);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
