"""
Google Sheets Storage Layer for Financial Backtester (GAE Edition)
ALL data stored in Google Sheets:
  - profiles (設定檔)
  - history (查詢紀錄)
  - stock price cache (股價快取，每支股票一個分頁)
"""

import os
import json
import logging
import io
from datetime import datetime
from typing import Optional

import pandas as pd
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)

# Sheet names
PROFILES_SHEET = "profiles"
HISTORY_SHEET = "history"
CACHE_PREFIX = "cache_"

# Scopes required
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]


class SheetsStorage:
    """
    Abstraction layer for Google Sheets as a key-value / tabular store.
    Manages profiles, query history, AND stock price cache.
    All data persisted in Google Sheets — no local filesystem dependency.
    """

    def __init__(self, spreadsheet_id: str, credentials_path: Optional[str] = None):
        """
        Initialize Google Sheets connection.

        Args:
            spreadsheet_id: The Google Sheets spreadsheet ID (from URL).
            credentials_path: Path to service account JSON key file.
                              If None, uses GOOGLE_APPLICATION_CREDENTIALS env var
                              or Application Default Credentials (for GAE).
        """
        self.spreadsheet_id = spreadsheet_id
        self._memory_cache = {}  # In-memory cache to reduce API calls within instance

        # Authenticate
        creds_json_str = os.environ.get("GOOGLE_CREDENTIALS_JSON")
        if creds_json_str:
            try:
                creds_info = json.loads(creds_json_str)
                creds = service_account.Credentials.from_service_account_info(
                    creds_info, scopes=SCOPES
                )
                logger.info("Authenticated using GOOGLE_CREDENTIALS_JSON environment variable.")
            except Exception as e:
                logger.error(f"Failed to load credentials from GOOGLE_CREDENTIALS_JSON: {e}")
                creds = None
        elif credentials_path and os.path.exists(credentials_path):
            creds = service_account.Credentials.from_service_account_file(
                credentials_path, scopes=SCOPES
            )
            logger.info(f"Authenticated using service account file: {credentials_path}")
        else:
            # Use Application Default Credentials (works on GAE automatically)
            import google.auth
            creds, _ = google.auth.default(scopes=SCOPES)

        self.service = build("sheets", "v4", credentials=creds, cache_discovery=False)
        self.sheets = self.service.spreadsheets()

        # Ensure required worksheets exist
        self._ensure_worksheets()

    def _get_existing_sheets(self) -> list[str]:
        """Get list of all existing sheet/tab names in the spreadsheet."""
        metadata = self.sheets.get(spreadsheetId=self.spreadsheet_id).execute()
        return [s["properties"]["title"] for s in metadata.get("sheets", [])]

    def _ensure_worksheets(self):
        """Create profiles and history worksheets if they don't exist."""
        try:
            existing = self._get_existing_sheets()

            requests = []
            if PROFILES_SHEET not in existing:
                requests.append({
                    "addSheet": {
                        "properties": {"title": PROFILES_SHEET}
                    }
                })
            if HISTORY_SHEET not in existing:
                requests.append({
                    "addSheet": {
                        "properties": {"title": HISTORY_SHEET}
                    }
                })

            if requests:
                self.sheets.batchUpdate(
                    spreadsheetId=self.spreadsheet_id,
                    body={"requests": requests}
                ).execute()

            # Set headers if sheets are new
            if PROFILES_SHEET not in existing:
                self._write_row(PROFILES_SHEET, 1, ["name", "config_json", "updated_at"])
            if HISTORY_SHEET not in existing:
                self._write_row(HISTORY_SHEET, 1, ["stock_id", "stock_name", "last_updated"])

            logger.info("Google Sheets worksheets verified/created successfully.")
        except HttpError as e:
            logger.error(f"Failed to initialize worksheets: {e}")
            raise

    def _ensure_cache_sheet(self, stock_id: str) -> str:
        """Ensure a cache sheet exists for the given stock_id. Returns sheet name."""
        sheet_name = f"{CACHE_PREFIX}{stock_id}"
        try:
            existing = self._get_existing_sheets()
            if sheet_name not in existing:
                self.sheets.batchUpdate(
                    spreadsheetId=self.spreadsheet_id,
                    body={"requests": [{"addSheet": {"properties": {"title": sheet_name}}}]}
                ).execute()
                logger.info(f"Created cache sheet: {sheet_name}")
        except HttpError as e:
            logger.warning(f"Failed to create cache sheet {sheet_name}: {e}")
        return sheet_name

    def _read_all_rows(self, sheet_name: str) -> list[list[str]]:
        """Read all rows from a worksheet."""
        try:
            result = self.sheets.values().get(
                spreadsheetId=self.spreadsheet_id,
                range=f"'{sheet_name}'!A:Z"
            ).execute()
            return result.get("values", [])
        except HttpError as e:
            logger.error(f"Failed to read from {sheet_name}: {e}")
            return []

    def _write_row(self, sheet_name: str, row_num: int, values: list):
        """Write a single row to a specific position."""
        self.sheets.values().update(
            spreadsheetId=self.spreadsheet_id,
            range=f"'{sheet_name}'!A{row_num}",
            valueInputOption="RAW",
            body={"values": [values]}
        ).execute()

    def _append_row(self, sheet_name: str, values: list):
        """Append a row to the end of a worksheet."""
        self.sheets.values().append(
            spreadsheetId=self.spreadsheet_id,
            range=f"'{sheet_name}'!A:Z",
            valueInputOption="RAW",
            insertDataOption="INSERT_ROWS",
            body={"values": [values]}
        ).execute()

    def _clear_sheet(self, sheet_name: str):
        """Clear all data in a worksheet (keeps the sheet itself)."""
        try:
            self.sheets.values().clear(
                spreadsheetId=self.spreadsheet_id,
                range=f"'{sheet_name}'!A:Z",
                body={}
            ).execute()
        except HttpError:
            pass

    def _write_all_rows(self, sheet_name: str, rows: list[list]):
        """Write multiple rows at once (overwrites existing content)."""
        if not rows:
            return
        self.sheets.values().update(
            spreadsheetId=self.spreadsheet_id,
            range=f"'{sheet_name}'!A1",
            valueInputOption="RAW",
            body={"values": rows}
        ).execute()

    def _delete_rows_by_key(self, sheet_name: str, key_col_idx: int, key_value: str):
        """Delete rows where a specific column matches a value."""
        rows = self._read_all_rows(sheet_name)
        if len(rows) <= 1:  # Only header or empty
            return

        # Find rows to keep (header + non-matching rows)
        kept = [rows[0]]  # Keep header
        for row in rows[1:]:
            if len(row) > key_col_idx and row[key_col_idx] == key_value:
                continue  # Skip matching row
            kept.append(row)

        # Rewrite entire sheet
        self._clear_sheet(sheet_name)
        if kept:
            self._write_all_rows(sheet_name, kept)

    # =========================================================================
    # Profile Management
    # =========================================================================

    def get_all_profiles(self) -> dict:
        """
        Get all saved profiles.
        Returns: { "profile_name": { ...config... }, ... }
        """
        rows = self._read_all_rows(PROFILES_SHEET)
        profiles = {}
        for row in rows[1:]:  # Skip header
            if len(row) >= 2:
                name = row[0]
                try:
                    config = json.loads(row[1])
                    profiles[name] = config
                except (json.JSONDecodeError, IndexError):
                    logger.warning(f"Skipping malformed profile row: {row[0]}")
        return profiles

    def save_profile(self, name: str, config: dict) -> None:
        """Save or update a named profile."""
        now = datetime.now().isoformat()
        config_json = json.dumps(config, ensure_ascii=False)

        # Delete existing profile with same name, then append
        self._delete_rows_by_key(PROFILES_SHEET, 0, name)
        self._append_row(PROFILES_SHEET, [name, config_json, now])
        logger.info(f"Profile '{name}' saved to Google Sheets.")

    def delete_profile(self, name: str) -> None:
        """Delete a named profile."""
        self._delete_rows_by_key(PROFILES_SHEET, 0, name)
        logger.info(f"Profile '{name}' deleted from Google Sheets.")

    # =========================================================================
    # Query History
    # =========================================================================

    def get_history(self) -> list:
        """
        Get stock query history.
        Returns: [ { "stock_id": "2330", "stock_name": "台積電", "last_updated": "..." }, ... ]
        """
        rows = self._read_all_rows(HISTORY_SHEET)
        history = []
        for row in rows[1:]:  # Skip header
            if len(row) >= 2:
                entry = {
                    "stock_id": row[0],
                    "stock_name": row[1] if len(row) > 1 else "",
                    "last_updated": row[2] if len(row) > 2 else ""
                }
                history.append(entry)
        return history

    def update_history(self, stock_id: str, stock_name: str) -> None:
        """Add or update a stock in the query history."""
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Remove existing entry for this stock_id
        self._delete_rows_by_key(HISTORY_SHEET, 0, stock_id)

        # Append updated entry
        self._append_row(HISTORY_SHEET, [stock_id, stock_name, now])

    # =========================================================================
    # Stock Price Cache (Google Sheets — one tab per stock)
    # =========================================================================

    def get_stock_cache(self, stock_id: str) -> Optional[pd.DataFrame]:
        """
        Load cached stock data from Google Sheets.
        Uses in-memory cache first, then falls back to Sheets API.
        Returns DataFrame or None if no cache exists.
        """
        # Try in-memory cache first (fastest)
        if stock_id in self._memory_cache:
            logger.info(f"Stock {stock_id} loaded from memory cache.")
            return self._memory_cache[stock_id].copy()

        # Try Google Sheets
        sheet_name = f"{CACHE_PREFIX}{stock_id}"
        try:
            rows = self._read_all_rows(sheet_name)
            if len(rows) <= 1:  # Empty or header only
                return None

            header = rows[0]
            data = rows[1:]
            df = pd.DataFrame(data, columns=header)

            # Convert numeric columns
            for col in ['open', 'max', 'min', 'close', 'Trading_Volume', 'spread']:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors='coerce')

            # Cache in memory for this instance
            self._memory_cache[stock_id] = df.copy()
            logger.info(f"Stock {stock_id} loaded from Google Sheets ({len(df)} rows).")
            return df
        except HttpError as e:
            if "Unable to parse range" in str(e) or "not found" in str(e).lower():
                return None  # Sheet doesn't exist yet
            logger.warning(f"Failed to read stock cache for {stock_id}: {e}")
            return None
        except Exception as e:
            logger.warning(f"Failed to parse stock cache for {stock_id}: {e}")
            return None

    def save_stock_cache(self, stock_id: str, df: pd.DataFrame) -> None:
        """
        Save stock data to Google Sheets (one tab per stock).
        Overwrites all existing data in the sheet.
        """
        if df is None or df.empty:
            return

        sheet_name = self._ensure_cache_sheet(stock_id)

        try:
            # Convert DataFrame to list of lists
            header = df.columns.tolist()
            # Convert all values to strings for Sheets API
            data_rows = df.astype(str).values.tolist()
            all_rows = [header] + data_rows

            # Clear and rewrite
            self._clear_sheet(sheet_name)
            self._write_all_rows(sheet_name, all_rows)

            # Update memory cache
            self._memory_cache[stock_id] = df.copy()
            logger.info(f"Stock {stock_id} saved to Google Sheets ({len(df)} rows).")
        except HttpError as e:
            logger.error(f"Failed to save stock cache for {stock_id}: {e}")
        except Exception as e:
            logger.error(f"Unexpected error saving stock cache for {stock_id}: {e}")


def create_storage() -> Optional[SheetsStorage]:
    """
    Factory function to create a SheetsStorage instance from environment variables.
    Returns None if configuration is missing (falls back to local storage).
    """
    spreadsheet_id = os.environ.get("GOOGLE_SHEETS_ID")
    credentials_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")

    if not spreadsheet_id:
        logger.warning("GOOGLE_SHEETS_ID not set. Google Sheets storage disabled.")
        return None

    try:
        storage = SheetsStorage(
            spreadsheet_id=spreadsheet_id,
            credentials_path=credentials_path
        )
        logger.info(f"Google Sheets storage initialized (ID: {spreadsheet_id})")
        return storage
    except Exception as e:
        logger.error(f"Failed to initialize Google Sheets storage: {e}")
        return None
