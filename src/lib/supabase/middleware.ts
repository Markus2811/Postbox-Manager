import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const method = request.method;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !supabaseAnonKey) {
    if (path === "/api/health") {
      return NextResponse.json(
        {
          ok: false,
          service: "postbox-manager",
          error: "missing_env",
          hint: "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel (Production), then Redeploy.",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (path.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: "missing_supabase_env",
          hint: "Vercel → Settings → Environment Variables (Production): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY. Then Redeploy.",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }
    return new NextResponse(
      "Konfiguration unvollständig: In Vercel unter Settings → Environment Variables (Production) NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY setzen, danach Redeploy.",
      { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }

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
    supabaseUrl,
    supabaseAnonKey,
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
