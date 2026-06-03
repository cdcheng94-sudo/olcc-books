# Google Drive 集成 — 配置步骤

> 目标:让 OLCC Books 能用一个**股东的付费 Google 账号**("OLCC 存档账号")把用户上传的凭证(收据照片/PDF)永久存到 Google Drive。
>
> 用 `drive.file` scope —— App **只能访问它自己创建的文件/文件夹**(最安全)。"OLCC Books" 根目录由 App 自动创建,**不用手动建**。

---

## ⚠️ 两个最关键的点(不照做会出问题)

1. **OAuth 发布状态必须设成 "In production"**(不是 Testing)。
   测试模式发的 refresh_token **7 天后就失效**,Drive 会每周断一次。设成 Production 才永久有效。

2. **授权时会看到"Google 未验证此应用"警告页** —— 这是正常的(个人用 `drive.file` scope 不需要 Google 审核)。点 **"Advanced / 高级" → "Go to OLCC Books (unsafe)"** 继续即可。

---

## A. Google Cloud Console 配置(你做)

### 1. 登录
用**"OLCC 存档账号"**(选定那个有空间的股东 Google 账号)登录 https://console.cloud.google.com

### 2. 新建 Project
顶部项目下拉 → New Project → 名字 `OLCC Books Drive` → Create → 切到这个项目

### 3. 启用 Google Drive API
左上 ☰ → APIs & Services → Library → 搜 **Google Drive API** → 点进去 → **Enable**

### 4. 配置 OAuth Consent Screen
☰ → APIs & Services → OAuth consent screen
- User Type:**External** → Create
- App name:`OLCC Books`
- User support email:选你的邮箱
- Developer contact:填你的邮箱
- 一路 Save and Continue
- **Scopes 那步:** Add or Remove Scopes → 手动加 `https://www.googleapis.com/auth/drive.file` → Update → Save and Continue
- Test users 那步:可加可不加(我们要发 production),Save and Continue
- 回到 OAuth consent screen 主页 → **点 "PUBLISH APP" / "Publish to production"** → 确认
  - 状态变成 **"In production"** ✅(关键!)

### 5. 建 OAuth Client ID
☰ → APIs & Services → Credentials → **+ Create Credentials → OAuth client ID**
- Application type:**Web application**
- Name:`OLCC Books Web`
- **Authorized redirect URIs → + ADD URI**:
  ```
  https://olcc-books.vercel.app/api/drive/oauth-callback
  ```
- Create
- 弹窗显示 **Client ID** 和 **Client Secret** → 都复制下来(Secret 只显示一次,存好)

---

## B. 把凭证加进 Vercel(你做)

https://vercel.com/cdcheng94-sudo/olcc-books → Settings → Environment Variables → Production
逐个 Add(全选 Production/Preview/Development):

| Name | Value |
|---|---|
| `GOOGLE_DRIVE_CLIENT_ID` | 上面拿到的 Client ID |
| `GOOGLE_DRIVE_CLIENT_SECRET` | 上面拿到的 Client Secret |
| `GOOGLE_DRIVE_OWNER_EMAIL` | 存档账号的邮箱(token 失效时通知它) |
| `DRIVE_SETUP_SECRET` | 随便一串密码,比如 `olcc-drive-2026-xyz`(等下拿 token 用) |

> `GOOGLE_DRIVE_REFRESH_TOKEN` 这个**等开发员把路由做好后**,你访问一次特殊网址才拿到,再加。先不管。

加完 **Redeploy** 一次。

---

## C. 拿 refresh_token(等路由做好后,你做一次)

开发员做完 `/api/drive/setup-token` 路由后:

1. 浏览器开:
   ```
   https://olcc-books.vercel.app/api/drive/setup-token?secret=你填的DRIVE_SETUP_SECRET
   ```
2. 跳到 Google 授权 → **用"OLCC 存档账号"登录**
3. 看到"未验证应用"警告 → Advanced → 继续(见上面关键点 2)
4. 授权 Drive 权限
5. 页面显示一串 **refresh_token** → 复制
6. 加进 Vercel:`GOOGLE_DRIVE_REFRESH_TOKEN` = 那串 → Redeploy
7. 完成!以后凭证自动存这个账号的 Drive

> 拿到后这个路由就不用了(它有 secret 保护,留着也没事)。

---

## 之后怎么用

- 录交易/报销时上传的凭证 → 自动存进存档账号 Drive 的 `OLCC Books/年份/分类/` 里
- 点"查看凭证" → 在 Google Drive 打开(你的浏览器要先登录过任意 Google 账号,且文件夹已分享给你)
- 想让其他股东也能看:存档账号在 Drive 里右键 "OLCC Books" 文件夹 → 共享 → 加其他股东邮箱(编辑权限)

## 出问题了

- 收到"⚠️ Drive 授权失效"邮件 → 重做一次 C 步骤拿新 token,换掉 Vercel 里的 `GOOGLE_DRIVE_REFRESH_TOKEN`
- 凭证上传失败 → 交易照样保存,列表里那行会有"📎 补传"按钮,网络好了点一下重传
