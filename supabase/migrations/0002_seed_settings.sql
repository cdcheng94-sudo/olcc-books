-- OLCC Books v2 — seed Settings + bootstrap allowed_emails
-- Values copied from v1's Spreadsheet Settings tab (2026-05-28).
-- Safe to re-run: upserts on key.

insert into public.settings (key, value) values
  ('company_name',       'OLCC Technology Sdn Bhd'),
  ('company_address',    '3801 JALAN AUSTIN HEIGHTS 7/7 TAMAN MOUNT AUSTIN 81100 JOHOR BAHRU JOHOR MALAYSIA'),
  ('company_tax_id',     '202601014520 (1676618P)'),
  ('company_phone',      '60165789873'),
  ('company_email',      'cdcheng94@gmail.com'),
  ('logo_url',           'https://raw.githubusercontent.com/cdcheng94-sudo/olcc-assets-circle-png/main/olcc-logo-circle.png'),
  ('currency',           'MYR'),
  ('tax_rate',           '0'),
  ('bank_account_name',  'OLCC TECHNOLOGY SDN. BHD.'),
  ('bank_name',          'OCBC BANK'),
  ('bank_account_no',    '7161244499'),
  ('invoice_prefix',     'INV'),
  ('receipt_prefix',     'RCP'),
  ('next_invoice_seq',   '1'),
  ('next_receipt_seq',   '1')
on conflict (key) do update set value = excluded.value;

-- Bootstrap the first allowed user (owner). Add more partners later via:
--   insert into allowed_emails (email, name) values ('partner@example.com', 'Partner Name');
-- Until at least one row exists, the app layer is lenient and admits any
-- logged-in Google user — once this row lands, the whitelist enforces.
insert into public.allowed_emails (email, name) values
  ('cdcheng94@gmail.com', 'Cheng Dian')
on conflict (email) do nothing;
