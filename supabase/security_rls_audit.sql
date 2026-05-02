-- Security audit helpers (Supabase SQL Editor, read-only checks).
-- Erwartung: RLS enabled; Policies nur für authenticated; Storage bucket privat.

-- 1) Tabellen mit RLS-Status
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in ('documents', 'document_metadata')
order by c.relname;

-- 2) Policies auf public.documents / document_metadata
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('documents', 'document_metadata')
order by tablename, policyname;

-- 3) Storage: Bucket documents sollte nicht public sein
select id, name, public
from storage.buckets
where id = 'documents';

-- 4) Storage policies (storage.objects)
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname like 'documents_storage%'
order by policyname;
