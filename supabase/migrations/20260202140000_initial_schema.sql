-- Postbox Manager: Kern-Schema (lokal & Produktion via gleiche Migration)

-- Dokumente pro Nutzer (Multi-Tenant über user_id = auth.users.id)
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  file_path text not null,
  created_at timestamptz not null default now()
);

create index documents_user_id_created_at_idx
  on public.documents (user_id, created_at desc);

-- KI-/Extraktionsergebnisse (1:1 zu Dokument möglich, flexibel über mehrere Zeilen erweiterbar)
create table public.document_metadata (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  type text,
  sender text,
  due_date timestamptz,
  amount numeric,
  category text,
  summary text,
  action_required boolean not null default false,
  action_description text
);

create index document_metadata_document_id_idx
  on public.document_metadata (document_id);

create index document_metadata_due_date_idx
  on public.document_metadata (due_date)
  where due_date is not null;

alter table public.documents enable row level security;
alter table public.document_metadata enable row level security;

-- documents: nur eigene Zeilen
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

-- document_metadata: nur wenn zugehöriges Dokument dem Nutzer gehört
create policy "document_metadata_select_own"
  on public.document_metadata for select to authenticated
  using (
    exists (
      select 1 from public.documents d
      where d.id = document_id and d.user_id = (select auth.uid())
    )
  );

create policy "document_metadata_insert_own"
  on public.document_metadata for insert to authenticated
  with check (
    exists (
      select 1 from public.documents d
      where d.id = document_id and d.user_id = (select auth.uid())
    )
  );

create policy "document_metadata_update_own"
  on public.document_metadata for update to authenticated
  using (
    exists (
      select 1 from public.documents d
      where d.id = document_id and d.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.documents d
      where d.id = document_id and d.user_id = (select auth.uid())
    )
  );

create policy "document_metadata_delete_own"
  on public.document_metadata for delete to authenticated
  using (
    exists (
      select 1 from public.documents d
      where d.id = document_id and d.user_id = (select auth.uid())
    )
  );

grant select, insert, update, delete on public.documents to authenticated;
grant select, insert, update, delete on public.document_metadata to authenticated;

-- Storage: privater Bucket, Pfade {user_id}/{document_id}/{filename}
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
