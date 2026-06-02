-- OLCC Books v2 — test transaction data
-- Mirrors the owner's real v1 entries plus a few more for filter variety.
-- Safe to re-run: skips on duplicate dates+notes by hashing both into a check.
-- Delete before going live with:  delete from public.transactions;

insert into public.transactions (date, type, category, amount, party, note) values
  -- Current month — May 2026
  ('2026-05-17', 'expense', 'Office Supplies',          1.70, 'Hi! Sunshine Mart',          'Baixiang yummy soup noodle'),
  ('2026-05-20', 'expense', 'Office Supplies',         25.00, null,                          'marker+duster'),
  ('2026-05-22', 'expense', 'Office Supplies',         36.00, null,                          'double side tape'),
  ('2026-05-24', 'expense', 'Office Supplies',         48.00, null,                          '插头+板擦'),
  ('2026-05-25', 'expense', 'Other Expense',         1150.00, 'SSM',                         'Sdn Bhd registration'),
  ('2026-05-26', 'income',  'Capital Injection',     3000.00, 'Cheng Dian',                  '入金 / capital injection'),
  ('2026-05-27', 'income',  'Service Income',        1775.00, 'Pusat Tuisyen Minda Soleh',   'Aircond service'),
  ('2026-05-28', 'expense', 'Utilities',              320.00, 'TNB',                         'Electricity bill'),
  -- Previous month — April 2026 (for testing the "show older" toggle)
  ('2026-04-15', 'expense', 'Rent',                  1800.00, 'Landlord',                    'April office rent'),
  ('2026-04-10', 'income',  'Sales Income',          2400.00, 'Tech Solutions SB',           'CCTV installation'),
  ('2026-04-05', 'expense', 'Software Subscription',   80.00, 'Adobe',                       'Creative Cloud monthly');
