# OLCC Books v2 — 操作手册

> 给日常使用者(老板 + partner + 内部同事)看的。所有场景按"我要做什么"组织。

**正式地址:** https://olcc-books.vercel.app

---

## 0. 第一次用 / 加新用户

### 我是被邀请的新用户怎么登录?

1. 打开 https://olcc-books.vercel.app
2. 点 **Continue with Google**
3. 选你的 Google 账号
4. 如果看到 "No access" → 联系老板把你的邮箱加进白名单

### 怎么加新人(老板权限)

进 **Settings** → 滚到底 **Who can sign in** 区段 → 填邮箱 + 名字(可选) → 点 **Add**

⚠️ 必须是 Google 账号(Gmail 或开通了 Google Workspace 的公司邮箱),不能是 Yahoo / Hotmail / QQ 等。

### 怎么踢出某人

同一区段,那人那行右边 🗑 → 确认。**你不能踢自己**(防误操作)。

---

## 1. 卖 EduFlow 客户:1 分钟 onboard

### 场景:有新客户签了 EduFlow Professional plan

1. 左侧 sidebar 点 **EduFlow**
2. **选 Plan**(点卡片) → Starter / Professional / Enterprise
   - Professional 默认勾"First month free"(首月免费)
   - Enterprise 默认价格可改(monthly 和 setup 都可覆盖)
3. **填客户资料:**
   - Customer name(补习中心/学校名)
   - Email(必填,要邮 invoice 给他)
   - Phone(国际格式 `60123456789`,以后要 WhatsApp 催费)
   - Address(可选,会出现在 invoice PDF 上)
   - Start date:今天
   - **折扣 (%)**(可选):给客户的优惠,**百分比**。填了之后:
     - 首期 invoice 直接打折
     - **每月订阅账单都自动打这个折扣**(不用每月手动改)
4. **检查右下 summary** —— 看 invoice 会包括哪些行 + 折扣 + 总额
5. 点 **Create invoice + subscription**
6. ✅ 自动跳到 `/invoices`,新 invoice 就在最上面

### 接下来发 invoice 给客户

在 `/invoices` 找到刚创建那行:
- 点 📥 (下载图标) → 看一眼 PDF 没问题
- 点 ✉ (邮件图标) → 确认后会自动:
  - 重新生成最新 PDF
  - 邮件发到客户邮箱 + PDF 当附件
  - 状态自动从 **Draft** 变 **Sent**

### 客户转账后怎么入账

`/invoices` → 那行 → 点 ✓ (Mark Paid)
- 弹出问 Payment method(默认 Bank Transfer)→ 按 OK
- 自动级联做这 3 件事:
  - Invoice 状态变 **Paid** ✓
  - `/receipts` 自动多一张 **RCP-XXXX** 
  - `/transactions` 自动多一笔 income MYR XXX
  - Dashboard 数字立刻更新

### 💰 关于折扣(Discount)— **百分比制**

任何 invoice / receipt / subscription 都可以设折扣,**用百分比(%),不是固定金额**。

- 开 invoice 时有个 **"折扣 (%)"** 框,填 `10` 就是打 9 折。
- 计算:`总额 = 小计 − 小计×折扣% + 税`。
- PDF 上客户看得到 **原价 + 折扣 (10%): −MYR X.XX + 最终金额**,有被折扣到的感觉。
- **订阅客户(Subscriptions)的折扣是永久的** —— 设一次,以后每个月催费/收款都自动按这个 % 扣,账单每月都显示折扣。

---

## 2. 日常记账:收钱 / 花钱

### 记一笔收入(非 EduFlow 月费)

`/transactions` → **+ New** → Type 选 **Income** → 填金额 + 分类 → Save

⚠️ 保存时如果没传 receipt(收据照片),会弹"确认无收据吗?"先弹窗确认。

### 记一笔支出

`/transactions` → **+ New** → Type 选 **Expense** → 填 → Save

### 用 OCR 拍收据(可选,加速)

`/transactions` → **金边按钮 "Scan receipt"** → 选/拍一张收据照片 → 等 5-10 秒 → 表单自动填好 → 检查改一下 → Save

### 错记了想改

那行右边 ✏ (Pencil) → 改 → Save

### 错记了想删

那行右边 🗑 (Trash) → 确认

⚠️ 如果这笔是从 Receipt / Claim / Recurring 级联出来的,**应该去源头删**(删 receipt 才会一起删这笔交易),直接删 transaction 会造成账面不平。

### 看本月汇总 / 历史

`/transactions` 顶部有 Month + Type + Category 筛选。
Dashboard 也有 6 月走势柱图 + 本月分类饼图。

---

## 3. Recurring(我们付的月度固定支出)

### 场景:Adobe / Office Rent / Salary 等每月要付的

`/recurring` → **+ New Recurring** → 填:
- Name(显示用):e.g. "Adobe Creative Cloud"
- Payee:e.g. "Adobe"
- Amount + Frequency(monthly / quarterly / yearly)
- Category(下拉选 expense 分类)
- Next due date:下次扣款日
- Remind days before:几天前提醒(默认 7)

### 到期付了之后

那行点 ✓ (Mark Paid)
- 自动入账一笔 expense MYR XXX
- next_due_date 自动往后推 1 月/3 月/1 年

### 暂停 / 恢复

⏸ Pause / ▶ Activate 切换

---

## 4. Subscriptions(客户每月付我们的)

### 看谁本月要付钱

Dashboard "To Collect" 卡片,从上往下按到期紧急度排序。

### 催客户付款

`/subscriptions` → 找到那行 → 右边 4 个图标:
- 💬 WhatsApp:点击直接打开 wa.me/客户电话?text=预填消息
- ✉ Email:点击打开 mailto: 链接,带预填正文
- ✓ Mark Paid:客户付了之后点,自动入账 income
- ⏸ Pause:客户暂停服务时用

### 新增订阅时设折扣

`/subscriptions` → **+ New Subscription** → 表单里:
- **原价 (MYR)**:服务的标价
- **折扣 (%,每期自动扣)**:给这个客户的长期优惠,填了之后下面会实时显示 **原价 → −X% → 每期实收**
- 之后**每个月**催费、收款、PDF 收据都自动按这个折扣算,不用每月手动改

### 客户付了款

那行点 ✓ (Mark Paid)
- 自动按折后金额入账 income(category = Service Income)
- **自动生成一张 RCP-XXXX 收据 + PDF**(客户可邮,PDF 显示原价 + 折扣 + 实付)
- next_charge_date 推后 1 月

---

## 5. Claims(员工报销)

### 员工申请报销

`/claims` → **+ New Claim** → 填:
- Date、Claimant(谁报)、Item(报销什么)、Amount、Category
- (可选) Receipt link:Google Drive 链接

状态自动是 **Pending**(待批)。

### 老板审批

那行点 ⊕ (CircleCheck) → 状态变 **Approved**(已批)。

### 实际付款给员工

那行点 ✓ (CheckCircle2) → 状态变 **Paid**(已领)
- 自动入账一笔 expense MYR XXX (category = Other Expense)

---

## 5b. 资本 / Capital(股东资金,不进利润)

> 为什么要分开:股东借钱给公司、入股、还款这些**不是公司收入/支出**,不能算进利润交税。系统把它们独立成"资本池"。

### 录这些都在 `/transactions` → New → 选对应 Type

| 场景 | 选哪个 Type | 要填 |
|---|---|---|
| 股东借钱给公司周转(以后要还) | **股东借款** | 选股东 + 金额 |
| 股东出钱入股(不还,占股份) | **资本注入(股本)** | 选股东 + 金额 |
| 用股东的钱付装修/设备/注册费 | **资本性支出** | 分类 + 金额 |
| 公司还钱给股东 | **股东还款** | 选股东 + 金额(不能超过他未还的) |
| 公司付利息给股东 | **付利息** | 选股东 + 金额 |

### 关键概念

- **股东借款 vs 股本:** 借款要还(算欠款 Outstanding),股本不还(影响股权,不算欠款)
- **付利息特殊:** 它算**经营支出**(会进利润、可抵税),所以它减 Operating Pool,不是 Capital Pool
- **还款护栏:** 还款金额不能超过该股东"未还余额",系统会拦

### 看报表 → `/capital`(只读)

- 顶部:Total Borrowed(借款)/ Repaid(还款)/ Outstanding(未还)
- 6 个 tab:股东借款 / 资本注入 / 还款 / 资本性支出 / 利息 / **按股东汇总**
- "按股东汇总"一眼看每个股东:借了多少 / 股本多少 / 还了多少 / 还欠多少

### Dashboard 顶部「公司可用资金」

- **Capital Pool(资本池):** 股东的钱(借款 + 股本 − 资本支出 − 还款)
- **Operating Pool(经营池):** 做生意赚的(收入 − 支出 − 利息)
- 下面「本月 Income/Expense/Net」三卡是**纯经营**(标了 "Operating only"),不含资本往来

---

## 6. Receipts(自动 + 手动)

### 自动产生

每次你 Mark Paid 一张 invoice,系统自动开 RCP-XXXX,客户看到的 receipt PDF 跟 invoice PDF 同样风格(头部绿色 "PAID" 印章版)。

### 手动开(场景:现金销售,没开过 invoice 的)

`/receipts` → **+ New Receipt** → 填客户 + 项目 + Payment method + Category → Save
- 自动入账一笔 income MYR XXX

### 发 receipt 给客户

那行 ✉ (Email) → 客户收到附件 PDF。

---

## 7. Dashboard 看什么

打开就看到:
- **3 个 stat cards:** 本月 Income / Expense / Net(累计)
- **6-Month Trend:** 横向柱图,绿色 income + 红色 expense,鼠标 hover 看具体数
- **Expense by Category:** 本月支出 donut + 分类百分比
- **Recent Transactions:** 最近 8 笔,右上 "View all" 跳 /transactions
- **To Collect / To Pay:** 接下来要催的钱 + 要付的钱,带颜色彩条
  - 深红 = 已逾期
  - 红 = 3 天内
  - 黄 = 7 天内
  - 绿 = 还宽松

---

## 8. Settings(自己改资料)

进 `/settings`,4 个区段:

| 区段 | 改什么 |
|---|---|
| Company info | 公司名 / 地址 / Tax ID / 电话 / 公司 email / Logo URL |
| Bank info | 银行名 / 户名 / 户号(会显示在每张 invoice PDF) |
| Document numbering | 货币 / 默认税率 / Invoice 前缀 / Receipt 前缀 / 下一张编号 |
| Allowed emails | 谁能登录 |

⚠️ "Next invoice no." 改这个会影响**下一张** invoice 的编号。删了一堆测试数据后想让正式第一张是 INV-0001,就在这里把它调回 1。

---

## 9. 邮件每日自动提醒(已经在跑)

- **每天 09:00 (MYT)** Vercel 自动扫:
  - 哪些 Subscriptions 到 `remind_days_before` 窗口 → 自动邮件催客户
  - 哪些 Recurring 到提醒窗口 → 合并成 1 封 digest 发到 `cdcheng94@gmail.com`(可在 Settings 改公司 email)

你**不用做任何事**,自动跑。

---

## 10. 手机怎么用

手机浏览器开 https://olcc-books.vercel.app → 菜单 → "Add to Home Screen" / "添加到主屏" → 桌面有 OLCC icon → 当 app 用。

外出拍收据 → OCR 自动填(Scan receipt 按钮在手机会直接调相机) → 当场记账。

---

## 11. 常见问题

### "记错了一个数字想改"
那行右边 ✏ 直接编辑。如果已经 Mark Paid 级联出来的(比如已付的 invoice 已经产生了 receipt + transaction),**先去删源头**(invoice/receipt),系统会一起删级联出来的下游数据,然后重新录。

### "想看上个月的"
`/transactions` 顶部 Month 改一下。Dashboard 数据按当前自然月,要看历史只能去 transactions。

### "Reseed 沙箱发件"
现在邮件 from 是 `OLCC Books <onboarding@resend.dev>`(Resend 默认沙箱),只能发到 cdcheng94@gmail.com 一个邮箱(账号 verified 邮箱)。

**正式上线发给所有客户的话**,需要在 Resend 后台 verify 一个 olcc-tech.com.my 之类的域名,然后改 Settings or env var `RESEND_FROM=billing@olcc-tech.com.my` 类似的。详见 HANDOVER.md。

### "Cron 没跑 / 没收到邮件"
PowerShell 手动跑这条看返回值(把 token 替换成你的 CRON_SECRET):
```
curl.exe -H "Authorization: Bearer <CRON_SECRET>" https://olcc-books.vercel.app/api/cron/daily-reminders
```
正常返回:`{"ok":true, "subscriptions":{"considered":N,...}, ...}`

### "想看具体某天/某月报表"
还没建,在 backlog。现在可以用 `/transactions` 筛选 + Dashboard 看。

---

## 12. 紧急情况

### "我自己被踢出登录,进不去"
找 partner 进 Settings 把你重新加 allowed_emails。如果 partner 也没进 → 找开发员(Cheng Dian)直接进 Supabase Dashboard 手动加。

### "网站突然 down"
可能 Vercel 在 redeploy。等 1-2 分钟。还不行联系 Cheng Dian。

### "误删了一张 invoice / 收据"
没有 undo。要么重新建,要么去 Supabase 找未提交的事务回滚(找开发员)。
养成习惯:**删之前再看一眼**。

---

**祝顺利。有 bug 或想加功能,直接 GitHub issue 或 WhatsApp。**
