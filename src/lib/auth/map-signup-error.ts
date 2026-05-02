import type { AuthError } from "@supabase/supabase-js";

export function mapSignupError(error: AuthError): string {
  switch (error.code) {
    case "user_already_exists":
    case "email_exists":
      return "Diese E-Mail ist bereits registriert. Bitte anmelden.";
    case "weak_password":
      return "Passwort ist zu schwach (Supabase-Richtlinie).";
    default:
      break;
  }
  return error.message;
}
