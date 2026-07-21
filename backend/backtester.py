import pandas as pd
import numpy as np
import random

def calculate_indicators(df, params):
    """
    Calculate all technical indicators from the Signal Library.
    """
    df = df.copy()
    df['close'] = df['close'].astype(float)
    df['open'] = df['open'].astype(float)
    df['max'] = df['max'].astype(float)
    df['min'] = df['min'].astype(float)
    df['Trading_Volume'] = df['Trading_Volume'].astype(float)

    # Expose custom parameters with fallbacks
    rsi_window = int(params.get('rsi_window', 14))
    macd_fast = int(params.get('macd_fast', 12))
    macd_slow = int(params.get('macd_slow', 26))
    macd_signal = int(params.get('macd_signal', 9))
    kd_window = int(params.get('kd_window', 9))
    kd_smooth_k = int(params.get('kd_smooth_k', 3))
    kd_smooth_d = int(params.get('kd_smooth_d', 3))
    williams_window = int(params.get('williams_window', 14))
    cci_window = int(params.get('cci_window', 14))
    sma_short = int(params.get('sma_short', 5))
    sma_mid = int(params.get('sma_mid', 20))
    sma_long = int(params.get('sma_long', 60))
    ema_short = int(params.get('ema_short', 10))
    ema_long = int(params.get('ema_long', 30))
    adx_window = int(params.get('adx_window', 14))
    bb_window = int(params.get('bb_window', 20))
    bb_std = float(params.get('bb_std', 2.0))
    atr_window = int(params.get('atr_window', 14))
    std_window = int(params.get('std_window', 20))
    mfi_window = int(params.get('mfi_window', 14))
    cmf_window = int(params.get('cmf_window', 20))
    vwap_window = int(params.get('vwap_window', 20))

    # --- MOMENTUM ---
    # 1. RSI
    delta = df['close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=rsi_window).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=rsi_window).mean()
    rs = gain / (loss + 1e-10)
    df['rsi_14'] = 100 - (100 / (1 + rs))

    # 2. MACD
    df['ema_fast'] = df['close'].ewm(span=macd_fast, adjust=False).mean()
    df['ema_slow'] = df['close'].ewm(span=macd_slow, adjust=False).mean()
    df['macd_line'] = df['ema_fast'] - df['ema_slow']
    df['macd_signal'] = df['macd_line'].ewm(span=macd_signal, adjust=False).mean()

    # 3. KD
    high_kd = df['max'].rolling(window=kd_window).max()
    low_kd = df['min'].rolling(window=kd_window).min()
    rsv = (df['close'] - low_kd) / (high_kd - low_kd + 1e-10) * 100
    rsv = rsv.fillna(50.0)
    kd_k = []
    kd_d = []
    curr_k = 50.0
    curr_d = 50.0
    for val in rsv:
        curr_k = curr_k * (1.0 - 1.0/kd_smooth_k) + val * (1.0/kd_smooth_k)
        curr_d = curr_d * (1.0 - 1.0/kd_smooth_d) + curr_k * (1.0/kd_smooth_d)
        kd_k.append(curr_k)
        kd_d.append(curr_d)
    df['kd_k'] = kd_k
    df['kd_d'] = kd_d

    # 4. Williams %R
    high_w = df['max'].rolling(window=williams_window).max()
    low_w = df['min'].rolling(window=williams_window).min()
    df['williams_r'] = ((high_w - df['close']) / (high_w - low_w + 1e-10)) * -100.0

    # 5. CCI
    tp = (df['max'] + df['min'] + df['close']) / 3.0
    tp_sma = tp.rolling(window=cci_window).mean()
    tp_mad = tp.rolling(window=cci_window).apply(lambda x: np.mean(np.abs(x - np.mean(x))), raw=True)
    df['cci'] = (tp - tp_sma) / (0.015 * tp_mad + 1e-10)

    # --- TREND ---
    # 6. SMA
    df['sma_5'] = df['close'].rolling(window=sma_short).mean()
    df['sma_20'] = df['close'].rolling(window=sma_mid).mean()
    df['sma_60'] = df['close'].rolling(window=sma_long).mean()

    # 7. EMA
    df['ema_10'] = df['close'].ewm(span=ema_short, adjust=False).mean()
    df['ema_30'] = df['close'].ewm(span=ema_long, adjust=False).mean()

    # 8. ADX
    up_move = df['max'].diff()
    down_move = df['min'].diff()
    plus_dm = np.where((up_move > down_move) & (up_move > 0), up_move, 0.0)
    minus_dm = np.where((down_move > up_move) & (down_move > 0), down_move, 0.0)
    
    tr = pd.concat([df['max'] - df['min'], 
                    (df['max'] - df['close'].shift()).abs(), 
                    (df['min'] - df['close'].shift()).abs()], axis=1).max(axis=1)
                    
    tr_smooth = tr.rolling(window=adx_window).mean()
    plus_di = 100 * (pd.Series(plus_dm).rolling(window=adx_window).mean() / (tr_smooth + 1e-10))
    minus_di = 100 * (pd.Series(minus_dm).rolling(window=adx_window).mean() / (tr_smooth + 1e-10))
    dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di + 1e-10)
    
    df['adx'] = dx.rolling(window=adx_window).mean()
    df['plus_di'] = plus_di
    df['minus_di'] = minus_di

    # 9. Bollinger Bands
    df['bb_mid'] = df['close'].rolling(window=bb_window).mean()
    df['bb_std'] = df['close'].rolling(window=bb_window).std()
    df['bb_upper'] = df['bb_mid'] + (df['bb_std'] * bb_std)
    df['bb_lower'] = df['bb_mid'] - (df['bb_std'] * bb_std)

    # 10. ATR
    df['atr_14'] = tr.rolling(window=atr_window).mean()

    # 11. Std Deviation
    df['std_20'] = df['close'].rolling(window=std_window).std()

    # --- VOLUME ---
    # 12. OBV
    obv = [0.0]
    for i in range(1, len(df)):
        if df.loc[i, 'close'] > df.loc[i-1, 'close']:
            obv.append(obv[-1] + df.loc[i, 'Trading_Volume'])
        elif df.loc[i, 'close'] < df.loc[i-1, 'close']:
            obv.append(obv[-1] - df.loc[i, 'Trading_Volume'])
        else:
            obv.append(obv[-1])
    df['obv'] = obv
    df['obv_ema_20'] = df['obv'].ewm(span=20, adjust=False).mean()

    # 13. MFI
    tp = (df['max'] + df['min'] + df['close']) / 3.0
    rmf = tp * df['Trading_Volume']
    pos_flow = np.where(tp > tp.shift(1), rmf, 0.0)
    neg_flow = np.where(tp < tp.shift(1), rmf, 0.0)
    pos_mfr = pd.Series(pos_flow).rolling(window=mfi_window).sum()
    neg_mfr = pd.Series(neg_flow).rolling(window=mfi_window).sum()
    mfr = pos_mfr / (neg_mfr + 1e-10)
    df['mfi_14'] = 100 - (100 / (1 + mfr))

    # 14. CMF
    mfm = ((df['close'] - df['min']) - (df['max'] - df['close'])) / (df['max'] - df['min'] + 1e-10)
    mfv = mfm * df['Trading_Volume']
    df['cmf_20'] = mfv.rolling(window=cmf_window).sum() / (df['Trading_Volume'].rolling(window=cmf_window).sum() + 1e-10)

    # 15. VWAP
    tp_vol = tp * df['Trading_Volume']
    df['vwap_20'] = tp_vol.rolling(window=vwap_window).sum() / (df['Trading_Volume'].rolling(window=vwap_window).sum() + 1e-10)

    return df

def detect_passivation(df):
    """
    Detect KD and RSI high-level and low-level passivation regions.
    """
    regions = []
    kd_high_start, kd_high_count = None, 0
    kd_low_start, kd_low_count = None, 0
    rsi_high_start, rsi_high_count = None, 0
    rsi_low_start, rsi_low_count = None, 0
    
    for i in range(len(df)):
        date = df.loc[i, 'date']
        k_val = df.loc[i, 'kd_k']
        rsi_val = df.loc[i, 'rsi_14']
        
        # KD High
        if not pd.isna(k_val) and k_val >= 80:
            if kd_high_start is None: kd_high_start = date
            kd_high_count += 1
        else:
            if kd_high_count >= 3:
                regions.append({"start_date": kd_high_start, "end_date": df.loc[i-1, 'date'], "type": "high_passivation", "indicator": "KD", "label": "KD 高檔強勢"})
            kd_high_start, kd_high_count = None, 0
            
        # KD Low
        if not pd.isna(k_val) and k_val <= 20:
            if kd_low_start is None: kd_low_start = date
            kd_low_count += 1
        else:
            if kd_low_count >= 3:
                regions.append({"start_date": kd_low_start, "end_date": df.loc[i-1, 'date'], "type": "low_passivation", "indicator": "KD", "label": "KD 低檔弱勢"})
            kd_low_start, kd_low_count = None, 0

        # RSI High
        if not pd.isna(rsi_val) and rsi_val >= 70:
            if rsi_high_start is None: rsi_high_start = date
            rsi_high_count += 1
        else:
            if rsi_high_count >= 3:
                regions.append({"start_date": rsi_high_start, "end_date": df.loc[i-1, 'date'], "type": "high_passivation", "indicator": "RSI", "label": "RSI 高檔強勢"})
            rsi_high_start, rsi_high_count = None, 0

        # RSI Low
        if not pd.isna(rsi_val) and rsi_val <= 30:
            if rsi_low_start is None: rsi_low_start = date
            rsi_low_count += 1
        else:
            if rsi_low_count >= 3:
                regions.append({"start_date": rsi_low_start, "end_date": df.loc[i-1, 'date'], "type": "low_passivation", "indicator": "RSI", "label": "RSI 低檔弱勢"})
            rsi_low_start, rsi_low_count = None, 0
            
    if kd_high_count >= 3: regions.append({"start_date": kd_high_start, "end_date": df.iloc[-1]['date'], "type": "high_passivation", "indicator": "KD", "label": "KD 高檔強勢"})
    if kd_low_count >= 3: regions.append({"start_date": kd_low_start, "end_date": df.iloc[-1]['date'], "type": "low_passivation", "indicator": "KD", "label": "KD 低檔弱勢"})
    if rsi_high_count >= 3: regions.append({"start_date": rsi_high_start, "end_date": df.iloc[-1]['date'], "type": "high_passivation", "indicator": "RSI", "label": "RSI 高檔強勢"})
    if rsi_low_count >= 3: regions.append({"start_date": rsi_low_start, "end_date": df.iloc[-1]['date'], "type": "low_passivation", "indicator": "RSI", "label": "RSI 低檔弱勢"})
        
    return regions

def generate_strategies(df, enabled_conditions, entry_logic_sequence, exit_logic_sequence, trials, fitness_metric, max_entry_rules, max_exit_rules, min_trades, initial_cash, fee_rate, risk_params, params):
    """
    Search/generate multiple random strategies and backtest them.
    Returns: list of top 20 strategies
    """
    risk_free_rate = 1.5
    df_ind = calculate_indicators(df, params)
    df_ind = df_ind.dropna(subset=['close']).reset_index(drop=True)
    
    # 1. Define candidate conditions based on checked signals in the library
    candidates = []
    
    # Momentum candidates
    if enabled_conditions.get('rsi'):
        candidates.append(('rsi_14', '<', 30, '[Buy] RSI < 30', '[Sell] RSI > 70'))
        candidates.append(('rsi_14', '<', 40, '[Buy] RSI < 40', '[Sell] RSI > 60'))
    if enabled_conditions.get('macd'):
        candidates.append(('macd_line', '>', 0, '[Buy] MACD > 0', '[Sell] MACD < 0'))
    if enabled_conditions.get('kd'):
        candidates.append(('kd_k', '>', 50, '[Buy] K > 50', '[Sell] K < 50'))
        candidates.append(('kd_k', '>', 80, '[Buy] K > 80 (高檔強勢)', '[Sell] K < 20 (低檔弱勢)'))
    if enabled_conditions.get('williams_r'):
        candidates.append(('williams_r', '<', -80, '[Buy] Williams %R < -80', '[Sell] Williams %R > -20'))
    if enabled_conditions.get('cci'):
        candidates.append(('cci', '<', -100, '[Buy] CCI < -100', '[Sell] CCI > 100'))
        
    # Trend candidates
    if enabled_conditions.get('sma'):
        candidates.append(('close', '>', 20, '[Buy] 收盤價 > SMA20', '[Sell] 收盤價 < SMA20'))
        candidates.append(('sma_5', '>', 20, '[Buy] SMA5 > SMA20', '[Sell] SMA5 < SMA20'))
    if enabled_conditions.get('ema'):
        candidates.append(('close', '>', 10, '[Buy] 收盤價 > EMA10', '[Sell] 收盤價 < EMA10'))
    if enabled_conditions.get('adx'):
        candidates.append(('adx', '>', 25, '[Buy] ADX 趨勢強度 > 25', '[Sell] ADX < 20'))
    if enabled_conditions.get('bb'):
        candidates.append(('close', '<', 'bb_lower', '[Buy] 收盤價跌破布林下軌', '[Sell] 收盤價突破布林上軌'))
        
    # Volume candidates
    if enabled_conditions.get('obv'):
        candidates.append(('obv', '>', 'obv_ema_20', '[Buy] OBV > EMA20', '[Sell] OBV < EMA20'))
    if enabled_conditions.get('mfi'):
        candidates.append(('mfi_14', '<', 20, '[Buy] MFI < 20', '[Sell] MFI > 80'))
    if enabled_conditions.get('cmf'):
        candidates.append(('cmf_20', '>', 0, '[Buy] CMF > 0', '[Sell] CMF < 0'))
    if enabled_conditions.get('vwap'):
        candidates.append(('close', '>', 'vwap_20', '[Buy] 收盤價 > VWAP', '[Sell] 收盤價 < VWAP'))

    # If no library indicators are checked, provide default SMA & RSI candidates
    if not candidates:
        candidates = [
            ('rsi_14', '<', 30, '[Buy] RSI < 30', '[Sell] RSI > 70'),
            ('close', '>', 'sma_20', '[Buy] 收盤價 > SMA20', '[Sell] 收盤價 < SMA20')
        ]

    generated_strategies = []
    actual_trials = min(max(trials, 50), 1000)
    random.seed(42)

    for trial_idx in range(actual_trials):
        num_entry = random.randint(1, min(max_entry_rules, len(candidates)))
        num_exit = random.randint(1, min(max_exit_rules, len(candidates)))
        
        entry_candidates = random.sample(candidates, num_entry)
        exit_candidates = random.sample(candidates, num_exit)
        
        buy_rules = []
        buy_desc_list = []
        for col, op, val, buy_desc, _ in entry_candidates:
            buy_rules.append((col, op, val))
            buy_desc_list.append(buy_desc)
            
        sell_rules = []
        sell_desc_list = []
        for col, op, val, _, sell_desc in exit_candidates:
            sell_op = '>' if op == '<' else '<'
            sell_val = val
            if val == 'bb_lower': sell_val = 'bb_upper'
            elif val == 'obv_ema_20': sell_val = 'obv_ema_20'
            elif val == 'vwap_20': sell_val = 'vwap_20'
            
            sell_rules.append((col, sell_op, sell_val))
            sell_desc_list.append(sell_desc)

        # Helper to format nested parenthesis text based on sequence
        def format_rule_text(desc_list, sequence):
            if not desc_list:
                return "無條件"
            
            def get_indicator_id_from_desc(desc):
                d_lower = desc.lower()
                if 'rsi' in d_lower: return 'rsi'
                if 'macd' in d_lower: return 'macd'
                if 'kd' in d_lower: return 'kd'
                if 'williams' in d_lower: return 'williams_r'
                if 'cci' in d_lower: return 'cci'
                if 'sma' in d_lower: return 'sma'
                if 'ema' in d_lower: return 'ema'
                if 'adx' in d_lower: return 'adx'
                if 'bb' in d_lower or '布林' in d_lower: return 'bb'
                if 'atr' in d_lower: return 'atr'
                if 'std' in d_lower: return 'std_dev'
                if 'obv' in d_lower: return 'obv'
                if 'mfi' in d_lower: return 'mfi'
                if 'cmf' in d_lower: return 'cmf'
                if 'vwap' in d_lower: return 'vwap'
                return None

            desc_by_id = {}
            for desc in desc_list:
                ind_id = get_indicator_id_from_desc(desc)
                if ind_id:
                    desc_by_id[ind_id] = desc

            active_seq = [item for item in sequence if item.get('id') in desc_by_id]
            if not active_seq:
                return " AND ".join(desc_list)
            
            text = desc_by_id[active_seq[0]['id']]
            for k in range(1, len(active_seq)):
                op = active_seq[k-1].get('gate', 'AND')
                next_desc = desc_by_id[active_seq[k]['id']]
                text = f"({text} {op} {next_desc})"
            return text

        buy_rule_text = format_rule_text(buy_desc_list, entry_logic_sequence or [])
        exit_rule_text = format_rule_text(sell_desc_list, exit_logic_sequence or [])
        
        try:
            # Helper to evaluate candidate rules in sequence
            def check_conditions_sequence(row, rules, sequence):
                if not rules:
                    return False
                
                def get_indicator_id(col):
                    col_lower = col.lower()
                    if 'rsi' in col_lower: return 'rsi'
                    if 'macd' in col_lower: return 'macd'
                    if 'kd' in col_lower: return 'kd'
                    if 'williams' in col_lower: return 'williams_r'
                    if 'cci' in col_lower: return 'cci'
                    if 'sma' in col_lower: return 'sma'
                    if 'ema' in col_lower: return 'ema'
                    if 'adx' in col_lower: return 'adx'
                    if 'bb' in col_lower: return 'bb'
                    if 'atr' in col_lower: return 'atr'
                    if 'std' in col_lower: return 'std_dev'
                    if 'obv' in col_lower: return 'obv'
                    if 'mfi' in col_lower: return 'mfi'
                    if 'cmf' in col_lower: return 'cmf'
                    if 'vwap' in col_lower: return 'vwap'
                    return None

                rule_by_ind = {}
                for col, op, val in rules:
                    ind_id = get_indicator_id(col)
                    if ind_id:
                        row_val = row[col]
                        if pd.isna(row_val):
                            val_res = False
                        else:
                            if isinstance(val, str) and val in row:
                                thresh = row[val]
                            else:
                                thresh = float(val) if not isinstance(val, str) else 0.0
                                
                            if pd.isna(thresh):
                                val_res = False
                            elif op == '<':
                                val_res = row_val < thresh
                            elif op == '>':
                                val_res = row_val > thresh
                            else:
                                val_res = False
                        rule_by_ind[ind_id] = val_res

                # Filter sequence
                active_seq = [item for item in sequence if item.get('id') in rule_by_ind]
                if not active_seq:
                    return all(rule_by_ind.values()) if rule_by_ind else False
                
                result = rule_by_ind[active_seq[0]['id']]
                for k in range(1, len(active_seq)):
                    op = active_seq[k-1].get('gate', 'AND')
                    next_val = rule_by_ind[active_seq[k]['id']]
                    if op == 'OR':
                        result = result or next_val
                    else:
                        result = result and next_val
                return result

            cash = initial_cash
            shares = 0.0
            position_entry_price = 0.0
            highest_price_since_entry = 0.0
            bars_in_position = 0
            trades = []
            portfolio_values = []
            buy_and_hold_shares = initial_cash / df_ind.loc[0, 'close']
            
            sl_enabled = risk_params.get('sl_enabled', False)
            sl_val = float(risk_params.get('sl_val', 3.0))
            sl_mode = risk_params.get('sl_mode', 'Percent')
            pt_enabled = risk_params.get('pt_enabled', False)
            pt_val = float(risk_params.get('pt_val', 5.0))
            pt_mode = risk_params.get('pt_mode', 'Percent')
            ts_enabled = risk_params.get('ts_enabled', False)
            ts_val = float(risk_params.get('ts_val', 2.0))
            ts_mode = risk_params.get('ts_mode', 'Percent')
            max_hold_enabled = risk_params.get('max_hold_enabled', False)
            max_hold_bars = int(risk_params.get('max_hold_bars', 10))
            exit_friday = risk_params.get('exit_friday', False)

            trade_counter = 0
            for i in range(len(df_ind)):
                row = df_ind.iloc[i]
                current_date = row['date']
                current_price = float(row['close'])
                current_atr = float(row['atr_14']) if not pd.isna(row['atr_14']) else 10.0
                is_friday = pd.to_datetime(current_date).weekday() == 4

                if shares > 0:
                    bars_in_position += 1
                    highest_price_since_entry = max(highest_price_since_entry, current_price)
                    
                    sl_trig = sl_enabled and (
                        current_price <= position_entry_price * (1.0 - sl_val/100.0) if sl_mode == 'Percent'
                        else current_price <= position_entry_price - (sl_val * current_atr)
                    )
                    pt_trig = pt_enabled and (
                        current_price >= position_entry_price * (1.0 + pt_val/100.0) if pt_mode == 'Percent'
                        else current_price >= position_entry_price + (pt_val * current_atr)
                    )
                    ts_trig = ts_enabled and (
                        current_price <= highest_price_since_entry * (1.0 - ts_val/100.0) if ts_mode == 'Percent'
                        else current_price <= highest_price_since_entry - (ts_val * current_atr)
                    )
                    hold_trig = max_hold_enabled and (bars_in_position >= max_hold_bars)
                    fri_trig = exit_friday and is_friday

                    if sl_trig or pt_trig or ts_trig or hold_trig or fri_trig:
                        exit_t = 'Sell'
                        if sl_trig: exit_t = 'Sell (SL)'
                        elif pt_trig: exit_t = 'Sell (PT)'
                        elif ts_trig: exit_t = 'Sell (TS)'
                        elif hold_trig: exit_t = 'Sell (Hold)'
                        elif fri_trig: exit_t = 'Sell (Friday)'
                        
                        sell_val = shares * current_price
                        fee = sell_val * fee_rate
                        cash += (sell_val - fee)
                        trade_counter += 1
                        trades.append({
                            'id': trade_counter,
                            'type': exit_t,
                            'date': current_date,
                            'price': float(current_price),
                            'shares': float(shares),
                            'value': float(sell_val - fee),
                            'cash': float(cash),
                            'return_pct': float(((current_price - position_entry_price)/position_entry_price)*100.0)
                        })
                        shares, position_entry_price, bars_in_position = 0.0, 0.0, 0
                
                buy_c = check_conditions_sequence(row, buy_rules, entry_logic_sequence or [])
                sell_c = check_conditions_sequence(row, sell_rules, exit_logic_sequence or [])

                if shares == 0.0 and buy_c:
                    buy_val = cash
                    fee = buy_val * fee_rate
                    shares = (buy_val - fee) / current_price
                    cash = 0.0
                    position_entry_price = current_price
                    highest_price_since_entry = current_price
                    bars_in_position = 0
                    trade_counter += 1
                    trades.append({
                        'id': trade_counter,
                        'type': 'Buy',
                        'date': current_date,
                        'price': float(current_price),
                        'shares': float(shares),
                        'value': float(buy_val),
                        'cash': 0.0,
                        'return_pct': 0.0
                    })
                elif shares > 0.0 and sell_c:
                    sell_val = shares * current_price
                    fee = sell_val * fee_rate
                    cash += (sell_val - fee)
                    trade_counter += 1
                    trades.append({
                        'id': trade_counter,
                        'type': 'Sell',
                        'date': current_date,
                        'price': float(current_price),
                        'shares': float(shares),
                        'value': float(sell_val - fee),
                        'cash': float(cash),
                        'return_pct': float(((current_price - position_entry_price)/position_entry_price)*100.0)
                    })
                    shares, position_entry_price, bars_in_position = 0.0, 0.0, 0

                portfolio_values.append({
                    'date': current_date,
                    'price': float(current_price),
                    'strategy_equity': float(cash + (shares * current_price)),
                    'buy_hold_equity': float(buy_and_hold_shares * current_price)
                })

            if shares > 0.0:
                final_p = float(df_ind.iloc[-1]['close'])
                final_d = df_ind.iloc[-1]['date']
                sell_val = shares * final_p
                fee = sell_val * fee_rate
                cash += (sell_val - fee)
                trade_counter += 1
                trades.append({
                    'id': trade_counter,
                    'type': 'Sell (Closeout)',
                    'date': final_d,
                    'price': float(final_p),
                    'shares': float(shares),
                    'value': float(sell_val - fee),
                    'cash': float(cash),
                    'return_pct': float(((final_p - position_entry_price)/position_entry_price)*100.0)
                })
                portfolio_values[-1]['strategy_equity'] = float(cash)

            eq_df = pd.DataFrame(portfolio_values)
            final_val = float(eq_df.iloc[-1]['strategy_equity'])
            
            total_ret = ((final_val - initial_cash) / initial_cash) * 100.0
            bh_ret = ((eq_df.iloc[-1]['buy_hold_equity'] - initial_cash) / initial_cash) * 100.0
            
            eq_df['daily_pct'] = eq_df['strategy_equity'].pct_change()
            daily_st = eq_df['daily_pct'].std()
            ann_v = daily_st * np.sqrt(252) if not pd.isna(daily_st) else 0.0
            ann_ret = ((final_val / initial_cash) ** (252.0 / len(df_ind)) - 1.0) * 100.0 if len(df_ind) > 0 else 0.0
            
            sh = (ann_ret - risk_free_rate) / (ann_v * 100.0 + 1e-10) if ann_v > 0 else 0.0
            
            neg_ret = eq_df.loc[eq_df['daily_pct'] < 0, 'daily_pct']
            neg_st = neg_ret.std() * np.sqrt(252) if len(neg_ret) > 1 else 0.0
            sort = (ann_ret - risk_free_rate) / (neg_st * 100.0 + 1e-10) if neg_st > 0 else 0.0

            eq_df['peak'] = eq_df['strategy_equity'].cummax()
            eq_df['dd'] = (eq_df['strategy_equity'] - eq_df['peak']) / eq_df['peak']
            m_dd = eq_df['dd'].min() * 100.0
            
            cal = ann_ret / (abs(m_dd) + 1e-10)
            
            sell_t = [t for t in trades if 'Sell' in t['type']]
            wins_t = [t for t in sell_t if t['return_pct'] > 0]
            win_r = (len(wins_t) / len(sell_t) * 100.0) if len(sell_t) > 0 else 0.0
            
            gross_p = sum([t['shares'] * (t['price'] - float(trades[trades.index(t)-1]['price'])) for t in sell_t if t['return_pct'] > 0])
            gross_l = sum([t['shares'] * (float(trades[trades.index(t)-1]['price']) - t['price']) for t in sell_t if t['return_pct'] <= 0])
            prof_f = (gross_p / (gross_l + 1e-10)) if len(sell_t) > 0 else 0.0
            
            avg_t = total_ret / len(trades) if len(trades) > 0 else 0.0
            cpc_val = prof_f * win_r / 100.0
            exp_val = (win_r / 100.0 * (gross_p/len(wins_t) if len(wins_t) > 0 else 0.0)) - ((1.0 - win_r/100.0) * (gross_l/(len(sell_t)-len(wins_t)) if (len(sell_t)-len(wins_t)) > 0 else 0.0))

            if len(trades) < min_trades:
                continue

            if sh > 2.0: verdict = 'Stable Edge'
            elif sh > 3.0: verdict = 'Likely Overfit'
            elif sh > 0.5: verdict = 'Profitable'
            else: verdict = 'Poor Performance'

            spark_len = len(portfolio_values)
            step = max(1, spark_len // 12)
            sparkline_data = [float(portfolio_values[j]['strategy_equity']) for j in range(0, spark_len, step)]
            sparkline_data = sparkline_data[:12]

            metric_score = sh
            if fitness_metric == 'total_return': metric_score = total_ret
            elif fitness_metric == 'profit_factor': metric_score = prof_f
            elif fitness_metric == 'win_rate': metric_score = win_r

            generated_strategies.append({
                'entry_rule': buy_rule_text,
                'exit_rule': exit_rule_text,
                'fitness': float(round(metric_score, 2)),
                'sharpe': float(round(sh, 3)),
                'sortino': float(round(sort, 3)),
                'calmar': float(round(cal, 3)),
                'return_pct': float(round(total_ret, 2)),
                'buy_hold_return_pct': float(round(bh_ret, 2)),
                'max_dd_pct': float(round(m_dd, 2)),
                'trades_count': int(len(trades)),
                'win_rate_pct': float(round(win_r, 2)),
                'profit_factor': float(round(prof_f, 2)),
                'cpc': float(round(cpc_val, 2)),
                'expectancy': float(round(exp_val, 2)),
                'avg_trade_pct': float(round(avg_t, 2)),
                'verdict': verdict,
                'sparkline': sparkline_data,
                'trades': trades,
                'equity_curve': portfolio_values
            })

        except Exception as e:
            print(f"Skipping strategy evaluation due to error: {e}")
            continue

    generated_strategies = sorted(generated_strategies, key=lambda x: x['fitness'], reverse=True)
    top_strategies = generated_strategies[:20]
    passivation_regions = detect_passivation(df_ind)

    return top_strategies, passivation_regions, df_ind
