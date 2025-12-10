# 如何加入本地 Chart.js

## 方法一：手動下載（推薦）

1. 開啟瀏覽器，前往：
   https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js

2. 右鍵點擊頁面 → 另存新檔

3. 儲存檔名為：`chart.min.js`

4. 將 `chart.min.js` 放到擴充功能資料夾中（與 manifest.json 同一層）

5. 重新載入擴充功能

## 方法二：使用 npm 下載（如果你有 Node.js）

```bash
cd tab-info-extension
npm install chart.js
cp node_modules/chart.js/dist/chart.umd.min.js ./chart.min.js
```

## 方法三：直接從 GitHub 下載

1. 前往：https://github.com/chartjs/Chart.js/releases
2. 下載最新版本的 `chart.umd.min.js`
3. 重新命名為 `chart.min.js`
4. 放到擴充功能資料夾

## 檔案結構

完成後，你的資料夾應該像這樣：

```
tab-info-extension/
├── manifest.json
├── popup.html
├── popup.js
├── styles.css
├── background.js
├── chart.min.js  ← 加入這個檔案
├── icon16.png
├── icon48.png
└── icon128.png
```

## 驗證

在 Chrome 中：
1. 開啟擴充功能彈出視窗
2. 右鍵 → 檢查
3. 在 Console 中輸入：`typeof Chart`
4. 如果顯示 `"function"`，表示載入成功！
