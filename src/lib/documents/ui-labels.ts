/** Kurze, nutzerfreundliche Status-Texte (keine internen Codes in der Oberfläche). */
export function documentStatusUiLabel(status: string): string {
  switch (status) {
    case "processing":
      return "Wird ausgewertet";
    case "processed":
      return "Bereit";
    case "failed":
      return "Fehler";
    default:
      return status || "—";
  }
}
