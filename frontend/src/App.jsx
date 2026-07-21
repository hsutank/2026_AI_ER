import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Sun, Moon, ShieldAlert } from 'lucide-react';
import ConfigPanel from './components/ConfigPanel';
import ChartSection from './components/ChartSection';
import TradesTable from './components/TradesTable';
import DetailPanel from './components/DetailPanel';
import KPICards from './components/KPICards';
import SimulationPlayer from './components/SimulationPlayer';

// Inline Sparkline component for table cell rendering
function Sparkline({ data }) {
  if (!data || data.length === 0) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min + 1e-10;
  const width = 80;
  const height = 20;
  
  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  const isUp = data[data.length - 1] >= data[0];
  const strokeColor = isUp ? '#10b981' : '#ef4444';
  
  return (
    <svg width={width} height={height} className="overflow-visible inline-block">
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        points={points}
      />
    </svg>
  );
}

export default function App() {
  const [dark, setDark] = useState(true);
  
  // Target Stock Name Metadata
  const [stockInfo, setStockInfo] = useState({
    stock_id: '2330',
    stock_name: '台積電',
    industry_category: '半導體業',
  });

  // Helper date generators
  function getTodayString() {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }

  function getPastDateString(daysAgo) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
  }
  
  // Backtest and scan config state
  const [config, setConfig] = useState({
    stock_id: '2330',
    timeframe: '1d',
    bars: 1000,
    start_date: getPastDateString(180), // default 6 months ago
    end_date: getTodayString(),
    enabled_conditions: {
      rsi: true,
      macd: true,
      kd: true,
      williams_r: false,
      cci: false,
      sma: true,
      ema: false,
      adx: false,
      bb: true,
      atr: false,
      std_dev: false,
      obv: false,
      mfi: false,
      cmf: false,
      vwap: false,
    },
    entry_logic: 'AND',
    entry_sequence: [
      { id: 'rsi', gate: 'AND' },
      { id: 'macd', gate: 'AND' },
      { id: 'kd', gate: 'AND' },
      { id: 'sma', gate: 'AND' },
      { id: 'bb', gate: null }
    ],
    exit_sequence: [
      { id: 'rsi', gate: 'OR' },
      { id: 'macd', gate: 'OR' },
      { id: 'kd', gate: 'OR' },
      { id: 'sma', gate: 'OR' },
      { id: 'bb', gate: null }
    ],
    trials: 500,
    fitness_metric: 'sharpe_ratio',
    max_entry_rules: 3,
    max_exit_rules: 2,
    min_trades: 5,
    initial_cash: 1000000,
    fee_rate: 0.002,
    risk_params: {
      sl_enabled: true,
      sl_mode: 'Percent',
      sl_val: 3.0,
      pt_enabled: true,
      pt_mode: 'Percent',
      pt_val: 5.0,
      ts_enabled: false,
      ts_mode: 'Percent',
      ts_val: 2.0,
      max_hold_enabled: false,
      max_hold_bars: 10,
      exit_friday: false
    },
    params: {
      rsi_window: 14,
      kd_window: 9,
      kd_smooth_k: 3,
      kd_smooth_d: 3,
      macd_fast: 12,
      macd_slow: 26,
      macd_signal: 9,
      bb_window: 20,
      bb_std: 2.0,
      sma_short: 5,
      sma_mid: 20,
      sma_long: 60,
      ema_short: 10,
      ema_long: 30,
      adx_window: 14,
      atr_window: 14,
      std_window: 20,
      williams_window: 14,
      cci_window: 14,
      mfi_window: 14,
      cmf_window: 20,
      vwap_window: 20,
    }
  });

  // Results state
  const [results, setResults] = useState(null);
  const [selectedStrategyIndex, setSelectedStrategyIndex] = useState(0);
  const [selectedTrade, setSelectedTrade] = useState(null);

  // Time simulation player states
  const [simIndex, setSimIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  // History list state
  const [historyList, setHistoryList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Handle dark mode toggle
  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [dark]);

  // Fetch history list of previously queried stocks
  const fetchHistoryList = async () => {
    try {
      const res = await axios.get('/api/history');
      setHistoryList(res.data);
    } catch (err) {
      console.error("Failed to fetch history list", err);
    }
  };

  // Initial load
  useEffect(() => {
    const initApp = async () => {
      try {
        const res = await axios.get('/api/profiles');
        if (res.data && res.data.latest) {
          setConfig(res.data.latest);
          runAnalysis(res.data.latest);
        } else {
          runAnalysis();
        }
      } catch (err) {
        console.error("Failed to fetch initial profile:", err);
        runAnalysis();
      }
      fetchHistoryList();
    };
    initApp();
  }, []);

  const runAnalysis = async (customConfig = null) => {
    setLoading(true);
    setError(null);
    setSelectedTrade(null);
    setSelectedStrategyIndex(0);
    const activeConfig = customConfig || config;
    try {
      // Auto-save current config to backend as "latest"
      axios.post('/api/profiles', {
        name: 'latest',
        config: activeConfig
      }).catch(err => console.error("Failed to auto-save configuration:", err));

      // 1. Fetch stock name metadata
      const infoRes = await axios.get(`/api/stock-info?stock_id=${activeConfig.stock_id}`);
      setStockInfo(infoRes.data);

      // 2. Fetch backtest and predictions
      const res = await axios.post('/api/backtest-and-predict', activeConfig);
      if (res.data.status === 'success') {
        setResults(res.data);
        // Initialize simulation to the last index (complete view)
        setSimIndex(res.data.history.length - 1);
        setIsPlaying(false);
        fetchHistoryList();
      } else {
        setError('執行失敗，請檢查輸入參數。');
      }
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.detail || err.message;
      setError(`連線或執行錯誤: ${detail}`);
    } finally {
      setLoading(false);
    }
  };

  // Compute selected strategy and dynamic sliced simulation data
  const selectedStrategy = results?.strategies?.[selectedStrategyIndex] || null;
  const totalBars = results?.history?.length || 0;
  const currentDate = results?.history?.[simIndex]?.date || '';

  // Sliced datasets for replay simulation
  const slicedHistory = results ? results.history.slice(0, simIndex + 1) : [];
  const slicedEquityCurve = selectedStrategy ? selectedStrategy.equity_curve.slice(0, simIndex + 1) : [];
  const slicedBenchmarkIndex = results && results.benchmark_index ? results.benchmark_index.slice(0, simIndex + 1) : [];
  const filteredTrades = selectedStrategy ? selectedStrategy.trades.filter(t => t.date <= currentDate) : [];

  // Filter passivation regions that starts before currentDate (and clip end date if needed)
  const filteredPassivation = results?.passivation_regions ? results.passivation_regions.filter(
    r => r.start_date <= currentDate
  ).map(r => ({
    ...r,
    end_date: r.end_date > currentDate ? currentDate : r.end_date
  })) : [];

  // Re-calculate real-time portfolio metrics up to the active simulation index
  const computedSummary = selectedStrategy ? {
    total_return_pct: parseFloat((((slicedEquityCurve[slicedEquityCurve.length - 1]?.strategy_equity || config.initial_cash) - config.initial_cash) / config.initial_cash * 100).toFixed(2)),
    buy_hold_return_pct: parseFloat((((slicedEquityCurve[slicedEquityCurve.length - 1]?.buy_hold_equity || config.initial_cash) - config.initial_cash) / config.initial_cash * 100).toFixed(2)),
    sharpe_ratio: selectedStrategy.sharpe,
    sortino_ratio: selectedStrategy.sortino,
    calmar_ratio: selectedStrategy.calmar,
    max_drawdown_pct: selectedStrategy.max_dd_pct,
    total_trades: filteredTrades.length,
    win_rate_pct: parseFloat((filteredTrades.filter(t => t.type.includes('Sell')).length > 0
      ? (filteredTrades.filter(t => t.type.includes('Sell') && t.return_pct > 0).length / filteredTrades.filter(t => t.type.includes('Sell')).length * 100)
      : 0).toFixed(2)),
    profit_factor: selectedStrategy.profit_factor,
    cpc: selectedStrategy.cpc,
    expectancy: selectedStrategy.expectancy,
    avg_trade_pct: selectedStrategy.avg_trade_pct,
    verdict: selectedStrategy.verdict,
    entry_rule: selectedStrategy.entry_rule,
    exit_rule: selectedStrategy.exit_rule
  } : null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-darkBg text-zinc-900 dark:text-zinc-200 transition-colors duration-200">
      
      {/* Top Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-darkCard/70 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LineChart className="w-6 h-6 text-blue-500" />
            <div>
              <h1 className="text-lg font-black tracking-tight text-zinc-950 dark:text-zinc-50 uppercase flex items-center gap-2">
                Antigravity 策略搜尋與量化回測系統
              </h1>
              {stockInfo && (
                <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                  當前標的: <span className="font-bold text-zinc-950 dark:text-zinc-300">{stockInfo.stock_name} ({stockInfo.stock_id})</span>
                  {stockInfo.industry_category && ` | 產業: ${stockInfo.industry_category}`}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => setDark(!dark)}
              className="p-2 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-all shadow-sm"
              title="切換深色模式"
            >
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
        
        {/* Error Alert */}
        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/30 text-rose-800 dark:text-rose-400 rounded-xl p-4 flex gap-3 shadow-sm animate-fadeIn">
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
            <div className="text-sm">
              <span className="font-bold">執行錯誤：</span>
              {error}
            </div>
          </div>
        )}

        {/* Configuration Panel - Spans Full Width */}
        <ConfigPanel
          config={config}
          setConfig={setConfig}
          onRun={() => runAnalysis()}
          loading={loading}
          historyList={historyList}
          onSelectHistory={(stockId) => {
            const newConfig = { ...config, stock_id: stockId };
            setConfig(newConfig);
            runAnalysis(newConfig);
          }}
        />

        {/* Loading Overlay */}
        {loading && (
          <div className="flex flex-col items-center justify-center h-[350px] text-zinc-500 dark:text-zinc-400 space-y-4">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-sm font-medium animate-pulse">正在掃描條件庫、回測策略並進行趨勢走勢預估中...</div>
          </div>
        )}

        {/* Dashboard Results layout */}
        {results && !loading && (
          <div className="space-y-6 animate-fadeIn">
            
            {/* KPI Cards Row (for selected strategy - real-time simulated) */}
            {computedSummary && <KPICards summary={computedSummary} />}

            {/* Simulation Player Controller (Floating Dock Replay Style) */}
            <SimulationPlayer
              totalBars={totalBars}
              simIndex={simIndex}
              setSimIndex={setSimIndex}
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
              currentDate={currentDate}
              trades={selectedStrategy ? selectedStrategy.trades : []}
              speed={speed}
              setSpeed={setSpeed}
            />

            {/* Layout Grid */}
            <div className="grid grid-cols-12 gap-6">
              
              {/* Left Column (Table & K-Line Charts) */}
              <div className="col-span-12 xl:col-span-8 space-y-6">
                
                {/* 1. Strategy Scanner Table */}
                <div className="bg-white dark:bg-darkCard border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/20">
                    <h3 className="font-bold text-zinc-950 dark:text-zinc-50 uppercase tracking-wider text-xs">
                      生成策略掃描候選結果 (Top 20 Scanned Strategies)
                    </h3>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      掃描了 {config.trials} 次試驗 | 篩選出 {results.strategies?.length || 0} 個符合最少交易數策略
                    </span>
                  </div>
                  <div className="overflow-x-auto max-h-[300px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-900 backdrop-blur z-10 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="p-3">#</th>
                          <th className="p-3">進場條件 (Entry Rule)</th>
                          <th className="p-3">出場條件 (Exit Rule)</th>
                          <th className="p-3">夏普值 (Sharpe)</th>
                          <th className="p-3">總報酬率 (Return)</th>
                          <th className="p-3">交易數</th>
                          <th className="p-3">最大回撤 (Max DD)</th>
                          <th className="p-3">勝率 (Win %)</th>
                          <th className="p-3">獲利因子</th>
                          <th className="p-3">診斷</th>
                          <th className="p-3 text-center">資產曲線 (Sparkline)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900 font-medium">
                        {results.strategies.map((strat, idx) => {
                          const isSelected = selectedStrategyIndex === idx;
                          const isProfit = strat.return_pct >= 0;
                          
                          return (
                            <tr
                              key={idx}
                              onClick={() => {
                                setSelectedStrategyIndex(idx);
                                setSelectedTrade(null);
                                // Don't reset play index so users can switch strategies instantly at same day
                              }}
                              className={`hover:bg-zinc-50 dark:hover:bg-zinc-900/40 cursor-pointer transition-all ${
                                isSelected 
                                  ? 'bg-blue-50/40 dark:bg-blue-950/20 border-l-4 border-blue-500 font-semibold' 
                                  : ''
                              }`}
                            >
                              <td className="p-3 text-zinc-400 font-mono">{idx + 1}</td>
                              <td className="p-3 truncate max-w-[160px]" title={strat.entry_rule}>{strat.entry_rule}</td>
                              <td className="p-3 truncate max-w-[160px]" title={strat.exit_rule}>{strat.exit_rule}</td>
                              <td className="p-3 font-bold font-mono text-zinc-950 dark:text-zinc-100">{strat.sharpe}</td>
                              <td className={`p-3 font-mono font-bold ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {isProfit ? '+' : ''}{strat.return_pct}%
                              </td>
                              <td className="p-3 font-mono">{strat.trades_count} 次</td>
                              <td className="p-3 font-mono text-rose-500">{strat.max_dd_pct}%</td>
                              <td className="p-3 font-mono">{strat.win_rate_pct}%</td>
                              <td className="p-3 font-mono">{strat.profit_factor}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                  strat.verdict === 'Stable Edge' 
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                                    : strat.verdict === 'Likely Overfit'
                                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400'
                                    : 'bg-zinc-150 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                                }`}>
                                  {strat.verdict}
                                </span>
                              </td>
                              <td className="p-2 text-center">
                                <Sparkline data={strat.sparkline} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 2. Chart Section (Price / Selected Strategy curve - sliced simulation) */}
                <ChartSection
                  history={slicedHistory}
                  forecast={results.forecast_path}
                  equityCurve={slicedEquityCurve}
                  passivationRegions={filteredPassivation}
                  benchmarkIndex={slicedBenchmarkIndex}
                  benchmarkName={results.benchmark_name}
                  dark={dark}
                />
                
                {/* 3. Selected Strategy Trades list (filtered simulation) */}
                <TradesTable
                  trades={filteredTrades}
                  onSelectTrade={(trade) => setSelectedTrade(trade)}
                  selectedTradeId={selectedTrade?.id}
                />

              </div>

              {/* Right Column (Strategy metrics & AI predictions) */}
              <div className="col-span-12 xl:col-span-4">
                <DetailPanel
                  summary={computedSummary}
                  predictions={results.predictions_summary}
                  selectedTrade={selectedTrade}
                  onCloseSelectedTrade={() => setSelectedTrade(null)}
                />
              </div>

            </div>

          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-6 mt-12 bg-white/40 dark:bg-darkCard/10">
        <div className="max-w-[1600px] mx-auto px-6 text-center text-xs text-zinc-400 dark:text-zinc-500 font-mono">
          Antigravity Strategy Scanner Platform © 2026 | Powered by FinMind API & Ridge Regression
        </div>
      </footer>

    </div>
  );
}
