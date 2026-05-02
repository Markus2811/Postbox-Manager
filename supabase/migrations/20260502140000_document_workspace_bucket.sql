-- Virtuelle Ablage: Posteingang vs. Erledigt + Zeitpunkt manueller Stammdaten-Änderung

alter table public.documents
  add column if not exists workspace_bucket text;

alter table public.documents
  add column if not exists user_edited_at timestamptz;

update public.documents
set workspace_bucket = 'inbox'
where workspace_bucket is null;

alter table public.documents
  alter column workspace_bucket set default 'inbox';

alter table public.documents
  alter column workspace_bucket set not null;

alter table public.documents
  drop constraint if exists documents_workspace_bucket_check;

alter table public.documents
  add constraint documents_workspace_bucket_check
  check (workspace_bucket in ('inbox', 'done'));

create index if not exists documents_user_workspace_idx
  on public.documents (user_id, workspace_bucket, created_at desc);

comment on column public.documents.workspace_bucket is 'Virtuelle Ablage: inbox = Posteingang, done = Erledigt';
comment on column public.documents.user_edited_at is 'Letzte manuelle Änderung an Stammdaten (z. B. Anzeigename/Kategorie)';
