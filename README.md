# Bannerbear Layout App

一個最小可用的 web app，用來把表單內容送到 Bannerbear，快速生成排版圖片。

## 功能

- 輸入標題、副標與背景圖 URL
- 呼叫 Bannerbear 同步 API 直接生成圖片
- 生成後立即預覽並可在新分頁打開結果

## 先決條件

1. 你需要一個 Bannerbear 帳號與一個已建立好的 template。
2. 建議在該 template 裡建立以下圖層名稱：
   - `title`
   - `subtitle`
   - `photo`

如果你使用不同圖層名稱，可以在 `.env` 裡改成自己的名稱。

## 安裝

```bash
npm install
cp .env.example .env
```

編輯 `.env`：

```env
PORT=3000
BANNERBEAR_API_KEY=YOUR_API_KEY
BANNERBEAR_TEMPLATE_ID=YOUR_TEMPLATE_ID
BANNERBEAR_API_BASE=https://sync.api.bannerbear.com
TITLE_LAYER_NAME=title
SUBTITLE_LAYER_NAME=subtitle
IMAGE_LAYER_NAME=photo
```

## 執行

```bash
npm run dev
```

打開 [http://localhost:3000](http://localhost:3000)。

## 放到 GitHub

```bash
git init
git add .
git commit -m "Initial Bannerbear layout app"
git branch -M main
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

這台機器目前沒有安裝 `gh` CLI，所以我沒有直接替你建立 GitHub repository。

## API 依據

- Bannerbear 官方 Image Generation API: `POST /v2/images`
- Bannerbear 官方同步 API base URL: `https://sync.api.bannerbear.com`

官方文件：

- https://developers.bannerbear.com/#tag/Image-Generation
