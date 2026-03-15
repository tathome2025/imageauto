# Bannerbear Layout App

一個可直接部署到 Vercel 的最小 web app，用來把表單內容送到 Bannerbear，快速生成排版圖片。

## 功能

- 輸入標題、副標與背景圖 URL
- 呼叫 Bannerbear 同步 API 直接生成圖片
- 生成後立即預覽並可在新分頁打開結果
- 支援本機開發與 Vercel 部署

## 先決條件

1. 你需要一個 Bannerbear 帳號與一個已建立好的 template。
2. 建議在該 template 裡建立以下圖層名稱：
   - `title`
   - `subtitle`
   - `photo`

如果你使用不同圖層名稱，可以在 `.env` 或 Vercel Environment Variables 裡改成自己的名稱。

## 本機執行

```bash
npm install
cp .env.example .env
npm run dev
```

打開 [http://localhost:3000](http://localhost:3000)。

`.env` 範例：

```env
PORT=3000
BANNERBEAR_API_KEY=YOUR_API_KEY
BANNERBEAR_TEMPLATE_ID=YOUR_TEMPLATE_ID
BANNERBEAR_API_BASE=https://sync.api.bannerbear.com
TITLE_LAYER_NAME=title
SUBTITLE_LAYER_NAME=subtitle
IMAGE_LAYER_NAME=photo
```

## 部署到 Vercel

1. 到 Vercel 匯入這個 GitHub repo。
2. Framework Preset 選 `Other`。
3. 不需要自訂 Build Command。
4. 在 Project Settings > Environment Variables 設定以下變數：
   - `BANNERBEAR_API_KEY`
   - `BANNERBEAR_TEMPLATE_ID`
   - `BANNERBEAR_API_BASE`
   - `TITLE_LAYER_NAME`
   - `SUBTITLE_LAYER_NAME`
   - `IMAGE_LAYER_NAME`
5. 重新部署。

`BANNERBEAR_API_BASE` 建議填：

```env
https://sync.api.bannerbear.com
```

## 專案結構

- `public/`: 靜態前端頁面
- `api/config.js`: 讀取部署設定
- `api/render.js`: 呼叫 Bannerbear API
- `local-dev-server.js`: 本機開發 server

## API 依據

- Bannerbear 官方 Image Generation API: `POST /v2/images`
- Bannerbear 官方同步 API base URL: `https://sync.api.bannerbear.com`

參考：

- https://developers.bannerbear.com/#tag/Image-Generation
