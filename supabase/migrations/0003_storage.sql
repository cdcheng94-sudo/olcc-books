-- OLCC Books v2 — storage buckets for uploaded receipts + generated PDFs
-- Run AFTER 0001_init.sql in Supabase SQL Editor.
--
-- Two buckets:
--   - receipts: user-uploaded photos/PDFs of transaction & claim receipts
--   - pdfs:     generated invoice/receipt PDFs from react-pdf
-- Both private (RLS-gated by authenticated role).

insert into storage.buckets (id, name, public) values
  ('receipts', 'receipts', false),
  ('pdfs',     'pdfs',     false)
on conflict (id) do nothing;

-- Policies: any authenticated user can read/write either bucket
-- (flat permission model per spec).
create policy "receipts_authed_read"   on storage.objects for select to authenticated using (bucket_id = 'receipts');
create policy "receipts_authed_insert" on storage.objects for insert to authenticated with check (bucket_id = 'receipts');
create policy "receipts_authed_update" on storage.objects for update to authenticated using (bucket_id = 'receipts');
create policy "receipts_authed_delete" on storage.objects for delete to authenticated using (bucket_id = 'receipts');

create policy "pdfs_authed_read"   on storage.objects for select to authenticated using (bucket_id = 'pdfs');
create policy "pdfs_authed_insert" on storage.objects for insert to authenticated with check (bucket_id = 'pdfs');
create policy "pdfs_authed_update" on storage.objects for update to authenticated using (bucket_id = 'pdfs');
create policy "pdfs_authed_delete" on storage.objects for delete to authenticated using (bucket_id = 'pdfs');
