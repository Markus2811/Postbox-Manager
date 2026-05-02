import type { AuthError } from "@supabase/supabase-js";

/** Lesbare Meldungen für Supabase Auth (Login / API). */
export function mapLoginError(error: AuthError): string {
  const msg = (error.message || "").toLowerCase();
  if (
    error.code === "email_not_confirmed" ||
    msg.includes("email not confirmed") ||
    msg.includes("email address not confirmed")
  ) {
    return "E-Mail ist noch nicht bestätigt. Bitte den Link in der Registrierungs-Mail öffnen und danach erneut anmelden.";
  }
  switch (error.code) {
    case "invalid_credentials":
      return "E-Mail oder Passwort ist falsch – oder das Konto ist noch nicht per E-Mail bestätigt (Supabase). Dann entweder Bestätigungslink nutzen, im Dashboard den Nutzer bestätigen, oder „Confirm email“ für Tests aus und neu registrieren.";
    case "user_banned":
      return "Dieses Konto ist gesperrt.";
    case "captcha_failed":
      return "Sicherheitsprüfung fehlgeschlagen (Captcha). Bitte im Supabase-Dashboard prüfen.";
    default:
      break;
  }
  if (msg.includes("invalid login credentials") || msg.includes("invalid credentials")) {
    return "E-Mail oder Passwort ist falsch – oder das Konto ist noch nicht per E-Mail bestätigt (Supabase). Dann entweder Bestätigungslink nutzen, im Dashboard den Nutzer bestätigen, oder „Confirm email“ für Tests aus und neu registrieren.";
  }
  return error.message;
}
