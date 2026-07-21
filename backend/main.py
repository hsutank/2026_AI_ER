"""
Financial Backtesting & Prediction API — Google App Engine Edition
ALL data stored in Google Sheets:
  - profiles (設定檔)
  - history (查詢紀錄)
  - stock price cache (股價快取，每支股票一個分頁)
No local filesystem dependency — fully cloud-native.
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
import requests
import pandas as pd
import datetime
import os
import json
import logging

from backtester import generate_strategies
from predictor import generate_predictions
from sheets_storage import create_storage, SheetsStorage

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Financial Backtesting & Prediction API (GAE)")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================================================================
# Storage Initialization
# =========================================================================
sheets: Optional[SheetsStorage] = None

@app.on_event("startup")
def startup_event():
    """Initialize Google Sheets storage on app startup."""
    global sheets
    sheets = create_storage()
    if sheets:
        logger.info("✓ Google Sheets storage initialized — all data will be stored in Sheets.")
    else:
        logger.warning("✗ Google Sheets unavailable. API will return errors for storage operations.")


# =========================================================================
# History Management (Google Sheets)
# =========================================================================
def update_history(stock_id: str, stock_name: str):
    """Update stock query history in Google Sheets."""
    if not sheets:
        logger.warning("Sheets not available — skipping history update.")
        return
    try:
        sheets.update_history(stock_id, stock_name)
    except Exception as e:
        logger.error(f"Sheets history update failed: {e}")


# =========================================================================
# Data Fetching (FinMind API + Google Sheets Cache)
# =========================================================================
def fetch_finmind_data(stock_id: str, start_date: str, end_date: str = None) -> pd.DataFrame:
    """
    Fetch stock data from FinMind API with Google Sheets caching.
    All cached data is stored in Google Sheets (one tab per stock).
    """
    today_str = datetime.date.today().strftime('%Y-%m-%d')
    if not end_date:
        end_date = today_str

    # Determine dataset: TaiwanStockPrice or USStockPrice
    is_taiwan = stock_id.isdigit()
    dataset = "TaiwanStockPrice" if is_taiwan else "USStockPrice"

    # Try loading from Google Sheets cache
    df = None
    if sheets:
        try:
            df = sheets.get_stock_cache(stock_id)
        except Exception as e:
            logger.warning(f"Sheets cache read failed for {stock_id}: {e}")

    if df is not None and not df.empty:
        try:
            df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')
            df = df.sort_values('date').reset_index(drop=True)
            last_date_str = df.iloc[-1]['date']

            if last_date_str < end_date:
                logger.info(f"Incremental update: {stock_id} from {last_date_str} to {end_date}")
                last_dt = datetime.datetime.strptime(last_date_str, '%Y-%m-%d').date()
                fetch_start = (last_dt + datetime.timedelta(days=1)).strftime('%Y-%m-%d')

                url = "https://api.finmindtrade.com/api/v4/data"
                params = {
                    "dataset": dataset,
                    "data_id": stock_id,
                    "start_date": fetch_start,
                    "end_date": end_date
                }

                r = requests.get(url, params=params, timeout=15)
                res = r.json()
                if res.get("status") == 200 and len(res["data"]) > 0:
                    new_df = pd.DataFrame(res["data"])
                    df = pd.concat([df, new_df], ignore_index=True)
                    df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')
                    df = df.drop_duplicates(subset=['date'], keep='last')
                    df = df.sort_values('date').reset_index(drop=True)
                    # Save updated cache to Google Sheets
                    if sheets:
                        try:
                            sheets.save_stock_cache(stock_id, df)
                        except Exception as e:
                            logger.warning(f"Sheets cache save failed for {stock_id}: {e}")
        except Exception as e:
            logger.warning(f"Incremental load error for {stock_id}: {e}. Refetching all.")
            df = None

    if df is None or df.empty:
        logger.info(f"Fetching all data for {stock_id} from {start_date} to {end_date}")
        three_years_ago = (datetime.date.today() - datetime.timedelta(days=3*365)).strftime('%Y-%m-%d')
        actual_start = min(start_date, three_years_ago)

        url = "https://api.finmindtrade.com/api/v4/data"
        params = {
            "dataset": dataset,
            "data_id": stock_id,
            "start_date": actual_start,
            "end_date": end_date
        }

        r = requests.get(url, params=params, timeout=15)
        res = r.json()
        if res.get("status") == 200:
            df = pd.DataFrame(res["data"])
            if df.empty:
                raise HTTPException(status_code=404, detail=f"No data returned for stock ID {stock_id}")
            df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')
            df = df.sort_values('date').reset_index(drop=True)
            # Save to Google Sheets cache
            if sheets:
                try:
                    sheets.save_stock_cache(stock_id, df)
                except Exception as e:
                    logger.warning(f"Sheets cache save failed for {stock_id}: {e}")
        else:
            raise HTTPException(status_code=400, detail=f"FinMind error: {res.get('msg')}")

    mask = (df['date'] >= start_date) & (df['date'] <= end_date)
    filtered_df = df.loc[mask].reset_index(drop=True)
    if filtered_df.empty:
        return df.tail(120).reset_index(drop=True)
    return filtered_df


# =========================================================================
# Pydantic Models
# =========================================================================
class GenerationRequest(BaseModel):
    stock_id: str
    start_date: str
    end_date: Optional[str] = None
    enabled_conditions: Dict[str, bool]
    entry_logic: str = 'AND'
    entry_sequence: Optional[List[Dict[str, Any]]] = None
    exit_sequence: Optional[List[Dict[str, Any]]] = None
    trials: int = 500
    fitness_metric: str = 'sharpe_ratio'
    max_entry_rules: int = 3
    max_exit_rules: int = 2
    min_trades: int = 5
    initial_cash: float = 1000000.0
    fee_rate: float = 0.002
    risk_params: Dict[str, Any]
    params: Dict[str, Any] = {}

class ProfileModel(BaseModel):
    name: str
    config: Dict[str, Any]


# =========================================================================
# API Endpoints
# =========================================================================
@app.get("/api/stock-info")
def get_stock_info(stock_id: str):
    is_taiwan = stock_id.isdigit()
    dataset = "TaiwanStockInfo" if is_taiwan else "USStockInfo"
    url = "https://api.finmindtrade.com/api/v4/data"
    params = {
        "dataset": dataset,
        "data_id": stock_id
    }
    try:
        r = requests.get(url, params=params, timeout=10)
        res = r.json()
        if res.get("status") == 200 and len(res["data"]) > 0:
            info = res["data"][0]
            return {
                "stock_id": info.get("stock_id"),
                "stock_name": info.get("stock_name", stock_id),
                "industry_category": info.get("industry_category", "美股商品" if not is_taiwan else "台股商品")
            }
        else:
            if stock_id == "2330":
                return {"stock_id": "2330", "stock_name": "台積電", "industry_category": "半導體業"}
            return {"stock_id": stock_id, "stock_name": f"商品 {stock_id}", "industry_category": "未知"}
    except Exception:
        if stock_id == "2330":
            return {"stock_id": "2330", "stock_name": "台積電", "industry_category": "半導體業"}
        return {"stock_id": stock_id, "stock_name": stock_id, "industry_category": "N/A"}


@app.get("/api/history")
def get_history():
    """Get stock query history from Google Sheets."""
    if not sheets:
        return []
    try:
        return sheets.get_history()
    except Exception as e:
        logger.error(f"Sheets history read failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to read history: {str(e)}")


@app.post("/api/backtest-and-predict")
def backtest_and_predict(req: GenerationRequest):
    """
    Query, scan, generate, backtest, and predict top strategies.
    """
    try:
        stock_name = "未知股票"
        try:
            info = get_stock_info(req.stock_id)
            stock_name = info.get("stock_name", "未知股票")
        except Exception:
            pass
        update_history(req.stock_id, stock_name)

        # 1. Fetch stock data (from Sheets cache or FinMind API)
        df = fetch_finmind_data(req.stock_id, req.start_date, req.end_date)

        # 2. Run Strategy Generator Scanner
        top_strategies, passivation_regions, df_ind = generate_strategies(
            df=df,
            enabled_conditions=req.enabled_conditions,
            entry_logic_sequence=req.entry_sequence,
            exit_logic_sequence=req.exit_sequence,
            trials=req.trials,
            fitness_metric=req.fitness_metric,
            max_entry_rules=req.max_entry_rules,
            max_exit_rules=req.max_exit_rules,
            min_trades=req.min_trades,
            initial_cash=req.initial_cash,
            fee_rate=req.fee_rate,
            risk_params=req.risk_params,
            params=req.params
        )

        # 3. Generate Predictions (at least 3 months - 60 trading days)
        pred_summary, forecast_path = generate_predictions(df, horizon_days=60)

        # 4. Fetch Benchmark Index (0050 for Taiwan stocks, SPY for US stocks)
        is_taiwan = req.stock_id.isdigit()
        bench_id = "0050" if is_taiwan else "SPY"
        bench_name = "台股大盤指數對照 (0050)" if is_taiwan else "美股標普500指數對照 (SPY)"

        try:
            bench_df = fetch_finmind_data(bench_id, req.start_date, req.end_date)
            if not bench_df.empty and not df.empty:
                stock_first_close = float(df.iloc[0]['close'])
                bench_first_close = float(bench_df.iloc[0]['close'])
                bench_df['rebased_close'] = bench_df['close'].astype(float) * (stock_first_close / bench_first_close)
                bench_list = bench_df[['date', 'rebased_close']].to_dict(orient='records')
            else:
                bench_list = []
        except Exception as e:
            logger.warning(f"Error fetching benchmark index: {e}")
            bench_list = []

        # Format history list for charting
        history = df_ind[['date', 'open', 'max', 'min', 'close', 'Trading_Volume']].copy()
        history['date'] = history['date'].astype(str)
        history_list = history.to_dict(orient='records')

        return {
            "status": "success",
            "stock_id": req.stock_id,
            "strategies": top_strategies,
            "predictions_summary": pred_summary,
            "forecast_path": forecast_path,
            "history": history_list,
            "passivation_regions": passivation_regions,
            "benchmark_index": bench_list,
            "benchmark_name": bench_name
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


# =========================================================================
# Profile Endpoints (Google Sheets)
# =========================================================================
@app.get("/api/profiles")
def get_profiles():
    """Get all saved profiles from Google Sheets."""
    if not sheets:
        return {}
    try:
        return sheets.get_all_profiles()
    except Exception as e:
        logger.error(f"Sheets profiles read failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to read profiles: {str(e)}")


@app.post("/api/profiles")
def save_profile(profile: ProfileModel):
    """Save a profile to Google Sheets."""
    if not sheets:
        raise HTTPException(status_code=503, detail="Storage not available")
    try:
        sheets.save_profile(profile.name, profile.config)
        return {"status": "success", "message": f"Profile '{profile.name}' saved to Google Sheets."}
    except Exception as e:
        logger.error(f"Sheets profile save failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save profile: {str(e)}")


@app.delete("/api/profiles/{name}")
def delete_profile(name: str):
    """Delete a profile from Google Sheets."""
    if not sheets:
        raise HTTPException(status_code=503, detail="Storage not available")
    try:
        sheets.delete_profile(name)
        return {"status": "success", "message": f"Profile '{name}' deleted."}
    except Exception as e:
        logger.error(f"Sheets profile delete failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete profile: {str(e)}")


# =========================================================================
# Health & Static Files
# =========================================================================
from fastapi.staticfiles import StaticFiles

@app.get("/api/health")
def health():
    """Health check endpoint."""
    return {
        "status": "ok",
        "storage": "google_sheets" if sheets else "unavailable",
        "environment": "GAE" if os.environ.get("GAE_APPLICATION") else "local"
    }

# Mount frontend static files
dist_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dist")
if os.path.exists(dist_path):
    app.mount("/", StaticFiles(directory=dist_path, html=True), name="static")
