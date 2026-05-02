/**
 * Smoke-Test: legt einen ECHTEN Auth-Nutzer in dem Projekt aus .env.local an –
 * derselbe Eintrag wie bei „Konto erstellen“ in der Web-App (Authentication → Users).
 * Nicht wundern: E-Mail beginnt mit postbox-cli-smoke-… (nur dieses Skript).
 *
 * Aufruf: node --env-file=.env.local scripts/test-auth-signup-login.mjs
 *         npm run test:auth
 */
import { createClient } from "@supabase/supabase-js";

console.warn(
  "[test-auth] Erzeugt einen echten Supabase-Auth-Nutzer (wie Web-Registrierung). Zum Abbrechen Ctrl+C."
);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Fehlt NEXT_PUBLIC_SUPABASE_URL oder NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

/* Supabase lehnt viele Test-Domains ab; Format muss „real“ wirken. */
const email = `postbox-cli-smoke-${Date.now()}@gmail.com`;
const password = "TestPasswort123456!";

const supabase = createClient(url, key);

const { data: up, error: eUp } = await supabase.auth.signUp({
  email,
  password,
});

console.log("signUp error:", eUp?.message ?? null);
console.log("signUp session:", up.session ? "ja" : "nein");
console.log("signUp user id:", up.user?.id ?? null);
console.log("email_confirmed_at:", up.user?.email_confirmed_at ?? null);

const { data: inData, error: eIn } = await supabase.auth.signInWithPassword({
  email,
  password,
});

console.log("signIn error:", eIn?.message ?? null);
console.log("signIn session:", inData.session ? "ja" : "nein");

await supabase.auth.signOut().catch(() => {});
