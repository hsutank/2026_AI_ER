import React from 'react';
import { TrendingUp, Award, Activity, BarChart2, ShieldAlert } from 'lucide-react';

export default function KPICards({ summary }) {
  if (!summary) return null;

  const cards = [
    {
      title: '策略總報酬率 (Strategy Return)',
      value: `${summary.total_return_pct}%`,
      subLabel: `對比基準持有: ${summary.buy_hold_return_pct}%`,
      icon: TrendingUp,
      status: summary.total_return_pct >= 0 ? 'success' : 'danger',
    },
    {
      title: '夏普值 (Sharpe Ratio)',
      value: summary.sharpe_ratio,
      subLabel: '夏普值 > 1 代表策略表現優異',
      icon: Award,
      status: summary.sharpe_ratio >= 1.0 ? 'success' : (summary.sharpe_ratio > 0 ? 'warning' : 'danger'),
    },
    {
      title: '最大資金回撤 (Max Drawdown)',
      value: `${summary.max_drawdown_pct}%`,
      subLabel: '歷史回測期間最大資產跌幅',
      icon: ShieldAlert,
      status: summary.max_drawdown_pct >= -15 ? 'success' : 'danger',
    },
    {
      title: '勝率 / 交易次數 (Win Rate / Trades)',
      value: `${summary.win_rate_pct}%`,
      subLabel: `總交易數: ${summary.total_trades} 次 | 獲利因子: ${summary.profit_factor}`,
      icon: Activity,
      status: summary.win_rate_pct >= 50 ? 'success' : 'warning',
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {cards.map((card, i) => {
        const Icon = card.icon;
        
        let pillColorClass = 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
        let borderColorClass = 'border-zinc-200 dark:border-zinc-800';
        
        if (card.status === 'success') {
          pillColorClass = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400';
        } else if (card.status === 'danger') {
          pillColorClass = 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400';
        } else if (card.status === 'warning') {
          pillColorClass = 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400';
        }

        return (
          <div 
            key={i} 
            className={`bg-white dark:bg-darkCard border ${borderColorClass} rounded-xl p-4 glow-card flex flex-col justify-between`}
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 block uppercase tracking-wider mb-1">
                  {card.title}
                </span>
                <span className="text-2xl font-extrabold text-zinc-950 dark:text-zinc-50 font-mono">
                  {card.value}
                </span>
              </div>
              <div className={`p-2 rounded-lg ${pillColorClass}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400 border-t border-zinc-100 dark:border-zinc-900 pt-2 flex items-center justify-between">
              <span>{card.subLabel}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
