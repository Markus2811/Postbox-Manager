/** PostgREST/Postgres, wenn Migration 20260502140000 noch nicht ausgeführt wurde. */
export function isMissingDocumentWorkspaceColumns(message: string | undefined): boolean {
  if (!message) return false;
  return (
    message.includes("workspace_bucket") ||
    message.includes("user_edited_at")
  );
}
