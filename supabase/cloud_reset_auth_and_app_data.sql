-- =============================================================================
-- Postbox Manager – „Frischer Start“ im HOSTED-Supabase-Projekt (SQL-Editor)
-- =============================================================================
-- Löscht ALLE Zeilen in auth.users. Per FK/CASCADE fallen u. a. documents und
-- document_metadata mit weg (wie in apply_postbox_to_cloud.sql definiert).
--
-- Vorher: Backup / Export, wenn noch etwas Wichtiges in der DB liegt.
-- Danach: Dashboard → Storage → Bucket „documents“ leeren (DELETE auf
-- storage.objects ist in Supabase oft nicht per SQL möglich).
--
-- Anschließend: App nur noch über EINE Basis-URL nutzen (z. B. Cloudflare-
-- Tunnel), dieselbe URL + …/auth/callback unter Authentication → URL
-- Configuration eintragen, optional „Confirm email“ für Tests aus.
-- =============================================================================

begin;

delete from auth.users;

commit;
