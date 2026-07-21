import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export default function TradesTable({ trades, onSelectTrade, selectedTradeId }) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  if (!trades || trades.length === 0) {
    return (
      <div className="bg-white dark:bg-darkCard border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 glow-card text-center text-zinc-500 dark:text-zinc-400">
        無交易記錄。此策略在該期間內沒有觸發交易訊號。
      </div>
    );
  }

  // Reverse trades so the newest is at the top
  const sortedTrades = [...trades].reverse();

  // Pagination calculations
  const totalPages = Math.ceil(sortedTrades.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = sortedTrades.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return (
    <div className="bg-white dark:bg-darkCard border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden glow-card">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
        <h3 className="font-semibold text-zinc-950 dark:text-zinc-50 uppercase tracking-wider text-xs">
          交易紀錄明細 (Trades Log)
        </h3>
        <span className="text-[10px] text-zinc-400 font-mono bg-zinc-50 dark:bg-zinc-900 px-2 py-0.5 rounded">
          共 {trades.length} 筆交易
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 font-medium text-xs border-b border-zinc-200 dark:border-zinc-800">
              <th className="p-3">#</th>
              <th className="p-3">種類</th>
              <th className="p-3">日期</th>
              <th className="p-3">價格 (TWD)</th>
              <th className="p-3">股數 (Shares)</th>
              <th className="p-3">交易金額</th>
              <th className="p-3">剩餘現金</th>
              <th className="p-3 text-right">單次報酬率</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {currentItems.map((trade) => {
              const isBuy = trade.type === 'Buy';
              const isSell = trade.type.includes('Sell');
              const isSelected = selectedTradeId === trade.id;

              let typeBadgeClass = 'bg-zinc-100 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-400';
              if (isBuy) {
                typeBadgeClass = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400';
              } else if (isSell) {
                if (trade.type.includes('Stop Loss')) {
                  typeBadgeClass = 'bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/30';
                } else if (trade.type.includes('Profit Target')) {
                  typeBadgeClass = 'bg-teal-50 text-teal-700 dark:bg-teal-950/20 dark:text-teal-400 border border-teal-200/50 dark:border-teal-900/30';
                } else {
                  typeBadgeClass = 'bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400';
                }
              }

              return (
                <tr
                  key={trade.id}
                  onClick={() => onSelectTrade && onSelectTrade(trade)}
                  className={`hover:bg-zinc-50 dark:hover:bg-zinc-900/30 cursor-pointer transition-all duration-150 ${
                    isSelected
                      ? 'bg-blue-50/50 dark:bg-blue-950/20 border-l-2 border-blue-500'
                      : ''
                  }`}
                >
                  <td className="p-3 text-xs font-mono text-zinc-400">{trade.id}</td>
                  <td className="p-3 text-xs">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${typeBadgeClass}`}>
                      {trade.type}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-zinc-600 dark:text-zinc-300 font-mono">{trade.date}</td>
                  <td className="p-3 text-xs font-mono text-zinc-950 dark:text-zinc-100">
                    ${trade.price.toLocaleString()}
                  </td>
                  <td className="p-3 text-xs font-mono text-zinc-600 dark:text-zinc-300">
                    {Math.round(trade.shares).toLocaleString()}
                  </td>
                  <td className="p-3 text-xs font-mono text-zinc-950 dark:text-zinc-100">
                    ${Math.round(trade.value).toLocaleString()}
                  </td>
                  <td className="p-3 text-xs font-mono text-zinc-500 dark:text-zinc-500">
                    ${Math.round(trade.cash).toLocaleString()}
                  </td>
                  <td className="p-3 text-xs text-right font-mono font-bold">
                    {isSell ? (
                      <span className={trade.return_pct >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                        {trade.return_pct >= 0 ? '+' : ''}
                        {trade.return_pct.toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-zinc-400">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20 flex items-center justify-between">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            顯示第 {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, sortedTrades.length)} 筆，共 {sortedTrades.length} 筆
          </span>
          <div className="flex gap-1.5">
            <button
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              className="p-1 border border-zinc-200 dark:border-zinc-800 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-1 border border-zinc-200 dark:border-zinc-800 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-3 py-1 text-xs text-zinc-600 dark:text-zinc-300 font-medium font-mono">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-1 border border-zinc-200 dark:border-zinc-800 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="p-1 border border-zinc-200 dark:border-zinc-800 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
