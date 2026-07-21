import React from 'react';
import { X, TrendingUp, Cpu, BarChart3, AlertTriangle, CheckCircle, HelpCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function DetailPanel({ summary, predictions, selectedTrade, onCloseSelectedTrade }) {
  if (!summary || !predictions) return null;

  const preds = [
    {
      label: '短期預估 (1周內 / 5日)',
      data: predictions.predictions.short_term,
    },
    {
      label: '中期預估 (1月內 / 20日)',
      data: predictions.predictions.medium_term,
    },
    {
      label: '長期預估 (3月內 / 60日)',
      data: predictions.predictions.long_term,
    }
  ];

  const getVerdictStyle = (verdict) => {
    switch (verdict) {
      case 'Stable Edge':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-500/20';
      case 'Likely Overfit':
        return 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-500/20';
      default:
        return 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-700/20';
    }
  };

  const getPredVerdictStyle = (verdict) => {
    switch (verdict) {
      case 'Bullish':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-500/20';
      case 'Bearish':
        return 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-500/20';
      default:
        return 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-700/20';
    }
  };

  const getPredVerdictText = (verdict) => {
    switch (verdict) {
      case 'Bullish': return '看多 (Bullish)';
      case 'Bearish': return '看空 (Bearish)';
      default: return '盤整 (Neutral)';
    }
  };

  // 15+ Detailed Metrics to render
  const metricsList = [
    { name: '夏普值 (Sharpe Ratio)', value: summary.sharpe_ratio, desc: '經風險調整後的超額報酬' },
    { name: '索提諾比率 (Sortino)', value: summary.sortino_ratio, desc: '經下行風險調整的報酬' },
    { name: '卡瑪比率 (Calmar)', value: summary.calmar_ratio, desc: '年化報酬 / 最大回撤比率' },
    { name: '策略總報酬率 (Return)', value: `${summary.total_return_pct}%`, desc: '回測期間累積淨獲利' },
    { name: '基準持有報酬 (Buy & Hold)', value: `${summary.buy_hold_return_pct}%`, desc: '同期間買入並持有報酬' },
    { name: '最大資金回撤 (Max DD)', value: `${summary.max_drawdown_pct}%`, desc: '歷史資產曲線最大跌幅', isRed: true },
    { name: '總交易次數 (Trades)', value: `${summary.total_trades} 次`, desc: '策略觸發並完成的交易數' },
    { name: '交易勝率 (Win Rate)', value: `${summary.win_rate_pct}%`, desc: '獲利交易次數佔比' },
    { name: '獲利因子 (Profit Factor)', value: summary.profit_factor, desc: '總毛獲利 / 總毛虧損' },
    { name: 'CPC 指標 (CPC Index)', value: summary.cpc, desc: 'PF * 勝率，>1 表示具備優勢' },
    { name: '交易期望值 (Expectancy)', value: `${summary.expectancy} TWD`, desc: '單筆交易的平均獲利金額' },
    { name: '單筆平均報酬 (Avg Trade)', value: `${summary.avg_trade_pct}%`, desc: '每次交易的平均報酬率' }
  ];

  return (
    <div className="space-y-4">
      
      {/* Selected Trade Detail Box */}
      {selectedTrade && (
        <div className="bg-blue-50/30 dark:bg-blue-950/10 border border-blue-200 dark:border-blue-900/30 rounded-xl p-4 relative glow-card animate-fadeIn">
          <button 
            onClick={onCloseSelectedTrade}
            className="absolute top-3 right-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          
          <span className="text-[10px] font-bold text-blue-500 dark:text-blue-400 block uppercase tracking-wider mb-2">
            選取交易明細 (Selected Trade #{selectedTrade.id})
          </span>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-400">類型:</span>
              <span className="font-semibold text-zinc-950 dark:text-zinc-50">{selectedTrade.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">日期:</span>
              <span className="font-mono text-zinc-950 dark:text-zinc-50">{selectedTrade.date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">交易價格:</span>
              <span className="font-mono text-zinc-950 dark:text-zinc-50">${selectedTrade.price.toLocaleString()} TWD</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">股數:</span>
              <span className="font-mono text-zinc-950 dark:text-zinc-50">{Math.round(selectedTrade.shares).toLocaleString()} 股</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">交易金額:</span>
              <span className="font-mono text-zinc-950 dark:text-zinc-50">${Math.round(selectedTrade.value).toLocaleString()} TWD</span>
            </div>
            {trade => trade.type.includes('Sell') || selectedTrade.return_pct !== 0 ? (
              <div className="flex justify-between border-t border-blue-200/50 dark:border-blue-900/20 pt-1.5 mt-1.5 font-bold">
                <span className="text-zinc-400">交易回報率:</span>
                <span className={`font-mono flex items-center ${selectedTrade.return_pct >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {selectedTrade.return_pct >= 0 ? <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> : <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />}
                  {selectedTrade.return_pct.toFixed(2)}%
                </span>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Selected Strategy Rules Details */}
      <div className="bg-white dark:bg-darkCard border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 glow-card">
        <h3 className="font-bold text-zinc-950 dark:text-zinc-50 uppercase tracking-wider text-xs mb-3.5 pb-2 border-b border-zinc-100 dark:border-zinc-900 flex items-center gap-1.5">
          <Cpu className="w-4 h-4 text-blue-500" /> 當前選定策略規則 (Rules)
        </h3>
        <div className="space-y-3.5 text-xs">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">進場觸發 (ENTRY RULES)</span>
            <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 p-2.5 rounded-lg font-semibold text-zinc-850 dark:text-zinc-250 leading-relaxed font-mono">
              {summary.entry_rule}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">出場觸發 (EXIT RULES)</span>
            <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 p-2.5 rounded-lg font-semibold text-zinc-850 dark:text-zinc-250 leading-relaxed font-mono">
              {summary.exit_rule}
            </div>
          </div>
        </div>
      </div>

      {/* Deep Performance Metrics List */}
      <div className="bg-white dark:bg-darkCard border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 glow-card">
        <div className="flex justify-between items-center mb-3.5 pb-2 border-b border-zinc-100 dark:border-zinc-900">
          <h3 className="font-bold text-zinc-950 dark:text-zinc-50 uppercase tracking-wider text-xs flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-blue-500" /> 策略深度統計 (Metrics)
          </h3>
          <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${getVerdictStyle(summary.verdict)}`}>
            {summary.verdict}
          </span>
        </div>
        
        <div className="space-y-2.5 max-h-[300px] overflow-y-auto custom-scrollbar">
          {metricsList.map((m, i) => (
            <div key={i} className="flex justify-between items-center text-xs py-1 border-b border-zinc-50 dark:border-zinc-900 last:border-0">
              <div>
                <span className="font-medium text-zinc-700 dark:text-zinc-300 block">{m.name}</span>
                <span className="text-[9px] text-zinc-400 font-normal block">{m.desc}</span>
              </div>
              <span className={`font-mono font-bold text-sm ${m.isRed ? 'text-rose-500' : 'text-zinc-900 dark:text-zinc-50'}`}>
                {m.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Trend Predictions Box */}
      <div className="bg-white dark:bg-darkCard border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 glow-card">
        <h3 className="font-bold text-zinc-950 dark:text-zinc-50 uppercase tracking-wider text-xs mb-3.5 pb-2 border-b border-zinc-100 dark:border-zinc-900 flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-emerald-500" /> AI 價格與走勢預估 (Trend Predictions)
        </h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center text-xs text-zinc-400">
            <span>當前收盤價:</span>
            <span className="font-mono font-bold text-zinc-950 dark:text-zinc-50">${predictions.last_price} TWD</span>
          </div>

          {preds.map((pred, i) => (
            <div key={i} className="border-t border-zinc-100 dark:border-zinc-900 pt-3 first:border-0 first:pt-0">
              <div className="flex justify-between items-start mb-1.5">
                <span className="text-xs font-semibold text-zinc-950 dark:text-zinc-200">
                  {pred.label}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getPredVerdictStyle(pred.data.verdict)}`}>
                  {getPredVerdictText(pred.data.verdict)}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] text-zinc-400 font-mono">
                  目標日期: {pred.data.target_date}
                </span>
                <div className="text-right">
                  <span className="text-sm font-extrabold text-zinc-950 dark:text-zinc-50 font-mono mr-1">
                    ${pred.data.predicted_price}
                  </span>
                  <span className={`text-[10px] font-bold font-mono ${pred.data.return_pct >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {pred.data.return_pct >= 0 ? '+' : ''}{pred.data.return_pct}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
