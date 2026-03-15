# Bannerbear Layout App

一個可直接部署到 Vercel 的最小 web app，用來把表單內容送到 Bannerbear，快速生成汽車版型圖片。

## 功能

- 輸入 `Car Model`、`Car Brand`
- 輸入 3 個 `Product Items`
- 上傳 1 張主圖與 2 張副圖
- 呼叫 Bannerbear 同步 API 直接生成圖片
- 生成後立即預覽並可在新分頁打開結果
- 支援本機開發與 Vercel 部署

## 先決條件

1. 你需要一個 Bannerbear 帳號與一個已建立好的 template。
2. 建議在該 template 裡建立以下圖層名稱：
   - `car_model`
   - `car_brand`
   - `car_image`
   - `product1`
   - `product2`
   - `items1`
   - `items2`
   - `items3`

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
TITLE_LAYER_NAME=car_model
SUBTITLE_LAYER_NAME=car_brand
MAIN_IMAGE_LAYER_NAME=car_image
SECONDARY_IMAGE_LAYER_NAMES=product1,product2
ITEM_LAYER_NAMES=items1,items2,items3
BLOB_READ_WRITE_TOKEN=YOUR_VERCEL_BLOB_READ_WRITE_TOKEN
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
    - `MAIN_IMAGE_LAYER_NAME`
    - `SECONDARY_IMAGE_LAYER_NAMES`
    - `ITEM_LAYER_NAMES`
    - `BLOB_READ_WRITE_TOKEN`
5. 重新部署。

`BANNERBEAR_API_BASE` 建議填：

```env
https://sync.api.bannerbear.com
```

`SECONDARY_IMAGE_LAYER_NAMES` 範例值：

```env
product1,product2
```

`ITEM_LAYER_NAMES` 範例值：

```env
items1,items2,items3
```

注意：

- 目前這版使用 Vercel Blob client uploads，圖片由瀏覽器直接傳到 Blob，再把 Blob 的公開 URL 傳給 Bannerbear。
- 這樣可避開 Vercel Functions 的 request body 限制，較適合圖片上傳場景。

## 專案結構

- `public/`: 靜態前端頁面
- `api/upload.js`: 上傳主圖與兩張副圖到 Vercel Blob
- `api/config.js`: 讀取部署設定
- `api/render.js`: 呼叫 Bannerbear API
- `local-dev-server.js`: 本機開發 server

## API 依據

- Bannerbear 官方 Image Generation API: `POST /v2/images`
- Bannerbear 官方同步 API base URL: `https://sync.api.bannerbear.com`

參考：

- https://developers.bannerbear.com/#tag/Image-Generation
