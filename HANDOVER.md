# OLCC Books v2 — 项目交接文档

> 给接手开发/运维的人。当前状态、所有服务、所有 env var、架构决策、已完成、未完成。
>
> **最后更新:** 2026-06-03,v2 已上线 + 全双语 + Discount(% 制)+ Subscription 折扣每期自动套用。

---

## 1. 一句话概括

OLCC Technology 内部财务系统的 **完整重写版**,从 v1 的 Google Apps Script (Spreadsheet 数据库 + HTML UI) 迁移到 **Next.js 16 + Supabase + Vercel**,新增 Subscriptions、EduFlow onboard 助手、自动催费、OCR 等模块。

- **生产 URL:** https://olcc-books.vercel.app
- **代码仓库:** https://github.com/cdcheng94-sudo/olcc-books (Private)
- **本地工作目录:** `D:\CLAUDE workspace\olcc-books`

---

## 2. 技术栈

| 层 | 技术 | 备注 |
|---|---|---|
| 框架 | **Next.js 16.2.6 (App Router)** | Webpack dev (不用 Turbopack,内存兼容) |
| 语言 | TypeScript 5 + React 19 | strict mode |
| UI | **Tailwind CSS 3.4** + shadcn/ui 元件 | 自定义 navy + gold 主题 |
| 数据库 | **Supabase Postgres** | 8 张表,flat RLS |
| Auth | **Supabase Auth + Google OAuth** | 加 `allowed_emails` 白名单 |
| 文件存储 | **Supabase Storage** | 2 buckets: `receipts`, `pdfs` |
| 邮件 | **Resend** (`resend` npm 包) | 沙箱 from,production 待 verify domain |
| PDF | **@react-pdf/renderer** | 服务端渲染 → 上传 Storage → 返 signed URL |
| 图表 | **Recharts** | 6 月柱图 + 分类 donut |
| AI OCR | **Gemini 2.0 Flash** (REST API) | 收据解析,结构化 JSON 输出 |
| 部署 | **Vercel Hobby** | Webpack build, Node 20 |
| 定时任务 | **Vercel Cron** | `vercel.json` 配 01:00 UTC 跑 |
| 国际化 | 自家 i18n (zh / en) | `lib/i18n.ts`,默认 en |

---

## 3. 第三方服务速查

| 服务 | URL | 用途 | 账号 |
|---|---|---|---|
| Vercel | https://vercel.com/cdcheng94-sudo/olcc-books | Hosting + Cron + Env vars | GitHub 登录 |
| Supabase | https://supabase.com/dashboard/project/wfrzuzjbonmaulzufrdu | Postgres + Auth + Storage | yesteaching 账号 |
| GitHub | https://github.com/cdcheng94-sudo/olcc-books | 源代码 | cdcheng94-sudo (Private) |
| Google Cloud | https://console.cloud.google.com (Default Gemini Project) | OAuth Client + Gemini API key | yesteaching.com 组织 |
| Resend | https://resend.com (cdcheng94@gmail.com 注册) | 邮件 | (沙箱模式) |

---

## 4. 环境变量(Env Vars)

### 4.1 全部 7 个

放在 **Vercel → Settings → Environment Variables**(Production / Preview / Development 三个 scope 都加)。

| Key | 用途 | 类型 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL | public |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key(前端用) | public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role(cron 用) | **secret** |
| `GEMINI_API_KEY` | OCR 用 | secret |
| `RESEND_API_KEY` | 邮件用 | secret |
| `RESEND_FROM` | 邮件 from 字段 | public 但建议 secret |
| `CRON_SECRET` | Vercel Cron auth (Bearer token) | secret |

### 4.2 本地 `.env.local` 模板

```
NEXT_PUBLIC_SUPABASE_URL=https://wfrzuzjbonmaulzufrdu.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<sb_publishable_...>
SUPABASE_SERVICE_ROLE_KEY=<sb_secret_...>
GEMINI_API_KEY=<AIzaSy...>
RESEND_API_KEY=<re_...>
RESEND_FROM=OLCC Books <onboarding@resend.dev>
CRON_SECRET=<32-byte hex>
```

`.env.local` 在 `.gitignore` 里,**永远不 commit**。

---

## 5. Supabase 数据库 schema

8 张表,migration 在 `supabase/migrations/` 已经跑过:

| 表 | 用途 | 关键 cascade |
|---|---|---|
| `settings` | key-value 公司资料/银行/编号计数器 | — |
| `allowed_emails` | 白名单 | — |
| `transactions` | 总账(income/expense) | 被 receipts/claims/recurring 级联写入 |
| `invoices` | 开给客户的发票 | Mark Paid → 触发 createReceipt |
| `receipts` | 收据(自动 + 手动) | insert → 自动写一行 income transactions |
| `recurring` | 我们付的月费 | Mark Paid → 写一行 expense transactions |
| `subscriptions` | 客户付我们的月费 (v2 新增) | Mark Paid → 经 Receipt 级联 → income transaction |
| `claims` | 员工报销 | markPaid → 写一行 expense transactions |

### 5.1 Cascade 设计核心

`receipts → transactions` 是**唯一的 income 入账路径**(见 `0001_init.sql` line 69-72 注释)。Invoices 永远不直接 insert transactions,而是先开 receipt,让 receipt cascade 入账。这避免 invoice / receipt 双重计数。

类似地:
- Claim "paid" → 直接 insert expense transaction(claims 没有中间 receipt)
- Recurring "paid" → 直接 insert expense transaction
- **Subscription "paid" → 经 `createReceipt()` 级联**(discount-% 升级后改的)。每期会生成 RCP-xxxx 收据 + PDF(客户可邮),并应用该订阅的 `discount_percent`。createReceipt 自己再级联 income transaction,所以入账依然单一来源。

> ✅ 之前 backlog 里"Subscription Mark Paid 没走 receipt"的隐患已经修掉了(discount-% 升级时一并处理)。

### 5.1.1 Discount(折扣)语义 — **% 制**

**重要:** discount 是**百分比(0–100)**,不是固定金额。

- 存储:`invoices.discount_percent` / `receipts.discount_percent` / `subscriptions.discount_percent`(都是 `numeric(5,2)`,migration `0006`)。
- 公式:`total = subtotal − (subtotal × discount_percent / 100) + tax`。
- 渲染时才把 % 换算成金额(`subtotal × pct/100`),所以单一来源是 %。
- **Subscriptions 的 discount_percent 是持久的** —— 每期 Mark Paid 自动套用,客户每月账单都看到"原价 → 折扣 X% → 实付"。
- EduFlow onboard 的 discount_percent **同时**写进首期 invoice **和**月度 subscription(给客户的折扣首期 + 每月都生效)。
- PDF 总额区显示 `Discount (10%): −MYR X.XX`(红色),客户看得到原价和被折扣的额度。

### 5.2 RLS 策略

所有 8 张表都启用 RLS,policy 是"authenticated 用户全权限"(flat 模型,内部 10 人以下)。
Storage buckets `receipts` 和 `pdfs` 也是 authenticated only。

---

## 6. 项目结构(关键文件)

```
olcc-books/
├── app/
│   ├── (app)/                       # 受认证保护的所有页面
│   │   ├── layout.tsx               # auth gate + 白名单 check
│   │   ├── dashboard/               # 总览 (stat cards + 图表 + reminder)
│   │   ├── transactions/            # 收支记录 + OCR 扫描入口
│   │   ├── invoices/                # 开发票 (CRUD + PDF + email + markPaid)
│   │   ├── receipts/                # 收据 (CRUD + PDF + email,自动从 invoice 级联)
│   │   ├── recurring/               # 我们付的月费
│   │   ├── subscriptions/           # 客户付我们的月费 (v2 新)
│   │   ├── eduflow/                 # EduFlow 客户 1 分钟 onboard
│   │   ├── claims/                  # 员工报销
│   │   └── settings/                # 改公司资料/银行/白名单
│   ├── auth/                        # /auth/login /auth/callback 等
│   └── api/
│       ├── cron/daily-reminders/    # Vercel Cron 入口
│       └── ocr/parse-receipt/       # Gemini OCR API
├── components/
│   ├── Sidebar.tsx                  # 左侧 nav
│   ├── TopBar.tsx                   # 顶部标题 + 语言切换 + 登出
│   ├── LangProvider.tsx             # i18n context
│   ├── charts/                      # MonthlyBarChart + CategoryPieChart
│   ├── RecentTransactionsList.tsx
│   └── ui/                          # shadcn 元件(Button/Dialog/Input 等)
├── lib/
│   ├── supabase/                    # createClient (browser + server)
│   ├── queries/                     # 服务端 SELECT 帮手
│   ├── pdf/                         # InvoicePDF + ReceiptPDF + render.ts
│   ├── email.ts                     # Resend 包装 + 4 个 send 函数
│   ├── numbering.ts                 # INV-XXXX / RCP-XXXX 自动编号
│   ├── eduflow-plans.ts             # 3 个 plan 常量
│   ├── categories.ts                # Transaction / Claim 分类常量
│   ├── recurring-utils.ts           # 共享日期 + urgency 工具
│   ├── format.ts                    # 货币 + 日期格式化
│   ├── types.ts                     # 全部表的 TS 类型
│   └── i18n.ts                      # zh + en dict
├── supabase/migrations/             # SQL 历史
├── middleware.ts                    # 把所有未认证请求重定向 /auth/login
│                                    # (已排除 /api/cron + 静态资源)
├── vercel.json                      # Cron 配置
├── tailwind.config.ts               # 颜色 + JIT content 路径
├── next.config.ts                   # cacheComponents: false + turbopack.root + serverExternalPackages
├── package.json                     # dev 用 `next dev --webpack`(不用 Turbopack)
├── OPERATIONS.md                    # 给用户的操作手册
└── HANDOVER.md                      # 你正在读
```

---

## 7. 已完成的 13 个 Phase

| Phase | 内容 | 关键文件 |
|---|---|---|
| 1 | Scaffold Next.js + Supabase + Tailwind | `package.json` `next.config.ts` `tailwind.config.ts` `globals.css` |
| 2 | DB schema migrations | `supabase/migrations/0001_init.sql` |
| 3 | i18n + 主题 + sidebar/topbar 框架 | `components/Sidebar.tsx` `lib/i18n.ts` |
| 4 | .env + 常量 + 共享 helpers | `lib/format.ts` `lib/categories.ts` |
| 5 | Transactions CRUD + 月度汇总 | `app/(app)/transactions/*` |
| 6 | Recurring + Subscriptions + Mark Paid 级联 | `app/(app)/recurring/*` `app/(app)/subscriptions/*` |
| 7 | Dashboard 升级:stat cards + Recharts 柱图/donut + recent | `app/(app)/dashboard/*` `components/charts/*` |
| 9 | **Invoices + Receipts + PDF + Email + Mark Paid 级联** | `app/(app)/invoices/*` `app/(app)/receipts/*` `lib/pdf/*` `lib/email.ts` |
| 11 | **Vercel Cron 每日提醒邮件** | `vercel.json` `app/api/cron/daily-reminders/route.ts` |
| 13 | **EduFlow 1 分钟 onboard 助手**(开 invoice + 建 subscription) | `app/(app)/eduflow/*` `lib/eduflow-plans.ts` |
| 8 | **Claims 报销 pending→approved→paid 工作流** | `app/(app)/claims/*` |
| 12 | **Settings 自助页**(公司/银行/编号/白名单) | `app/(app)/settings/*` |
| 10 | **OCR 拍收据 → Gemini → 自动填 transaction** | `app/api/ocr/parse-receipt/route.ts` |

### 上线后追加(Phase 13 之后的 patch,非编号 phase)

| 升级 | 内容 | 关键文件 |
|---|---|---|
| 全双语 | 所有弹窗/表单/按钮/确认框/状态徽章 i18n 化(~200 keys) | `lib/i18n.ts` + 18 个 client 组件 |
| Plan 卡翻译 | EduFlow 三个 plan 的 audience/features/label 双语 | `lib/i18n.ts` `EduFlowClient.tsx` |
| Manifest + icon | PWA manifest + apple-icon,手机加桌面用公司 logo | `app/manifest.ts` `public/icon.png` |
| **Discount(金额版)** | invoices/receipts 加固定金额折扣 | `0005_add_discount.sql` |
| **Discount(% 版)** ← 最新 | 折扣改百分比;Subscriptions 持久折扣每期自动套用;Subscription Mark Paid 改走 Receipt 级联 | `0006_discount_percent.sql` + invoices/receipts/subscriptions/eduflow actions + 两个 PDF + 表单 |

每个 Phase / patch 的 commit message 在 `git log` 里完整写了背景。

---

## 8. 跟 v1 (Apps Script) 比

| 模块 | v1 | v2 | 升级 |
|---|---|---|---|
| Auth | 自家 password (`Auth.gs`) | Google OAuth + 白名单 | ✅ |
| Transactions | ✅ | ✅ + OCR | ✅ |
| Recurring | ✅ | ✅ | = |
| Subscriptions | ❌ | ✅ | 🆕 v2 新模块 |
| Claims | ✅ | ✅ | = |
| Invoices | ✅(Google Docs 模板) | ✅(React-PDF) | 速度 5× |
| Receipts | ✅ | ✅ | = |
| OCR | ✅ Upgrade 1 | ✅ | = |
| Email reminders | ✅(Apps Script trigger) | ✅(Vercel Cron) | = |
| Dashboard | 简单数字 | ✅ Recharts 图表 + 提醒卡 | ✅ |
| EduFlow onboard | ❌ | ✅ | 🆕 |
| Settings 页 | 部分(Spreadsheet 改) | ✅ 完整 in-app | ✅ |
| 部署 | Apps Script Web App | Vercel serverless | 速度 + 可扩展 |

---

## 9. 关键架构决策(为什么这么做)

### 9.1 Webpack vs Turbopack
本地 `npm run dev` 用 `--webpack`(`package.json` 里 `dev` script)。
原因:Turbopack 在 Windows 上吃 RAM 凶(~2GB),用户机器 16GB 但 Chrome 占大头,跑 Turbopack 会卡死整机。Webpack 稳。
Vercel build 时 Next 16 自动用 Turbopack 远端,无影响。

### 9.2 cacheComponents: false
Next 16 Cache Components 严格要求 async server component 套 `<Suspense>`。我们 auth redirect 用 `getClaims()`,改 Suspense 工作量大,先关。
日后可重启: `cacheComponents: true` 然后每个 layout/page 加 Suspense。

### 9.3 PDF 用 React-PDF 而不是 puppeteer
React-PDF 完全 Node 端 + 小,puppeteer 要 headless chromium 太大。serverless 函数有 50MB 限制(Hobby),React-PDF 用 `serverExternalPackages` 不打包进 bundle 里能压下来。

### 9.4 Receipt 是 income 唯一入口
所有 income 必须经过 Receipt 表(invoice/subscription mark paid → cascade receipt → cascade transaction)。
好处:无双重计数,审计简单,客户每次都拿得到 PDF 收据。
现状:invoices **和** subscriptions 都走 Receipt 路径了(discount-% 升级时统一)。

### 9.5 Allowed emails 白名单 vs Supabase RLS
Supabase Google OAuth 任何 Google 账号都能登录,所以加 `allowed_emails` 应用层白名单。layout.tsx 检查;表为空时第一个登录的可以进去(自助 bootstrap)。

### 9.6 Cron auth 用 Bearer + middleware 跳过
Vercel Cron 用 `Authorization: Bearer ${CRON_SECRET}` 调 `/api/cron/*`。
middleware 的 matcher 排除 `api/cron`,否则 Supabase session check 把 cron 重定向到 /auth/login。

---

## 10. 已知 backlog / 未做

| 项 | 状态 | 优先级 |
|---|---|---|
| Resend domain verify(目前沙箱,只能发到 cdcheng94@gmail.com) | 待做 | **客户多了必做** |
| 自定义 `RESEND_FROM` env 到正式域名 | 待做 | 跟上面捆绑 |
| Subscription 自动 mark paid(目前到期还是要手动点 ✓;客户真的转账后才点) | 待考虑 | 中 |
| 自动发 receipt 邮件给客户(目前 mark paid 生成 receipt 但不自动发,要手动点 ✉) | 待做 | 中 |
| `middleware.ts` deprecation → Next 16 改 `proxy.ts` | Next 16 deprecation warning | 低,不影响功能 |
| Mark Paid invoice 后,PDF 还显示 DRAFT(因为 pdf_url cache 没失效) | 已知小 bug | 低 |
| 月度 / 年度报表(P&L) | 没做 | 中 |
| 数据导出 CSV / Excel | 没做 | 低 |
| 多公司支持(目前只 OLCC Technology 一家) | 没做 | 长期 |
| Stripe Checkout 自动收 EduFlow 客户款 | 没做 | 客户达到 20+ 单时上 |
| EduFlow tenant 状态 dashboard(哪些客户健康/即将到期 / MRR) | 没做 | 长期 |
| Dashboard "Quick Add" 按钮(顶部快捷开 income/expense) | 没做 | 低 |
| 操作日志 / audit log | 没做 | 中(合规需要) |
| Discount 可叠加固定金额 + %(目前只 %) | 没做 | 低 |
| PDF line item 名称中文化(目前 EduFlow line item 永远英文) | 没做 | 低 |

---

## 11. 怎么改代码 + 部署

### 11.1 本地开发

```powershell
cd "D:\CLAUDE workspace\olcc-books"
npm install      # 第一次
npm run dev      # 默认用 webpack + Node memory 限 2GB
```

打开 http://localhost:3000 → 用 cdcheng94@gmail.com 登录。

⚠️ **跑 dev 之前关 Chrome 大部分 tab**,内存留 ≥4GB 给 Node + Chrome。

### 11.2 改完推送

```powershell
git add -A
git commit -m "<什么改了 + 为什么>"
git push
```

→ Vercel 1-3 分钟自动 build + 上线。看 https://vercel.com/cdcheng94-sudo/olcc-books/deployments

### 11.3 测试上线版

直接打开 https://olcc-books.vercel.app 测。**Hobby 计划没 staging**。

如果想 PR 流程:
1. `git checkout -b feat/xxx`
2. `git push -u origin feat/xxx`
3. Vercel 自动给 PR 一个 preview URL,测好再 merge main

---

## 12. 常见运维操作

### 12.1 加 / 删团队成员

走 `/settings` UI 即可,见 OPERATIONS.md §0。

### 12.2 改公司资料 / 银行 / Logo

走 `/settings` UI。改完 PDF/email 立即反映。

### 12.3 重置 invoice / receipt 编号

`/settings` → Document numbering → "Next invoice no." 改成 1 → Save。

### 12.4 清空数据库(测试用)

Supabase SQL Editor 跑:
```sql
delete from public.transactions;
delete from public.receipts;
delete from public.invoices;
delete from public.claims;
delete from public.recurring;
delete from public.subscriptions;
update public.settings set value = '1' where key = 'next_invoice_seq';
update public.settings set value = '1' where key = 'next_receipt_seq';
```

不会动 `settings` 公司资料 + `allowed_emails`。

### 12.5 手动触发 cron(测试)

```powershell
curl.exe -H "Authorization: Bearer <CRON_SECRET>" https://olcc-books.vercel.app/api/cron/daily-reminders
```

正常返回 `{"ok":true,...}` JSON。

### 12.6 看 Vercel logs

https://vercel.com/cdcheng94-sudo/olcc-books → 顶部 **Functions** tab → 选某个 invocation 看日志。

---

## 13. 紧急联络 / 责任分工

| 角色 | 负责 |
|---|---|
| 老板 (Cheng Dian, cdcheng94@gmail.com) | 业务决策 + 用户层操作 |
| Partner | 业务支援 + 用户层操作 |
| 开发员 (Cheng Dian 兼) | 改代码 + Vercel + Supabase 后台 |

外部账号密码不应放这里。需要时进 1Password / 同步密码本。

---

## 14. 最后

OLCC Books v2 从 0 到上线一气呵成,所有 Phase 1-13 完成,正式启用 ready。

下次接手:
1. 读 OPERATIONS.md 知道怎么用
2. 读这份 HANDOVER.md 知道怎么改 + 维护
3. `git clone` + `npm install` + 拿 `.env.local` 模板填 env → `npm run dev` 即跑
4. 任何不清楚的看 git log,commit message 都尽量写"为什么"

祝顺利 🚀
