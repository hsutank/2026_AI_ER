# Google App Engine & Google Sheets 專案遷移與部署指南

我們已將專案成功複製，並完成了將「設定檔 (Profiles)」、「歷史紀錄 (History)」和「股價快取數據 (Stock Cache)」完全轉移至 Google Sheets 的所有程式碼重寫，且通過了本地功能測試。

由於 Google App Engine 的執行環境必須綁定 **「GCP 帳單帳戶 (Billing Account)」** 才能初始化伺服器與部署，請依照本指南完成最後的雲端環境啟用與部署步驟。

---

## 📂 專案變更與檔案結構

新複製的 GAE 專案路徑為：`C:\Users\User\.gemini\antigravity\scratch\financial_backtester_gae`

### 1. 新增與修改的檔案
* **`backend/sheets_storage.py` [NEW]**：Google Sheets 讀寫抽象層。
* **`backend/main.py` [MODIFY]**：完全移除本地檔案 I/O，快取與設定皆改用 Google Sheets 讀寫。
* **`backend/app.yaml` [NEW]**：GAE 標準環境設定檔，指定使用 `F1` 規格（符合 GCP 永遠免費額度）與自動彈性縮放（可縮放至 0 個實例以節省成本）。
* **`backend/.gcloudignore` [NEW]**：排除無用或敏感檔案（如 credentials.json）上傳至 GAE。
* **`deploy_gae.py` [NEW]**：編譯前端並自動部署至 GAE。
* **`deploy_all.py` [NEW]**：一鍵同時部署 **NAS 版** 與 **GAE 版** 的統一部署指令碼。
* **`backend/credentials.json` [NEW]**：用於本地開發與 Sheets API 互動的服務帳戶金鑰。

### 2. Google Sheets 連線測試結果
我們使用服務帳戶金鑰對您的 Google 試算表 `10O_CeRq9X7CzIDkCNhJQRUGLjt7c3lkDVVaf1WjSxzw` 進行了讀寫功能驗證：
* **[profiles] 設定檔**：成功寫入與讀取 `test_gae_profile` JSON 資料。
* **[history] 歷史紀錄**：成功更新股票歷史查詢清單。
* **[cache_{stock_id}] 股價快取**：成功自動建立工作表分頁並將股價快取資料轉寫成 DataFrame 再存回試算表。
* *本地測試已全面通過，您的試算表已處於乾淨的 Production 狀態！*

---

## 🛠️ 後續動作引導

### 步驟 1：啟用 GCP 專案帳單 (Billing)
請先為您的 GCP 專案 `ssana-backtester` 綁定付款信用卡的帳單帳戶：
1. 開啟瀏覽器進入 [Google Cloud Console 帳單頁面](https://console.cloud.google.com/billing)。
2. 點擊 **「連結帳單帳戶 (Link a billing account)」**。
3. 選擇您的信用卡帳單帳戶，並將其與專案 **`ssana-backtester`** 連結。

---

### 步驟 2：執行 GAE 應用程式初始化與部署
完成帳單連結後，請在您的終端機（PowerShell 或 Command Prompt）中執行以下指令來完成部署：

```powershell
# 1. 切換至 GAE 專案目錄
cd C:\Users\User\.gemini\antigravity\scratch\financial_backtester_gae

# 2. 初始化 App Engine 應用程式 (設定在台灣彰化 asia-east1 區域)
gcloud app create --project=ssana-backtester --region=asia-east1

# 3. 執行部署指令碼 (自動編譯前端並部署至雲端)
python deploy_gae.py
```

部署完成後，GAE 會給您一個預設網址，如：`https://ssana-backtester.df.r.appspot.com`

---

### 步驟 3：綁定自訂網域 `ssana.tyhsu.com`

**★ 注意：我們已自動在您的 Cloudflare 中完成了 DNS CNAME 紀錄設定 (`ssana.tyhsu.com` CNAME -> `ghs.googlehosted.com`)！**

當您的 App Engine 部署成功後，您只需要在終端機中執行以下指令，向 Google App Engine 註冊該自訂網域：

```powershell
gcloud app domain-mappings create ssana.tyhsu.com --project=ssana-backtester
```

執行後，Google App Engine 會自動驗證 DNS 設定並為您申請免費的 SSL (HTTPS) 安全憑證，您便能直接以 `https://ssana.tyhsu.com` 連入系統。

---

### 🚀 未來如何「同時更新 NAS 與 GAE」
未來當您調整程式碼後，不需要分開更新。只要在 `financial_backtester_gae` 目錄下執行以下指令：

```powershell
python deploy_all.py
```

這項指令會自動：
1. 重新編譯最新的 React 前端。
2. 複製最新靜態網頁資源至兩邊後端。
3. 自動透過 SSH 上傳 NAS 並重新啟動 Docker 容器。
4. 自動執行 `gcloud app deploy` 更新 Google App Engine 服務。
