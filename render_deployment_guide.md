# Render.com 免費雲端部署與 Cloudflare 設定指南

此指南將指引您如何將系統部署到 Render.com 的免費 Python 環境，並自動串接您已設定好的 Cloudflare 網域 `ssana.tyhsu.com`。

---

## 🛠️ 步驟 1：建立 Render Web Service

1. 登入 [Render.com](https://dashboard.render.com/)。
2. 點擊右上角的 **「New +」**，然後選擇 **「Web Service」**。
3. 連結您的 GitHub 帳戶，並選擇此回測系統的專案存放庫（Repository）。
4. 在設定頁面中填寫以下基本資訊：
   * **Name**：`ssana-backtester` (或自訂名稱)
   * **Region**：`Singapore (新加坡)` (離台灣最近，延遲最低)
   * **Language**：`Python 3`
   * **Branch**：`main`
   * **Build Command**：`pip install -r backend/requirements.txt`
   * **Start Command**：`cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`
   * **Instance Type**：選擇 **`Free`**（完全免費，免信用卡）

---

## 🔑 步驟 2：配置環境變數 (Environment Variables)

在 Render 服務設定頁面中，點擊 **「Environment」** 標籤，點擊 **「Add Environment Variable」**，新增以下兩個環境變數：

1. **`GOOGLE_SHEETS_ID`**：
   * 值：`10O_CeRq9X7CzIDkCNhJQRUGLjt7c3lkDVVaf1WjSxzw`
2. **`GOOGLE_CREDENTIALS_JSON`**：
   * 值：**請複製並貼上您本地 `backend/credentials.json` 檔案中的完整 JSON 文字內容**。
   * *我們已經重寫了連線邏輯，後端會自動讀取此環境變數並與 Google Sheets 連線，免去在雲端上傳金鑰檔案的繁瑣流程。*

設定完成後，點擊 **「Save Changes」**，Render 會自動啟動第一次部署！

---

## 🌐 步驟 3：設定自訂網域 `ssana.tyhsu.com`

當 Render 部署完成後，您的服務會獲得一個預設網址，如：`https://ssana-backtester.onrender.com`。

1. 在 Render 服務的左側選單中，點擊 **「Settings」**。
2. 往下滾動找到 **「Custom Domains」**，點擊 **「Add Custom Domain」**。
3. 輸入您的網域：`ssana.tyhsu.com`，然後點擊 **「Save」**。

---

## ⚡ 步驟 4：自動更新 Cloudflare DNS 紀錄

我們已經更新了 Cloudflare 自動同步指令碼。您只需要在您本地的電腦上，使用您剛剛的虛擬環境執行以下指令（將參數替換為您的 Render 預設網址）：

```powershell
# 1. 切換至專案目錄
cd C:\Users\User\.gemini\antigravity\scratch\financial_backtester_gae

# 2. 執行指令碼自動更新 Cloudflare 的 CNAME 紀錄 (請將網址替換為您的 Render 預設網址)
backend\.venv\Scripts\python.exe configure_cloudflare.py ssana-backtester.onrender.com
```

### 🎯 執行後的結果：
這項指令會自動連線到您的 Cloudflare，將 `ssana.tyhsu.com` 原本指向 Google 的 CNAME 紀錄更新為：
* **`ssana.tyhsu.com CNAME -> ssana-backtester.onrender.com (DNS Only)`**

設定完成且 DNS 生效（約 5~10 分鐘）後，Render 會自動為 `ssana.tyhsu.com` 配置免費的 SSL (HTTPS) 憑證，您便能直接以安全加密的網址連入您的回測系統了！
