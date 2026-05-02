import { mapSignupError } from "@/lib/auth/map-signup-error";
import { supabaseDashboardUsersUrl, supabasePublicHost } from "@/lib/supabase/public-host";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

type Body = { email?: string; password?: string; origin?: string };

type PendingCookie = { name: string; value: string; options?: Parameters<NextResponse["cookies"]["set"]>[2] };

export async function POST(request: NextRequest) {
  const host = supabasePublicHost();

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body", supabaseHost: host }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const origin = typeof body.origin === "string" ? body.origin.replace(/\/$/, "").trim() : "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "E-Mail und Passwort sind erforderlich.", supabaseHost: host },
      { status: 400 }
    );
  }

  /**
   * signUp mit createServerClient nutzt PKCE (siehe @supabase/ssr). Der /signup-Request
   * an GoTrue kann dadurch in Route Handlern scheitern – Nutzer erscheint nicht in auth.users.
   * signUp läuft daher über einen schlanken Client (implicit), Session wird bei Bedarf per
   * setSession auf den SSR-Client übertragen (Cookies wie bei Login).
   */
  const authSignUp = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );

  const emailRedirectTo = origin ? `${origin}/auth/callback?next=/dashboard` : undefined;

  const { data, error } = await authSignUp.auth.signUp({
    email,
    password,
    options: emailRedirectTo ? { emailRedirectTo } : undefined,
  });

  if (error) {
    return NextResponse.json(
      { error: mapSignupError(error), code: error.code ?? null, supabaseHost: host },
      { status: 400 }
    );
  }

  if (!data.user) {
    return NextResponse.json(
      { error: "Registrierung ohne Nutzerdaten – bitte erneut versuchen.", supabaseHost: host },
      { status: 500 }
    );
  }

  const pending: PendingCookie[] = [];
  if (data.session) {
    const supabaseSsr = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach((c) => pending.push(c));
          },
        },
      }
    );
    const { error: sessionError } = await supabaseSsr.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
    if (sessionError) {
      return NextResponse.json(
        {
          error: `Konto wurde angelegt, Session konnte nicht gesetzt werden: ${sessionError.message}`,
          code: sessionError.code ?? null,
          supabaseHost: host,
        },
        { status: 500 }
      );
    }
  }

  const res = NextResponse.json({
    ok: true as const,
    session: Boolean(data.session),
    userId: data.user.id,
    supabaseHost: host,
    dashboardUsersUrl: supabaseDashboardUsersUrl(),
  });
  pending.forEach(({ name, value, options }) => {
    res.cookies.set(name, value, options);
  });
  return res;
}
