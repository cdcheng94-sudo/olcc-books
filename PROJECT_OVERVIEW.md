# OLCC Books v2 — 项目总览(讨论用快照)

> 这是一份**自包含**的项目现状快照,方便拿去任何地方讨论。
> 涵盖:这是什么、技术栈、所有功能模块的当前行为、EduFlow 定价 + 折扣逻辑、已完成、待讨论的开放问题。
>
> **最后更新:** 2026-06-03

---

## 1. 这是什么

**OLCC Books** 是 OLCC Technology Sdn Bhd(马来西亚 Johor Bahru 的科技公司)的内部财务/记账系统。

- 是公司 v1(Google Apps Script + Google Sheet)的**完整重写版**,迁到现代 Web 技术栈。
- 同时承担一个重要业务:追踪 **EduFlow**(公司卖给补习中心/学校的 SaaS 产品)客户的月费 + 收款。

**生产地址:** https://olcc-books.vercel.app(Google 登录,白名单制,内部 ≤10 人用)
**代码:** https://github.com/cdcheng94-sudo/olcc-books(Private)

---

## 2. 技术栈

| 层 | 技术 |
|---|---|
| 框架 | Next.js 16(App Router)+ React 19 + TypeScript |
| UI | Tailwind CSS + shadcn/ui,自定义 navy + gold 主题,中英双语 |
| 数据库 | Supabase Postgres(8 张表 + flat RLS) |
| 登录 | Supabase Auth + Google OAuth + `allowed_emails` 白名单 |
| 文件 | Supabase Storage(收据图 + 生成的 PDF) |
| 邮件 | Resend(目前沙箱模式) |
| PDF | @react-pdf/renderer(服务端渲染 invoice/receipt) |
| 图表 | Recharts |
| OCR | Gemini 2.0 Flash(拍收据自动填) |
| 部署 | Vercel(自动 CI/CD + Cron 定时任务) |

---

## 3. 功能模块(9 个 + 当前行为)

### 3.1 Dashboard(总览)
- 本月 Income / Expense / Net 三张卡
- 近 6 月收支柱状图(绿收入 + 红支出)
- 本月支出分类饼图
- 最近 8 笔交易
- **To Collect**(客户要付我们的)+ **To Pay**(我们要付的),按到期紧急度排序、颜色区分

### 3.2 Transactions(收支记录)
- 手动记 income / expense,可附收据图
- **OCR 拍收据自动填**(Gemini)
- 月份 / 类型 / 分类 筛选

### 3.3 Invoices(发票)
- 完整 CRUD,生命周期 Draft → Sent → Paid
- 生成专业 PDF(navy 抬头 + 公司资料 + 银行 info)
- 邮件发客户(PDF 附件)
- **Mark Paid → 自动级联** 开 Receipt + 入账 income
- 支持**折扣(%)** — 见 §4

### 3.4 Receipts(收据)
- 自动从 invoice Mark Paid 产生,或手动开(现金销售)
- 绿色 "PAID" 印章 PDF
- 每张 receipt 自动入账一笔 income transaction(**唯一的收入入账路径**,防双重计数)

### 3.5 Recurring(我们付的定期支出)
- 房租/薪水/软件订阅等
- Mark Paid → 自动入账 expense + 到期日往后推

### 3.6 Subscriptions(客户付我们的月费)— v2 新模块
- 追踪每个客户的月度/季度/年度订阅
- **支持持久折扣(%)** — 设一次,每期自动套用,见 §4
- WhatsApp / Email 一键催费(预填消息)
- Mark Paid → **经 Receipt 级联** → 客户拿到 PDF 收据 + 入账 income + 到期日推后

### 3.7 EduFlow(客户 onboard 助手)— v2 新模块
- 卖 EduFlow 时,一个表单 1 分钟开通新客户
- 见 §5

### 3.8 Claims(员工报销)
- pending → approved → paid 工作流
- Mark Paid → 自动入账 expense

### 3.9 Settings(公司设置)
- 改公司资料 / 银行 info / 发票编号 / 货币 / 税率
- 管理登录白名单(加/删团队成员)

### 自动化
- **每天 09:00(马来时间)Vercel Cron 自动:**
  - 扫到期的 Subscriptions → 邮件催客户
  - 扫到期的 Recurring → 合并 digest 邮件提醒内部

---

## 4. 折扣(Discount)逻辑 — **百分比制**

> ⚠️ 这是最近刚改的重点,讨论时注意。

- discount 是**百分比(0–100%)**,不是固定金额。
- **公式:** `总额 = 小计 − (小计 × 折扣% ÷ 100) + 税`
- 适用于:**Invoices、Receipts、Subscriptions** 都有 discount_percent 字段。
- **Subscriptions 的折扣是持久的**:设一次,以后每期 Mark Paid 自动套用,客户每月账单都显示折扣。
- **PDF 显示:** `Subtotal → Discount (10%): −MYR X.XX(红色)→ Tax → TOTAL`,客户看得到原价 + 被折扣的额度,有"被优惠到"的感觉。
- UI 上输入折扣 % 时,实时预览折后金额。

---

## 5. EduFlow 产品定价 + onboard 流程

### 5.1 三个套餐(对外卖给补习中心/学校)

| 套餐 | 月费 | 安装费(一次性) | 首月免费 | 适合 |
|---|---|---|---|---|
| Starter / 入门版 | RM 180 | RM 1,800 | 否 | ≤ 50 学生 · 1 老板 + 2-3 老师 |
| Professional / 专业版 ⭐ | RM 320 | RM 3,500 | **是** | 50–200 学生 · 4-10 老师 |
| Enterprise / 企业版 | RM 580 起 | RM 6,000 起 | 否 | 200+ 学生 · 多分院 · 客制 |

(套餐功能列表见网站 / `lib/eduflow-plans.ts`,可改。)

### 5.2 onboard 一个新客户(1 分钟)

`/eduflow` → 选套餐 → 填客户(名/email/电话/起始日)→ 可设**折扣 %** → 提交。

系统自动:
1. 开一张**首期 invoice**(安装费 + 首月,若非首月免费)
2. 建一行**月度 subscription**(下次扣款 = 起始日 + 1 月)
3. 折扣 % **同时**应用到首期 invoice **和**每月订阅
4. 跳到 Invoices 页,可直接邮给客户

之后每月客户到期自动出现在 Dashboard "To Collect",一键催费 → 客户付 → Mark Paid 自动入账 + 出收据。

---

## 6. 数据流核心设计

```
收入(income)唯一入账路径:
  Invoice  ──Mark Paid──▶ Receipt ──▶ income transaction
  Subscription ─Mark Paid─▶ Receipt ──▶ income transaction
  手动 Receipt ───────────▶ income transaction

支出(expense):
  手动 Transaction(可 OCR)
  Recurring  ──Mark Paid──▶ expense transaction
  Claim      ──Mark Paid──▶ expense transaction
```

所有 income 必经 Receipt → 无双重计数,审计简单,客户每次都拿得到 PDF 收据。

---

## 7. 已完成(全部上线)

- ✅ 9 个功能模块(上面 §3 全部)
- ✅ 中英双语(所有页面/弹窗/按钮/确认框,~200 翻译键)
- ✅ Discount(% 制)+ Subscription 折扣每期自动套用
- ✅ PDF 生成 + 邮件发送
- ✅ OCR 拍收据
- ✅ 每日自动催费邮件(Cron)
- ✅ 手机可加桌面(PWA,公司 logo)
- ✅ Vercel 自动部署 + GitHub 备份
- ✅ 完整文档(OPERATIONS.md 操作手册 + HANDOVER.md 技术交接)

---

## 8. 待讨论 / 开放问题(拿去 chat 重点看这里)

| 项 | 现状 | 备注 |
|---|---|---|
| **Resend 域名验证** | 沙箱模式,只能发到 cdcheng94@gmail.com | 客户多了**必须**先 verify 一个公司域名才能群发真客户 |
| **Subscription 自动收款** | 到期还是手动点 Mark Paid(客户真转账后才点) | 要不要接 Stripe 自动收款?门槛:Stripe MY 商户号 + EduFlow 网站加 Checkout |
| **自动发 receipt 邮件** | Mark Paid 生成 receipt 但不自动发,要手动点 ✉ | 要不要 Mark Paid 后自动邮收据给客户? |
| **EduFlow 客户健康 dashboard** | 没做 | 哪些客户即将到期 / 已流失 / MRR 趋势 |
| **月度/年度 P&L 报表** | 没做 | 会计需要 |
| **数据导出 CSV/Excel** | 没做 | 给会计师 |
| **多公司支持** | 只 OLCC 一家 | 如果将来要白标卖给别人用 |
| **折扣叠加** | 目前只 %,不能同时固定金额 + % | 一般用不到 |
| **PDF line item 中文** | EduFlow 发票项目名永远英文 | 客户多是英文沟通,暂不影响 |
| **操作日志 audit log** | 没做 | 合规 / 多人协作追溯 |

---

## 9. 想改/加功能怎么做

代码在 GitHub,改完 `git push` → Vercel 2 分钟自动上线。
Schema 改动有对应的 `supabase/migrations/*.sql`,在 Supabase SQL Editor 手动跑。
详细开发/运维流程见 `HANDOVER.md`。
