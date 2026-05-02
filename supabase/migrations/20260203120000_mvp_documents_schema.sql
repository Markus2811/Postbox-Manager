-- MVP: erweiterte documents + document_metadata (ersetzt vorheriges Schema)

drop policy if exists "documents_storage_delete_own" on storage.objects;
drop policy if exists "documents_storage_update_own" on storage.objects;
drop policy if exists "documents_storage_insert_own" on storage.objects;
drop policy if exists "documents_storage_select_own" on storage.objects;

drop policy if exists "document_metadata_delete_own" on public.document_metadata;
drop policy if exists "document_metadata_update_own" on public.document_metadata;
drop policy if exists "document_metadata_insert_own" on public.document_metadata;
drop policy if exists "document_metadata_select_own" on public.document_metadata;

drop policy if exists "documents_delete_own" on public.documents;
drop policy if exists "documents_update_own" on public.documents;
drop policy if exists "documents_insert_own" on public.documents;
drop policy if exists "documents_select_own" on public.documents;

drop table if exists public.document_metadata cascade;
drop table if exists public.documents cascade;

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  file_size bigint,
  display_name text,
  category text,
  status text not null default 'uploaded',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_status_check check (
    status in ('uploaded', 'processing', 'processed', 'failed')
  )
);

create index documents_user_created_idx
  on public.documents (user_id, created_at desc);

create index documents_user_category_idx
  on public.documents (user_id, category);

create table public.document_metadata (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  document_type text,
  sender text,
  document_date date,
  due_date date,
  amount numeric,
  currency text,
  summary text,
  action_required boolean not null default false,
  action_description text,
  confidence numeric,
  raw_ai_json jsonb,
  created_at timestamptz not null default now(),
  constraint document_metadata_document_id_key unique (document_id)
);

create index document_metadata_user_idx on public.document_metadata (user_id);
create index document_metadata_due_date_idx on public.document_metadata (due_date)
  where due_date is not null;

alter table public.documents enable row level security;
alter table public.document_metadata enable row level security;

create policy "documents_select_own"
  on public.documents for select to authenticated
  using (user_id = (select auth.uid()));

create policy "documents_insert_own"
  on public.documents for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "documents_update_own"
  on public.documents for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "documents_delete_own"
  on public.documents for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "document_metadata_select_own"
  on public.document_metadata for select to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.documents d
      where d.id = document_id and d.user_id = (select auth.uid())
    )
  );

create policy "document_metadata_insert_own"
  on public.document_metadata for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.documents d
      where d.id = document_id and d.user_id = (select auth.uid())
    )
  );

create policy "document_metadata_update_own"
  on public.document_metadata for update to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.documents d
      where d.id = document_id and d.user_id = (select auth.uid())
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.documents d
      where d.id = document_id and d.user_id = (select auth.uid())
    )
  );

create policy "document_metadata_delete_own"
  on public.document_metadata for delete to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.documents d
      where d.id = document_id and d.user_id = (select auth.uid())
    )
  );

grant select, insert, update, delete on public.documents to authenticated;
grant select, insert, update, delete on public.document_metadata to authenticated;

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "documents_storage_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "documents_storage_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "documents_storage_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "documents_storage_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create or replace function public.set_documents_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger documents_set_updated_at
  before update on public.documents
  for each row
  execute procedure public.set_documents_updated_at();
