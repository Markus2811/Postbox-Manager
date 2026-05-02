-- Duplikate pro Nutzer: gleicher Dateiinhalt (SHA-256), unabhängig vom Dateinamen

alter table public.documents
  add column if not exists content_hash text;

create unique index if not exists documents_user_content_hash_uidx
  on public.documents (user_id, content_hash)
  where content_hash is not null;

comment on column public.documents.content_hash is 'SHA-256 (hex) der Rohdatei; eindeutig pro Nutzer bei gesetztem Wert';
