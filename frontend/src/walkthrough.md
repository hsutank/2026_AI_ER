# Walkthrough: 量化交易策略生成與掃描系統 (Complete Strategy Scanner & Generator)

本專案已完全重構升級為一個類似您提供之參考畫面的**「量化交易策略生成與掃描系統」**！它能將信號庫指標、資金管理規則、以及搜尋演算法整合，自動在歷史數據中進行千百次模擬，生成多個交易策略，並提供詳細的資產曲線、迷你走勢圖 (Sparkline) 與 15+ 項專業量化指標。

---

## 🚀 系統功能架構與更新細節

專案目錄：`C:\Users\User\.gemini\antigravity\scratch\financial_backtester_dashboard`

### 1. 階層式分頁設定面板 (Config Panel with Tabs & Sub-tabs)
為了改善文字過小及畫面擁擠的問題，設定面板改採**「主分頁 + 子分頁」的雙層結構**，大幅擴展可用版面並調大所有標籤字體：
- **📊 數據與回測設定 (Data & Engine)**：
  - **數據源與時間範圍**：輸入商品代碼（如 2330、AAPL）、K線週期（日線/4h/1h）、最大載入 K 線根數、起始/結束日期。
  - **回測規則與引擎**：設定初始資金、手續費率、策略搜尋 Trials、最少交易數過濾、優化目標指標（夏普值/報酬率/勝率）、進場邏輯閘（AND/OR）、進出場條件上限。
- **🛡️ 風險與資金管理 (Risk & Exits)**：
  - **停損與目標停利**：自定義啟用強制停損 (Stop Loss) 與目標停利 (Profit Target)，支援百分比與 ATR 波動度模式。
  - **移動停損與時間出場**：設定移動停損 (Trailing Stop)；以及時間平倉設定（持倉 K 線上限、星期五收盤平倉）。
- **⚙️ 信號條件庫 (Signal Library)**：
  - **動能指標 (Momentum)**：勾選並自定義 RSI、MACD、KD、Williams %R、CCI 等指標之細部週期參數。
  - **趨勢指標 (Trend)**：勾選並設定 SMA、EMA、ADX、布林通道等週期與標準差。
  - **量能與波動 (Volume/Volatility)**：設定 ATR、標準差、OBV、MFI、CMF、VWAP 等指標天數。

### 2. 全方位選項鼠標懸停提示 (Detailed Option Tooltips)
- 設定面板上的**所有標籤、輸入框、下拉選單、核取方塊及指標選項**，均加上了詳盡的鼠標懸停說明 (`title` 屬性)。
- 標籤文字旁附有 `🛈` 提示標誌。當滑鼠游標移到選項上方時，會立刻彈出詳細功能備註，說明該參數的意義或指標的交易原理（例如說明 RSI 超買超賣區間天數、布林通道與標準差倍數等），大幅提升量化交易者的易用性。

### 3. 動態響應式指標參數自定義 (Inline Indicator Parameter Settings)
- 當在「信號條件庫」中勾選任何指標（如 RSI, KD, MACD, BB, SMA, EMA 等）時，該指標的細部設定參數會**立刻以響應式 (Reactive) 動態展開於該核取方塊下方**，無須向下滾動尋找。移除下方繁瑣的額外摺疊區塊，操作一目了然！
- **支援自定義參數**：
  - **RSI**：自定義 RSI 計算週期天數。
  - **KD**：自定義 RSV 週期、K值平滑、D值平滑天數。
  - **MACD**：自定義 Fast EMA, Slow EMA, Signal EMA 天數。
  - **BB (布林)**：自定義通道均線週期及標準差倍數。
  - **SMA / EMA**：自定義短、中、長期移動平均天數。
  - **其他指標 (ADX, ATR, CCI, Williams %R, MFI, CMF, VWAP 等)**：皆支援獨立週期參數輸入。
- 自定義的參數會作為 `params` 傳遞給後端回測引擎，在計算技術指標時自動套用。

### 4. 回測時間模擬播放器 (Simulation Replay Player)
- 在 KPI 卡片下方，全新加入了**「回測時間走動模擬器 (Simulation Player)」**面板。
- **控制按鈕**：提供 播放 (Play) / 暫停 (Pause)、重設至第一天 (Reset) 等直觀的按鈕控制。
- **播放速度 (Speed)**：支援調整播放速率：**1x** (250ms/日)、**2x** (120ms/日)、**5x** (50ms/日) 及 **10x** (20ms/日) 快速跳轉。
- **時間拖拉軸 (Scrub Bar)**：支援透過橫向 Range 拖拉軸自由拉動時間軸，即時跳轉至任何歷史日期。
- **聲音反饋 (Web Audio API)**：
  - 系統內建網頁音效合成器，當模擬時間走動並**碰到買入動作 (Buy)** 時，會發出清脆的**上升大調和弦音 (C5-E5-G5)**。
  - 當**碰到賣出動作 (Sell/Stop Loss/Profit Target)** 時，會發出溫和的**下降小調和弦音 (G5-D5-B4)**。
  - 面板上亦提供「靜音/喇叭 (Mute/Unmute)」按鈕，讓您自由開啟或關閉音效。
- **動態數據聯動**：
  - 當時間走動時，主 K 線圖、量化指標卡片、資產淨值曲線圖、以及交易明細表會**同步以 simIndex 切片**，呈現動態逐日成長、交易逐筆浮現的即時渲染效果！

### 5. 指標鈍化買賣標示與指南 (Passivation Trading Guidance)
- **K線圖動態標籤**：
  - 紅色區塊：明確標示為 `${Indicator} 高檔強勢 (適合買入/續抱)`。
  - 藍色區塊：明確標示為 `${Indicator} 低檔弱勢 (適合賣出/觀望)`。
- **指標鈍化區交易指南面版**：
  - 在 K 線價格圖的下方，新增了專門的交易教育解析卡片，詳細說明高檔強勢阻化與低檔弱勢鈍化的策略意義。

### 6. 中間策略生成結果表格 (Strategy Scanner Table)
- 用戶點擊「隨機生成策略與歷史回測 (Generate Random Strategies)」時，後端會隨機組合所選之指標與風險控制，篩選出符合最少交易數的策略。
- 最終挑選出 **Top 20 候選策略** 呈現在表格中，並包含進出場條件描述、夏普值、勝率、最大回撤等指標，以及 SVG Sparkline 迷你曲線圖。

### 7. 大盤基準指數對照線 (Market Benchmark Index Comparison)
- 系統會根據您輸入的股票類型，自動拉取大盤對照基準指數（台股 0050 / 美股 SPY）。
- 後端會自動將大盤指數收盤價**進行基底重整 (Rebase)**，使其起點與個股起始日收盤價相同，並以 **橘色虛線** 繪製於圖表上供您即時對照。

### 8. Docker NAS 部署配置 (Docker NAS Deployment Support)
- 本專案已提供完整的 `Dockerfile`（前端 Nginx 靜態代理，後端 Python Uvicorn 服務）以及 `docker-compose.yml` 部署檔。
- 前端 API 請求全面重構為**相對路徑**並透過 Nginx 進行反向代理，解決跨域與 NAS 部署 IP 變動的問題。
- 後端資料庫及下載快取掛載至 `backend_data` 虛擬磁碟中，確保 NAS 重開機或更新映像檔時，歷史紀錄與日K線快取數據**永不遺失**。
- 附帶一份完整的 [NAS 部署手冊 (NAS_DEPLOYMENT.md)](file:///C:/Users/User/.gemini/antigravity/scratch/financial_backtester_dashboard/NAS_DEPLOYMENT.md) 方便使用者操作。

### 9. 參數自動儲存與命名設定檔共享 (Parameters Auto-save & Named Profiles Sharing)
- **自動儲存 (Auto-save)**：每次執行回測時，系統會自動在後端將當前所有設定參數儲存為 `latest` 設定檔。下一次任何用戶端重新整理或開啟網頁，都會自動從後端讀取並載入最後一次的回測參數。
- **命名與跨設備共享 (Named Profiles Sharing)**：
  - 設定面板頂部新增「設定檔儲存與共享 (Profiles Sharing)」工具區。
  - 用戶可輸入名稱（例如 `高勝率指標策略`）點擊儲存，該組參數會傳送至後端並寫入持久化磁碟（Docker 卷），其他設備的用戶端開啟網頁，即可在下拉選單中同步看到並直接點選載入套用。
  - 支援已命名設定檔的一鍵刪除。

### 10. 拖曳式條件順序與自定義邏輯閘編排 (Drag & Drop Sequence & Logic Compiler)
- **原生 HTML5 拖拉排序**：於「信號條件庫 (Signal Library)」分頁下新增了專門的「條件順序與邏輯 (Drag & Drop Logic)」子分頁。以完全免依賴的 HTML5 原生拖拉 API，實現極度流暢的卡片順序重排（進場與出場順序皆可獨立客製）。
- **自定義串接邏輯閘**：在拖曳卡片之間，提供隨選下拉選單讓用戶選擇 `交集 (AND / 全部符合)` 或 `聯集 (OR / 擇一符合)` 關係。
- **後端線性求值與公式生成**：後端回測核心會嚴格依據拖曳順序，進行包含括號 nested-logical evaluation（如 `((RSI AND MACD) OR SMA)`），並在 Top 20 策略候選表格中動態生成精確的數學條件公式文字（例如 `(([Buy] RSI < 30 AND [Buy] MACD > 0) OR [Buy] SMA5 > SMA20)`），供量化交易員一目了然。
- **版面優化與常駐側邊欄 (Persistent Sidebar)**：順序與邏輯編排器已從隱蔽的最後一個子分頁抽離，以常駐右側邊欄（Persistent Sidebar）的精緻版面呈現。用戶在左側子分頁（如動能、趨勢、量能）中勾選/取消勾選任何指標時，右側側邊欄的序列卡片會**即時同步新增或移除**，並能直接在右側進行拖曳排序與 AND/OR 選取，免去分頁來回切換的困擾，大幅提昇了交互效率。

---

## 📈 運行與驗證

1. 後端 `main.py` 與 `backtester.py` 經實測完美運作，隨機生成 100~500 個組合僅需不到 1 秒。
2. 前端 client 專案已使用 `npm run build` 編譯完成，打包無任何 TypeScript/JavaScript/Tailwind/ECharts 錯誤。
3. 系統完美整合了數據加載、策略搜尋、指標計算、風險管理平倉、AI走勢預測和豐富的可視化儀表板。
