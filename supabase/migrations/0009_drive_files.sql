-- 0009_drive_files.sql
-- Metadata for receipt files stored in Google Drive (drive.file scope).
-- transactions.receipt_url / claims.receipt_url now hold a Drive webViewLink;
-- this table records the Drive fileId etc. so deletes can clean up the file
-- and we have an audit trail.

create table if not exists public.drive_files (
  id             uuid primary key default gen_random_uuid(),
  drive_file_id  text not null unique,
  web_view_link  text not null,
  filename       text not null,
  mime_type      text,
  size_bytes     bigint,
  folder_path    text,                 -- "OLCC Books/2026/Receipts"
  linked_table   text not null,        -- 'transactions' | 'claims'
  linked_id      uuid not null,
  uploaded_at    timestamptz not null default now(),
  uploaded_by    text                  -- current user's email
);

create index if not exists drive_files_linked_idx on public.drive_files (linked_table, linked_id);

alter table public.drive_files enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='drive_files' and policyname='drive_files_authed_all') then
    create policy drive_files_authed_all on public.drive_files for all to authenticated using (true) with check (true);
  end if;
end $$;
