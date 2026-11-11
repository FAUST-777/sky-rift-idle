# 天空裂洞物語 — 給 Claude 的工作規則

用戶會在不同電腦（家裡 PC、公司 Mac）輪流開發，每台都有自己的 Claude。以下規則每台都要照做。

## 同步與上版
- **開工前**：`git fetch`，切到 `dev` 並拉到最新（`git checkout dev && git pull`）。另一台可能推過新東西，沒同步就改會撞到。
- **每次改完**：commit 後 **push 到 `dev` branch**。換電腦也拿得到；`vercel.json` 關掉了 `dev` 的自動部署，推 `dev` 不會用 Vercel 額度。
- **不要直接 push `main`**：推 `main` = 上版。Vercel 有接 GitHub，推 `main` 會自動正式部署到 https://sky-rift-idle.vercel.app（算一次額度，免費版每天 100 次），GitHub Pages（https://faust-777.github.io/sky-rift-idle/）也會一起更新。
- **上版**（用戶說「上版／部署」才做）：`dev` 合併進 `main` 並 push 就好，Vercel 會自動部署，**不用**再手動跑 `vercel --prod`（手動跑會重複部署、多用一次額度）。可以用 `vercel ls sky-rift-idle --scope faust777s-projects` 確認狀態是 Ready。
- 其他 branch 也會建 Vercel 預覽部署（會用額度），沒必要不要推新的 branch。

## 每輪改動
- 寫進 `DEVELOPMENT_LOG.md`「第 N 輪」：需求原文、做法、驗證。N 接在檔案裡最大的輪數後面（兩台都在寫，先看最新的再編號）。
- 三語（`lang/zh-TW.js`、`zh-CN.js`、`en.js`）key 要對齊。
- 用無頭瀏覽器（puppeteer）實際載入 `index.html` 驗證，沒有 page error 才算完成。
