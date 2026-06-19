# OLCC Books v2

Internal bookkeeping system for OLCC Technology Sdn Bhd, plus the customer
billing + after-sales engine for **EduFlow** (the SaaS OLCC sells to tuition
centres/schools). Rewrite of the v1 Apps Script version on a modern stack.
Live in production at https://olcc-books.vercel.app.

> For a full, current narrative of what the system does, see
> **`PROJECT_OVERVIEW.md`** (the discussion snapshot). Operators read
> `OPERATIONS.md`; maintainers read `HANDOVER.md`.

## Tech stack

- Next.js 16 (App Router, Server Actions) + TypeScript + React 19
- Supabase: Postgres (~11 tables, flat RLS) + Auth (Google OAuth + `allowed_emails` whitelist) + Storage
- Tailwind CSS + shadcn/ui primitives — navy + gold theme, bilingual zh/en
- Resend for transactional email (verified domain `send.olcctechnology.com`)
- **Google Drive** (`googleapis`, `drive.file` scope) for user-uploaded receipt archival
- Gemini 2.0 Flash for receipt OCR
- Recharts for dashboard charts
- @react-pdf/renderer for invoice / receipt PDFs (server-rendered)
- Deployed on Vercel (auto-deploy from GitHub `main`, daily Cron)

## First-time setup

```bash
# 1. Install deps
npm install

# 2. Fill .env.local from Supabase / Resend / Gemini / Google Drive dashboards
#    (see HANDOVER.md §4 for the full env var list)

# 3. Run database migrations against Supabase
#    Supabase Dashboard → SQL Editor → run each file under supabase/migrations/
#    in order (0001 → … → 0010) and click Run.

# 4. Configure Google OAuth in Supabase
#    Authentication → Providers → Google → enable + Client ID/Secret.
#    Redirect URI: https://<project>.supabase.co/auth/v1/callback

# 5. Run dev server (webpack, not Turbopack — see HANDOVER.md §9.1)
npm run dev
```

Open http://localhost:3000 and sign in with a Google account whose email is in
`allowed_emails` (the seed inserts the owner email).

## Directory map

```
app/
├── (app)/                  # Authenticated app shell (sidebar + topbar)
│   ├── layout.tsx          # Shell + whitelist gate
│   ├── dashboard/          # Stat cards, charts, 3-col reminder grid
│   ├── transactions/       # Ledger (7 types) + OCR scan + Drive receipt upload
│   ├── invoices/           # CRUD + PDF + email + Mark-Paid dialog
│   ├── receipts/           # Auto (from invoice/subscription) + manual
│   ├── recurring/          # Vendor payments we owe
│   ├── subscriptions/      # Customer monthly billing (+ persistent % discount)
│   ├── care/               # ← new: Customer Care (after-sales check-ins)
│   ├── eduflow/            # 1-minute EduFlow customer onboarding
│   ├── capital/            # Capital vs Operating fund pools (read-only report)
│   ├── claims/             # Employee reimbursement workflow
│   └── settings/           # Company info, banking, numbering, whitelist
├── auth/                   # login / callback / logout / error
├── api/
│   ├── cron/daily-reminders/   # Vercel Cron (milestone reminders + digest)
│   ├── ocr/parse-receipt/      # Gemini OCR
│   └── drive/                  # Google Drive upload + OAuth setup-token/callback
└── manifest.ts             # PWA manifest (home-screen icon)

components/                 # Sidebar, TopBar, LangProvider, charts/, ui/
lib/
├── supabase/               # browser + server clients
├── queries/                # server SELECT helpers (transactions, capital, care, …)
├── pdf/                    # InvoicePDF + ReceiptPDF + render
├── drive.ts                # Google Drive upload/delete (server)
├── drive-cleanup.ts        # delete linked Drive files on row delete
├── upload-receipt.ts       # client compress → POST /api/drive/upload
├── image.ts                # client image compression
├── email.ts                # Resend wrapper (from + reply-to)
├── numbering.ts            # INV-XXXX / RCP-XXXX
├── categories.ts           # transaction / claim / capital / check-in constants
├── recurring-utils.ts      # date math, urgency, reminder milestones
├── eduflow-plans.ts        # 3 plan constants
├── types.ts                # DB row types
└── i18n.ts                 # zh/en dictionary

supabase/migrations/        # 0001_init … 0010_customer_care
middleware.ts               # auth redirect (excludes api/cron, api/drive, assets)
vercel.json                 # Cron config
```

## Critical business rules (do not change)

- **Only a Receipt creates an income Transaction.** Marking an invoice or
  subscription paid creates a Receipt, which cascades into one income
  Transaction. Prevents double-counting.
- **Marking Recurring/Claim paid writes a real expense Transaction.** Claims
  can optionally cascade a `capital_expense` (Capital Pool) instead.
- **Capital vs Operating pools must stay separate** (tax correctness):
  shareholder loans / equity / repayments never hit P&L. See PROJECT_OVERVIEW §6.
- **Category strings are immutable identifiers.** Add new ones to
  `lib/categories.ts`; never rename existing ones.
- **A Drive failure must never block a save.** User-uploaded receipts go to
  Google Drive; if Drive fails the row still saves (retry via the upload button).
- **System-generated PDFs + logo stay on Supabase Storage; only user-uploaded
  receipts go to Google Drive.**
