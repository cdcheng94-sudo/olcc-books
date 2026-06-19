# OLCC Books v2 — 项目总览(讨论用快照)

> 这是一份**自包含**的项目现状快照,方便拿去任何地方讨论(包括拿去跟 AI 聊"要不要改造整个系统")。
> 涵盖:这是什么、技术栈、所有功能模块的当前行为、EduFlow 定价 + 折扣逻辑、资本池、Drive 集成、客户关怀、已完成、待讨论的开放问题。
>
> **最后更新:** 2026-06-18

---

## 1. 这是什么

**OLCC Books** 是 OLCC Technology Sdn Bhd(马来西亚 Johor Bahru 的科技公司)的内部财务/记账系统。

- 是公司 v1(Google Apps Script + Google Sheet)的**完整重写版**,迁到现代 Web 技术栈。
- 同时承担一个重要业务:追踪 **EduFlow**(公司卖给补习中心/学校的 SaaS 产品)客户的月费 + 收款 + **售后关怀**。

**生产地址:** https://olcc-books.vercel.app(Google 登录,白名单制,内部 ≤10 人用)
**代码:** https://github.com/cdcheng94-sudo/olcc-books(Private)
**状态:** 已上线,正在录入真实账目。

---

## 2. 技术栈

| 层 | 技术 |
|---|---|
| 框架 | Next.js 16(App Router,Server Actions)+ React 19 + TypeScript |
| UI | Tailwind CSS + shadcn/ui,自定义 navy + gold 主题,**中英双语**(默认英文) |
| 数据库 | Supabase Postgres(约 11 张表 + flat "authenticated all" RLS) |
| 登录 | Supabase Auth + Google OAuth + `allowed_emails` 白名单 |
| 文件 | **双存储**:Supabase Storage(系统生成的 invoice/receipt PDF + 公司 logo)+ **Google Drive**(用户上传的收据照片/PDF,见 §7) |
| 邮件 | **Resend(已验证公司域名,可真正发客户)**,见 §8 |
| PDF | @react-pdf/renderer(服务端渲染 invoice/receipt) |
| 图表 | Recharts |
| OCR | Gemini 2.0 Flash(拍收据自动填) |
| 部署 | Vercel(自动 CI/CD + 每日 Cron) |

---

## 3. 功能模块(11 个 + 当前行为)

### 3.1 Dashboard(总览)
- **顶部三栏等宽提醒卡(最需要注意的事,放最上面):**
  - **To Collect**(客户要付我们的,逾期/紧急排前)
  - **To Pay**(我们要付的定期支出)
  - **Customers to check in**(该做售后关怀的客户)
- 资金池卡:Capital Pool / Operating Pool / 总可用资金(见 §6)
- 本月 Income / Expense / Net 三张卡(仅营运/P&L)
- 近 6 月收支柱状图、本月支出分类饼图、最近 8 笔交易

### 3.2 Transactions(收支记录)
- 手动记交易,**7 种类型**(见 §6 资本池)
- **收据上传到 Google Drive**(见 §7):新建时附图、或对已有行点「补传」
- **OCR 拍收据自动填**(Gemini)→ 识别后保存时才把图传 Drive
- 月份 / 类型(多选)/ 分类 筛选,7 色 type badge
- 删交易会**连带删除 Drive 上的凭证**

### 3.3 Invoices(发票)
- 完整 CRUD,生命周期 Draft → Sent → Paid
- 生成专业 PDF(navy 抬头 + 公司资料 + 银行 info)+ 邮件发客户
- **Mark Paid 弹窗**:选付款方式、**收款日期**(可填实际收款日,不一定今天)、**可上传客户付款凭证**(转账截图 → Drive,挂到那笔收入交易上)
- Mark Paid → **自动级联** 开 Receipt + 入账 income
- 支持**折扣(%)** — 见 §4

### 3.4 Receipts(收据)
- 自动从 invoice / subscription Mark Paid 产生,或手动开(现金销售)
- 绿色 "PAID" 印章 PDF
- 每张 receipt 自动入账一笔 income transaction(**唯一的收入入账路径**,防双重计数)

### 3.5 Recurring(我们付的定期支出)
- 房租/薪水/软件订阅等;Mark Paid → 自动入账 expense + 到期日往后推
- 到期进 Dashboard "To Pay" + 每日 digest 邮件提醒内部

### 3.6 Subscriptions(客户付我们的月费)
- 追踪每个客户的月度/季度/年度订阅
- **支持持久折扣(%)**:设一次,每期自动套用,见 §4
- WhatsApp / Email 一键催费(预填消息)
- Mark Paid → **经 Receipt 级联** → 客户拿到 PDF 收据 + 入账 income + 到期日推后
- **催费邮件按里程碑发**(不再天天发):到期前 `remind_days_before` 天、3 天、当天各一封,见 §8

### 3.7 Customer Care(客户关怀)— **v2 最新模块,见 §9**
- 提醒团队**主动关心**订阅客户,降低流失
- 每个 active 订阅一行:健康度、上次/下次关怀、一键「记录关怀」
- 新订阅自动排「开通后 7 天」首次关怀

### 3.8 EduFlow(客户 onboard 助手)
- 卖 EduFlow 时一个表单 1 分钟开通新客户,见 §5

### 3.9 Claims(员工报销)
- pending → approved → paid 工作流;**收据上传 Google Drive**(同 Transactions)
- **Mark Paid 弹窗**:默认记营运支出(Operating Pool);可勾选「资本性支出」→ 记 capital_expense(Capital Pool)+ 选资本分类

### 3.10 Capital(资本)— 见 §6
- 把"股东资金"和"经营资金"分成两个资金池;只读报表页,所有录入在 Transactions

### 3.11 Settings(公司设置)
- 改公司资料 / 银行 info / 发票 + 收据编号(可重置)/ 货币 / 税率
- 管理登录白名单(加/删团队成员)

### 自动化(每天 09:00 马来时间,Vercel Cron)
- 扫到期的 Subscriptions → **按里程碑**邮件催客户(7/3/当天)
- 扫到期的 Recurring → 合并 digest 邮件提醒内部(发到公司 email)

---

## 4. 折扣(Discount)逻辑 — **百分比制**

- discount 是**百分比(0–100%)**,不是固定金额。
- **公式:** `总额 = 小计 − (小计 × 折扣% ÷ 100) + 税`
- 适用于:**Invoices、Receipts、Subscriptions**(都有 discount_percent 字段)。
- **Subscriptions 的折扣是持久的**:设一次,以后每期 Mark Paid 自动套用。
- **PDF 显示:** 折扣行用**红色**、原价**划横线删除**,客户看得到原价 + 被优惠额度。
- EduFlow onboard 时可分开设「月费折扣」和「安装费折扣」两个 %。

---

## 5. EduFlow 产品定价 + onboard 流程

### 5.1 三个套餐(对外卖给补习中心/学校)

| 套餐 | 月费 | 安装费(一次性) | 首月免费 | 适合 |
|---|---|---|---|---|
| Starter / 入门版 | RM 180 | RM 1,800 | 否 | ≤ 50 学生 · 1 老板 + 2-3 老师 |
| Professional / 专业版 ⭐ | RM 320 | RM 3,500 | **是** | 50–200 学生 · 4-10 老师 |
| Enterprise / 企业版 | RM 580 起 | RM 6,000 起 | 否 | 200+ 学生 · 多分院 · 客制 |

### 5.2 onboard 一个新客户(1 分钟)

`/eduflow` → 选套餐 → 填客户 → 可设折扣 % → 提交。系统自动:
1. 开一张**首期 invoice**(安装费 + 首月,若非首月免费)
2. 建一行**月度 subscription**(下次扣款 = 起始日 + 1 月)+ 自动排首次客户关怀(+7 天)
3. 折扣 % 同时应用到首期 invoice 和每月订阅
4. 跳到 Invoices 页,可直接邮给客户

---

## 6. 资本池:股东资金 vs 经营资金(税务正确)

> ⚠️ 股东借钱给公司周转、股本、还款等**不是收入也不是经营支出**,必须独立于 P&L 之外,否则会被错算进利润交税。

### 6.1 交易 7 种类型

| 类型 | 性质 | 影响 |
|---|---|---|
| `income` 经营收入 | 经营 | Operating Pool ↑,**进 P&L** |
| `expense` 经营支出 | 经营 | Operating Pool ↓,**进 P&L** |
| `shareholder_loan` 股东借款 | 资本(债) | Capital Pool ↑,**不进 P&L**;要还、可能有利息 |
| `capital_injection` 股本 | 资本(股权) | Capital Pool ↑,**不进 P&L**;不还、影响股权 |
| `capital_expense` 资本性支出 | 资本 | Capital Pool ↓,**不进 P&L** |
| `loan_repayment` 股东还款 | 资本 | Capital Pool ↓,**不进 P&L** |
| `interest_paid` 付利息 | 经营 ⚠️ | **Operating Pool ↓**,**进 P&L**(利息可税前扣除) |

> 🔑 **最易错点:付利息虽给股东,但算经营成本 → 扣 Operating Pool + 进 P&L;只有还本金扣 Capital Pool。**

### 6.2 公式
```
Capital Pool   = 股东借款 + 股本 − 资本性支出 − 还款
Operating Pool = 收入 − 支出 − 付利息
公司总可用资金  = Capital Pool + Operating Pool
```

### 6.3 借款 vs 股本
- **股东借款**:债,要还,累积 Outstanding,可能有利息,**不影响股权**。还款不能超 Outstanding(护栏)。
- **股本**:股权,不还、无利息、不算 Outstanding,影响持股。
- /capital 页:3 卡(Total Borrowed / Repaid / Outstanding)+ 6 tab,只读。

---

## 7. Google Drive 集成(用户上传的凭证归档)

> 目的:把员工拍的收据/转账截图集中归档到公司 Google Drive,跟系统生成的 PDF 分开。

- **分工:** 系统生成的 invoice/receipt PDF + 公司 logo → 留在 **Supabase Storage**;**用户上传的收据照片/PDF → Google Drive**。
- **归档账号:** chengdian@yesteaching.com(Google Workspace),scope 用 `drive.file`(app 只能碰自己建的文件)。
- **目录结构:** `OLCC Books / {年份} / {Receipts | Claims | Capital}`,文件名 `{日期}_{类型}_{对方}_{短id}`。
- **哪里能传:** Transactions、Claims 的表单(新建附图)+ 每行「补传」按钮;发票 Mark Paid 时上传客户付款凭证。
- **元数据表 `drive_files`** 记 fileId / webViewLink / 关联表+id,删交易/报销时连带删 Drive 文件。
- **容错:** Drive 挂了(授权失效/容量满/断网)交易照样保存成功,只提示「可稍后补传」,授权/容量类故障还会邮件提醒;绝不让 Drive 失败拖垮记账。

---

## 8. 邮件(Resend,已验证域名)

- **发信域名:** `send.olcctechnology.com`(Resend,Tokyo 区),DNS 在 Squarespace(DKIM/SPF/MX 已验证 ✅)。
- **From:** `OLCC Technology <noreply@send.olcctechnology.com>`;**Reply-To:** `developer@olcctechnology.com`(客户回复进公司邮箱)。
- **已脱离沙箱**,可真正群发真实客户邮箱。
- 用途:发票/收据 PDF、订阅催费、内部 Recurring digest、Drive 故障告警。
- **订阅催费按里程碑:** 到期前 `remind_days_before`(默认 7)、3 天、当天各一封,不再每天刷屏。
- 账号备注:Resend / 域名 / Vercel 等都已从旧的 `olcctechnology@gmail.com` 迁到 `developer@olcctechnology.com`(旧 Gmail 弃用)。

---

## 9. 客户关怀(Customer Care)— 最新模块

> OLCC 卖 EduFlow 给补习中心,客户通常不会主动反映问题 → 不主动跟进就会默默流失。这个模块提醒**我们自己**去关心客户(对内),区别于催客户付款(对外)。

- **锚点:** active 订阅(一个付费客户一行)。独立侧边栏页「客户关怀」。
- **排程:** 新订阅 → 开通后 7 天首次关怀;每次记录关怀时**选下次间隔**(7 / 14 / 30 / 90 天)。
- **健康度:** 健康 / 留意 / 有风险(徽章,逾期/有风险排前)。
- **记录关怀弹窗:** 日期、方式(电话/WhatsApp/上门/邮件)、健康度、**客户反馈**、下次间隔 → 存进 `check_ins` 历史 + 自动推进下次日期。
- **Dashboard:** 顶部「该关心的客户」卡(到期/逾期的)。
- **数据:** `subscriptions` 加 next_checkin_date / checkin_interval_days / health;新 `check_ins` 表存每次记录(migration `0010`)。
- **未做(Phase 2):** ① 点客户看**历史关怀记录**的 UI(数据已存,差界面)② 到期发团队提醒邮件 ③ 流失风险/MRR 统计。

---

## 10. 数据流核心设计

```
收入(income)唯一入账路径:
  Invoice      ──Mark Paid──▶ Receipt ──▶ income transaction
  Subscription ──Mark Paid──▶ Receipt ──▶ income transaction
  手动 Receipt ───────────────▶ income transaction

支出(expense):
  手动 Transaction(可 OCR)
  Recurring ──Mark Paid──▶ expense transaction
  Claim     ──Mark Paid──▶ expense(默认)或 capital_expense(勾资本)

资本类(不进 P&L):直接在 /transactions 录,无级联
```
所有 income 必经 Receipt → 无双重计数,审计简单,客户每次都拿得到 PDF 收据。

---

## 11. 已完成(全部上线)

- ✅ 11 个功能模块(含资本池、Drive 集成、客户关怀)
- ✅ 中英双语(所有页面/弹窗/按钮/确认框)
- ✅ Discount(% 制,红字 + 划线)+ Subscription 折扣每期自动套用
- ✅ 资本/经营双资金池 + 股东借款/股本拆分(税务正确)
- ✅ **用户凭证归档 Google Drive**(系统 PDF 仍在 Supabase)
- ✅ **邮件域名验证,可真发客户** + reply-to + 旧账号清理
- ✅ 发票 Mark Paid 弹窗(收款日期 + 付款凭证);报销 Mark Paid(营运/资本选择)
- ✅ 订阅催费里程碑制(不刷屏)
- ✅ **客户关怀系统**(关怀提醒 + 健康度 + 反馈记录)
- ✅ PDF 生成 + 邮件发送、OCR 拍收据、每日 Cron、PWA 桌面图标
- ✅ Vercel 自动部署 + GitHub 备份

---

## 12. 待讨论 / 开放问题(拿去 chat 重点看这里)

| 项 | 现状 | 备注 |
|---|---|---|
| **客户关怀历史记录 UI** | 数据已存 `check_ins`,但没界面看历史 | Phase 2,优先级高,做起来快 |
| **客户关怀团队提醒邮件** | 只在 Dashboard 显示 | 要不要到期发 digest 给团队? |
| **EduFlow 客户健康 / MRR 趋势** | 只有单客户健康度,无整体统计 | 流失率、MRR、即将到期总览 |
| **利息自动计算** | interest_rate 字段存了但不算,靠手动录 | 要不要按借款利率 + 期间自动算应付利息? |
| **资本性支出护栏** | 没限制(Capital Pool 可被花成负) | 要不要加"别超支"提醒? |
| **Subscription 自动收款** | 到期手动点 Mark Paid(客户真转账后才点) | 要不要接 Stripe?门槛:Stripe MY 商户号 + EduFlow 网站 Checkout |
| **自动发 receipt 邮件** | Mark Paid 生成 receipt 但要手动点 ✉ 才发 | 要不要 Mark Paid 后自动邮收据? |
| **月度/年度 P&L 报表** | 没做 | 会计需要 |
| **数据导出 CSV/Excel** | 没做 | 给会计师 |
| **操作日志 audit log** | 没做 | 合规 / 多人协作追溯 |
| **多公司 / 白标** | 只 OLCC 一家 | 若将来卖给别人用 |
| **Resend 团队 Owner** | developer@ 是 Admin(够用),Owner 可能还是旧 Gmail | 想彻底干净再转 Owner |
| **域名所有权** | olcctechnology.com 挂在私人 Squarespace 账号 | 资产整理:转到公司账号 |

---

## 13. 想改/加功能怎么做

代码在 GitHub,改完 `git push` → Vercel ~2 分钟自动上线(失败的部署不会影响线上,仍跑旧版)。
Schema 改动有对应的 `supabase/migrations/*.sql`(最新到 `0010`),在 Supabase SQL Editor 手动跑。
详细开发/运维流程见 `HANDOVER.md` 与 `OPERATIONS.md`(注:这两份部分内容比本快照旧)。
