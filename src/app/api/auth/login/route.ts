import { mapLoginError } from "@/lib/auth/map-login-error";
import { supabasePublicHost } from "@/lib/supabase/public-host";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type Body = { email?: string; password?: string };

type PendingCookie = { name: string; value: string; options?: Parameters<NextResponse["cookies"]["set"]>[2] };

/**
 * Wie bei POST /api/auth/signup: Cookies erst nach Auth-Aufruf auf eine frische NextResponse legen.
 * (Vorgefertigtes `NextResponse.json` + nachträgliches `cookies.set` kann in Route Handlern zuverlässiger fehlschlagen.)
 */
export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return NextResponse.json({ error: "E-Mail und Passwort sind erforderlich." }, { status: 400 });
  }

  const pending: PendingCookie[] = [];
  const supabase = createServerClient(
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

  const host = supabasePublicHost();

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return NextResponse.json(
      { error: mapLoginError(error), code: error.code ?? null, supabaseHost: host },
      { status: 401 }
    );
  }

  await supabase.auth.getUser();

  const res = NextResponse.json({ ok: true as const, supabaseHost: host });
  pending.forEach(({ name, value, options }) => {
    res.cookies.set(name, value, options);
  });
  return res;
}
