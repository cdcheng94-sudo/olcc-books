# OLCC Books v2

Internal bookkeeping system for OLCC Technology Sdn Bhd. Rewrite of the v1
Apps Script version on a modern stack.

**Spec source of truth:** `OLCC-Books-2.0-网页版开发文档.md` (located in
`../OLCC account system/`).

## Tech stack

- Next.js 15 (App Router) + TypeScript + React 19
- Supabase: Postgres + Auth (Google OAuth) + Storage
- Tailwind CSS + shadcn/ui primitives
- Resend for transactional email
- Gemini 2.5 Flash for receipt OCR
- Recharts for dashboard charts (added in a later phase)
- @react-pdf/renderer for invoice / receipt PDFs (added in a later phase)
- Deployed on Vercel (auto-deploy from GitHub main branch)

## First-time setup

```bash
# 1. Install deps
npm install

# 2. Copy env template and fill in values from Supabase/Resend/Gemini dashboards
cp .env.local.example .env.local

# 3. Run database migrations against your Supabase project
#    Open Supabase Dashboard → SQL Editor → paste each file under supabase/migrations/
#    in order (0001 → 0002 → 0003) and click Run.

# 4. Configure Google OAuth in Supabase
#    Dashboard → Authentication → Providers → Google → enable + paste your
#    Google Cloud OAuth Client ID + Secret. Add Authorized Redirect URI:
#       https://<your-project>.supabase.co/auth/v1/callback

# 5. Run dev server
npm run dev
```

Open http://localhost:3000 and sign in with a Google account whose email
appears in the `allowed_emails` table (the seed inserts the owner email).

## Directory map

```
app/
├── (app)/                  # Authenticated app shell (sidebar + topbar)
│   ├── layout.tsx          # Shell + whitelist gate
│   ├── dashboard/
│   ├── transactions/
│   ├── invoices/
│   ├── receipts/
│   ├── recurring/
│   ├── subscriptions/      # ← new in v2: bill customers
│   ├── claims/
│   └── settings/
├── auth/
│   ├── login/page.tsx      # Google OAuth button
│   ├── callback/route.ts   # OAuth code → session
│   ├── logout/route.ts
│   └── error/page.tsx
├── api/                    # cron + ocr + email (to be added)
├── layout.tsx              # root layout with <LangProvider>
├── page.tsx                # root → /dashboard or /auth/login
└── globals.css             # OLCC theme (navy + gold)

components/
├── Sidebar.tsx             # left nav
├── TopBar.tsx              # title + lang toggle + logout
├── LangProvider.tsx        # bilingual zh/en context
├── PageStub.tsx            # placeholder for unbuilt pages
└── ui/                     # shadcn primitives

lib/
├── supabase/
│   ├── client.ts           # browser
│   ├── server.ts           # server components
│   └── middleware.ts       # session refresh middleware
├── categories.ts           # income/expense + claim categories
├── i18n.ts                 # zh/en dictionary
├── types.ts                # DB row types
└── utils.ts                # cn() + hasEnvVars

supabase/
└── migrations/
    ├── 0001_init.sql       # tables + RLS
    ├── 0002_seed_settings.sql  # company info from v1 + first allowed email
    └── 0003_storage.sql    # buckets + storage policies

middleware.ts               # Next middleware → updateSession
.env.local.example
```

## Development order

Follow `OLCC-Books-2.0-网页版开发文档.md` §9. After scaffolding, each
phase is its own module — build, test, then continue.

1. ✅ Scaffold + Supabase clients
2. ✅ Schema migrations
3. **Next**: wire Supabase project + run migrations + verify Google login
4. Then in order: layout polish → Transactions → Dashboard → Recurring/Subscriptions → Claims → PDF → Invoices+Receipts → OCR → Deploy

## Critical business rules (carried over from v1, do not change)

- **Only Receipt creates an income Transaction.** Marking an invoice paid
  creates a Receipt (with `linked_invoice_id`), which then cascades into
  a Transaction. Prevents double-counting.
- **Marking Recurring paid writes a real expense Transaction.** Not just
  a status flip — cash flow must be visible.
- **Marking Claim paid writes a real expense Transaction.** Same reason.
- **Category strings are immutable identifiers.** Add new ones to
  `lib/categories.ts`; never rename existing ones.

## v1 reference

The v1 Apps Script implementation lives in
`../OLCC account system/apps-script/`. Its full architecture is
documented in `../OLCC account system/SYSTEM_SUMMARY.md`. Several v1
"gotchas" are eliminated by this stack — see SYSTEM_SUMMARY §12.
