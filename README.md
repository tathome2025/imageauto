# Bannerbear Layout App

一個可直接啟動的圖片生成服務原型。它現在包含兩部分：

- 原本的 Bannerbear 表單工具，繼續可用
- 新增的自架式 Image Generation API，可讓其他用戶用 API key 接入，自行選模板產圖

## 功能

- 輸入 `Car Model`、`Car Brand`
- 輸入 3 個 `Product Items`
- 上傳 1 張主圖與 3 張副圖
- 呼叫 Bannerbear 同步 API 直接生成圖片
- 生成後立即預覽並可在新分頁打開結果
- 支援本機開發與 Vercel 部署
- 提供 `GET /api/v1/templates` 列出模板
- 提供 `POST /api/v1/renders` 產生 `PNG` 或 `SVG`
- 支援 `X-API-Key` / `Authorization: Bearer ...` 驗證
- 以本地 JSON 模板定義版型，方便你後續擴展成多模板系統

## 新增的自架 API

這不是完整複製 Bannerbear 全平台功能，但已具備一個可交付的 MVP 骨架：

- API key 驗證
- 模板列表 API
- 變數替換式圖片渲染
- 支援遠端圖片 URL 嵌入
- SVG 輸出與 PNG 光柵化

如果你下一步要做成商用版本，通常還要補：

- 使用者 / 團隊 / 配額 / 計費
- 模板編輯器
- 非同步任務佇列
- 產圖紀錄與儲存
- Webhook / 任務狀態查詢
- 對外 SDK 與限流

## 先決條件

1. 你需要一個 Bannerbear 帳號與一個已建立好的 template。
2. 建議在該 template 裡建立以下圖層名稱：
   - `car_model`
   - `car_brand`
   - `car_image`
   - `product1`
   - `product2`
   - `product3`
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
IMAGE_API_KEYS=demo-key
DISABLE_IMAGE_API_AUTH=false
BANNERBEAR_API_KEY=YOUR_API_KEY
BANNERBEAR_TEMPLATE_ID=YOUR_TEMPLATE_ID
BANNERBEAR_API_BASE=https://sync.api.bannerbear.com
TITLE_LAYER_NAME=car_model
SUBTITLE_LAYER_NAME=car_brand
MAIN_IMAGE_LAYER_NAME=car_image
SECONDARY_IMAGE_LAYER_NAMES=product1,product2,product3
ITEM_LAYER_NAMES=items1,items2,items3
BLOB_READ_WRITE_TOKEN=YOUR_VERCEL_BLOB_READ_WRITE_TOKEN
```

`IMAGE_API_KEYS` 可填多個，以逗號分隔，例如：

```env
IMAGE_API_KEYS=client-a-key,client-b-key,internal-key
```

## 新 API 用法

列出模板：

```bash
curl http://localhost:3000/api/v1/templates \
  -H "X-API-Key: demo-key"
```

產生 PNG：

```bash
curl http://localhost:3000/api/v1/renders \
  -H "Content-Type: application/json" \
  -H "X-API-Key: demo-key" \
  -d '{
    "templateId": "promo-card",
    "format": "png",
    "variables": {
      "eyebrow": "NEW ARRIVAL",
      "title": "Launch your image API in days",
      "subtitle": "Use JSON templates and remote assets to generate banners automatically.",
      "cta": "Start Now",
      "imageUrl": "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80"
    }
  }'
```

直接回傳原始圖片檔：

```bash
curl "http://localhost:3000/api/v1/renders?download=1" \
  -H "Content-Type: application/json" \
  -H "Accept: image/png" \
  -H "X-API-Key: demo-key" \
  -d '{
    "templateId": "spotlight-card",
    "format": "png",
    "variables": {
      "label": "FEATURED",
      "title": "Self-hosted creative automation",
      "description": "Generate social cards, ad creatives and content images from your own backend.",
      "footer": "TY LAB",
      "imageUrl": "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80"
    }
  }' \
  --output render.png
```

回傳格式：

- 預設回 JSON，內含 `dataUrl` 和 `base64`
- 加 `?download=1` 或 `Accept: image/png` / `image/svg+xml` 時，直接回原始圖片內容

## 模板定義

模板放在 `templates/*.json`，目前支援幾種基礎 layer：

- `rect`
- `text`
- `image`

每個模板至少要有：

```json
{
  "id": "promo-card",
  "name": "Promo Card",
  "size": { "width": 1200, "height": 628 },
  "variables": ["title", "imageUrl"],
  "layers": []
}
```

你可以直接複製現有模板再改字位、顏色、圖片區和文案欄位。

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
product1,product2,product3
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
- `api/upload.js`: 上傳主圖與三張副圖到 Vercel Blob
- `api/config.js`: 讀取部署設定
- `api/render.js`: 呼叫 Bannerbear API
- `api/v1/templates.js`: 自架圖片 API 的模板列表
- `api/v1/renders.js`: 自架圖片 API 的渲染端點
- `local-dev-server.js`: 本機開發 server
- `lib/render-engine.js`: SVG / PNG 渲染引擎
- `templates/`: 圖片模板定義

## API 依據

- Bannerbear 官方 Image Generation API: `POST /v2/images`
- Bannerbear 官方同步 API base URL: `https://sync.api.bannerbear.com`

參考：

- https://developers.bannerbear.com/#tag/Image-Generation
