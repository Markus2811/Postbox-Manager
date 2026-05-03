-- Canonical machine-readable name (underscores); display_name holds UX title.
alter table public.documents
  add column if not exists internal_name text;

comment on column public.documents.internal_name is
  'Deterministic machine name: Kategorie_Absender_Thema_YYYY-MM-DD (ASCII, underscores)';
