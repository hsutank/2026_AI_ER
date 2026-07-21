import pandas as pd
import numpy as np
from sklearn.linear_model import Ridge
from statsmodels.tsa.holtwinters import ExponentialSmoothing
import warnings

def generate_predictions(df, horizon_days=60):
    """
    Generate price prediction paths for the next horizon_days (default 60 trading days).
    Returns: list of predictions with date, predicted_price, lower_bound, upper_bound
             and specific horizon metrics (1 week, 1 month, 3 months).
    """
    warnings.filterwarnings('ignore')
    
    df = df.copy()
    df['close'] = df['close'].astype(float)
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date').reset_index(drop=True)
    
    close_prices = df['close'].values
    dates = df['date'].values
    
    # 1. Holt-Winters Exponential Smoothing for smooth curve forecast
    try:
        # Fit Holt-Winters model (Additive trend, no seasonal component for simple stocks)
        # Using additive trend is safer and more stable than multiplicative.
        model = ExponentialSmoothing(
            close_prices, 
            trend='add', 
            seasonal=None, 
            initialization_method='estimated'
        )
        fit = model.fit(optimized=True)
        hw_forecast = fit.forecast(steps=horizon_days)
        
        # Calculate standard error / confidence intervals of HW forecast
        # As a heuristic, we can use the residual variance of the fit
        residuals = fit.resid
        sigma = np.std(residuals)
        
        # Confidence interval widens over time: sigma * sqrt(t)
        hw_lower = []
        hw_upper = []
        for t in range(1, horizon_days + 1):
            margin = 1.96 * sigma * np.sqrt(t) # 95% confidence interval
            hw_lower.append(max(hw_forecast[t-1] - margin, 1.0))
            hw_upper.append(hw_forecast[t-1] + margin)
            
    except Exception as e:
        print(f"Holt-Winters fitting failed: {e}. Falling back to linear trend.")
        # Fallback to Simple Linear Trend
        X = np.arange(len(close_prices)).reshape(-1, 1)
        y = close_prices
        reg = Ridge(alpha=1.0)
        reg.fit(X, y)
        
        future_X = np.arange(len(close_prices), len(close_prices) + horizon_days).reshape(-1, 1)
        hw_forecast = reg.predict(future_X)
        
        # Confidence intervals for linear fallback
        sigma = np.std(y - reg.predict(X))
        hw_lower = [max(hw_forecast[t] - 1.96 * sigma * np.sqrt(t + 1), 1.0) for t in range(horizon_days)]
        hw_upper = [hw_forecast[t] + 1.96 * sigma * np.sqrt(t + 1) for t in range(horizon_days)]

    # 2. Machine Learning Ridge regression for specific target points (5, 20, 60 days)
    # Feature engineering for the ML models
    def create_features(prices):
        feats = []
        # Return features over various windows
        for w in [3, 5, 10, 20]:
            if len(prices) >= w:
                feats.append((prices[-1] / prices[-w]) - 1.0) # return
                feats.append(np.std(np.diff(prices[-w:])) / prices[-1]) # volatility
            else:
                feats.extend([0.0, 0.0])
        # Add SMA relative position
        for w in [5, 20]:
            if len(prices) >= w:
                feats.append(np.mean(prices[-w:]) / prices[-1])
            else:
                feats.append(1.0)
        return np.array(feats)

    # Compile training set for horizons: 5 (1 week), 20 (1 month), 60 (3 months)
    targets = {
        'short': 5,
        'medium': 20,
        'long': 60
    }
    
    ml_predictions = {}
    current_features = create_features(close_prices).reshape(1, -1)
    
    for term, h in targets.items():
        X_train = []
        y_train = []
        # Create rolling training window
        for i in range(20, len(close_prices) - h):
            feat = create_features(close_prices[:i])
            # Target is the return after h days
            target_ret = (close_prices[i + h] / close_prices[i-1]) - 1.0
            X_train.append(feat)
            y_train.append(target_ret)
            
        if len(X_train) > 10:
            reg = Ridge(alpha=10.0)
            reg.fit(np.array(X_train), np.array(y_train))
            pred_ret = reg.predict(current_features)[0]
            # Clip extreme predictions to avoid model instability
            pred_ret = np.clip(pred_ret, -0.4, 0.6)
            pred_price = close_prices[-1] * (1.0 + pred_ret)
            ml_predictions[term] = pred_price
        else:
            # Fall back to HW prediction
            ml_predictions[term] = hw_forecast[h-1]

    # Combine Holt-Winters curve and ML predictions
    # We will adjust the HW forecast path slightly towards the ML points to create a cohesive trend line
    adjusted_forecast = np.array(hw_forecast)
    # Blend target points (linearly interpolate adjustments)
    indices = [4, 19, min(59, horizon_days - 1)] # T+5, T+20, T+60 (0-indexed)
    keys = ['short', 'medium', 'long']
    
    adjustments = np.zeros(horizon_days)
    for idx, key in zip(indices, keys):
        if idx < horizon_days:
            adjustments[idx] = ml_predictions[key] - hw_forecast[idx]
            
    # Interpolate adjustments
    xp = [0] + [idx + 1 for idx in indices if idx < horizon_days]
    fp = [0.0] + [adjustments[idx] for idx in indices if idx < horizon_days]
    full_adjustments = np.interp(np.arange(1, horizon_days + 1), xp, fp)
    
    final_forecast = adjusted_forecast + full_adjustments
    
    # Construct future dates (skipping weekends roughly using business days)
    last_date = pd.Timestamp(dates[-1])
    future_dates = []
    curr = last_date
    while len(future_dates) < horizon_days:
        curr += pd.Timedelta(days=1)
        if curr.weekday() < 5: # 0-4 = Monday-Friday
            future_dates.append(curr.strftime('%Y-%m-%d'))
            
    forecast_list = []
    for t in range(horizon_days):
        forecast_list.append({
            'date': future_dates[t],
            'predicted_price': round(float(final_forecast[t]), 2),
            'lower_bound': round(float(max(hw_lower[t] + full_adjustments[t], 1.0)), 2),
            'upper_bound': round(float(hw_upper[t] + full_adjustments[t]), 2),
        })

    # Summary metrics
    last_price = float(close_prices[-1])
    p_short = forecast_list[4]['predicted_price'] if len(forecast_list) > 4 else final_forecast[0]
    p_medium = forecast_list[19]['predicted_price'] if len(forecast_list) > 19 else final_forecast[0]
    p_long = forecast_list[59]['predicted_price'] if len(forecast_list) > 59 else final_forecast[0]
    
    ret_short = ((p_short - last_price) / last_price) * 100.0
    ret_medium = ((p_medium - last_price) / last_price) * 100.0
    ret_long = ((p_long - last_price) / last_price) * 100.0
    
    def get_verdict(ret):
        if ret > 3.0: return 'Bullish'
        elif ret < -3.0: return 'Bearish'
        return 'Neutral'
        
    summary = {
        'last_price': round(last_price, 2),
        'predictions': {
            'short_term': {
                'days': 5,
                'target_date': future_dates[4] if len(future_dates) > 4 else '',
                'predicted_price': round(p_short, 2),
                'return_pct': round(ret_short, 2),
                'verdict': get_verdict(ret_short)
            },
            'medium_term': {
                'days': 20,
                'target_date': future_dates[19] if len(future_dates) > 19 else '',
                'predicted_price': round(p_medium, 2),
                'return_pct': round(ret_medium, 2),
                'verdict': get_verdict(ret_medium)
            },
            'long_term': {
                'days': 60,
                'target_date': future_dates[59] if len(future_dates) > 59 else '',
                'predicted_price': round(p_long, 2),
                'return_pct': round(ret_long, 2),
                'verdict': get_verdict(ret_long)
            }
        }
    }
    
    return summary, forecast_list
