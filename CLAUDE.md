# 天空裂洞物語 — 給 Claude 的工作規則

用戶會在不同電腦（家裡 PC、公司 Mac）輪流開發，每台都有自己的 Claude。以下規則每台都要照做。

## 同步與上版
- **開工前**：`git fetch`，切到 `dev` 並拉到最新（`git checkout dev && git pull`）。另一台可能推過新東西，沒同步就改會撞到。
- **每次改完**：commit 後 **push 到 `dev` branch**。這樣換電腦也拿得到，而且 `dev` 不會觸發任何部署。
- **不要直接 push `main`**：GitHub Pages 會從 `main` 自動更新公開網站（https://faust-777.github.io/sky-rift-idle/）。
- **上版**（用戶說「上版／部署」才做）：
  1. `dev` 合併進 `main` 並 push（GitHub Pages 更新）
  2. `npx vercel --prod --yes --scope faust777s-projects`（Vercel 正式站 https://sky-rift-idle.vercel.app）
- Vercel 沒有接 GitHub 自動部署，push 不會用到 Vercel 額度（免費版每天 100 次），只有上面第 2 步會。

## 每輪改動
- 寫進 `DEVELOPMENT_LOG.md`「第 N 輪」：需求原文、做法、驗證。N 接在檔案裡最大的輪數後面（兩台都在寫，先看最新的再編號）。
- 三語（`lang/zh-TW.js`、`zh-CN.js`、`en.js`）key 要對齊。
- 用無頭瀏覽器（puppeteer）實際載入 `index.html` 驗證，沒有 page error 才算完成。
