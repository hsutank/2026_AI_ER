import React, { useState } from 'react';
import ReactECharts from 'echarts-for-react';

export default function ChartSection({ history, forecast, equityCurve, passivationRegions, benchmarkIndex, benchmarkName, dark }) {
  const [activeTab, setActiveTab] = useState('price');

  if (!history || history.length === 0) return null;

  // Preparing markArea data for passivation zones
  const getMarkAreaData = () => {
    if (!passivationRegions || passivationRegions.length === 0) return [];
    
    return passivationRegions.map((region) => {
      const isHigh = region.type === 'high_passivation';
      const color = isHigh 
        ? 'rgba(239, 68, 68, 0.08)' // Red band for high passivation
        : 'rgba(59, 130, 246, 0.08)'; // Blue band for low passivation
      
      const labelColor = isHigh ? '#f87171' : '#60a5fa';

      return [
        {
          name: `${region.indicator} ${isHigh ? '高檔強勢\n(適合買入/續抱)' : '低檔弱勢\n(適合賣出/觀望)'}`,
          xAxis: region.start_date,
          label: {
            show: true,
            position: 'insideTop',
            distance: 12,
            color: labelColor,
            fontSize: 9,
            formatter: '{b}',
          },
          itemStyle: {
            color: color,
          }
        },
        {
          xAxis: region.end_date,
        }
      ];
    });
  };

  // Preparing Data for Price & Forecast Chart
  const histDates = history.map((item) => item.date);
  const histClose = history.map((item) => parseFloat(item.close));
  
  // Forecast points
  const foreDates = forecast.map((item) => item.date);
  const foreClose = forecast.map((item) => item.predicted_price);
  const foreLower = forecast.map((item) => item.lower_bound);
  const foreUpper = forecast.map((item) => item.upper_bound);

  // Combine dates
  const allDates = [...histDates, ...foreDates];

  // Align benchmark index data if present
  const benchMap = new Map((benchmarkIndex || []).map((item) => [item.date, item.rebased_close]));
  const benchAligned = allDates.map((date) => benchMap.has(date) ? benchMap.get(date) : null);

  // Align historical data to full timeline (fill future dates with null)
  const histCloseAligned = [...histClose, ...Array(foreDates.length).fill(null)];
  
  // Align forecast data to full timeline (fill past with null, but start from the last historical close to connect lines)
  const foreCloseAligned = [
    ...Array(histDates.length - 1).fill(null), 
    histClose[histClose.length - 1], 
    ...foreClose
  ];
  
  // Align bounds
  const foreLowerAligned = [
    ...Array(histDates.length - 1).fill(null), 
    histClose[histClose.length - 1], 
    ...foreLower
  ];
  const foreUpperDiffAligned = [
    ...Array(histDates.length - 1).fill(null), 
    0, // diff at connect point is 0
    ...foreUpper.map((val, idx) => val - foreLower[idx])
  ];

  // ECharts Theme Settings
  const textStyle = {
    fontFamily: 'Inter, sans-serif',
    color: dark ? '#a1a1aa' : '#52525b',
  };
  const gridColor = dark ? '#27272a' : '#e4e4e7';

  // Option 1: Price and Prediction Chart
  const getPriceOption = () => {
    return {
      backgroundColor: 'transparent',
      title: {
        text: '股價歷史走勢與未來 3 個月預估',
        left: 'center',
        textStyle: {
          color: dark ? '#f4f4f5' : '#18181b',
          fontSize: 14,
          fontWeight: 600,
        },
        top: 10,
      },
      legend: {
        data: ['歷史收盤價', '預估價格', '95% 信心區間', benchmarkName || '大盤基準指數'],
        bottom: 10,
        textStyle: textStyle,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
        },
        backgroundColor: dark ? '#0c0c0f' : '#ffffff',
        borderColor: dark ? '#27272a' : '#e4e4e7',
        textStyle: {
          color: dark ? '#f4f4f5' : '#18181b',
        },
      },
      grid: {
        top: 60,
        left: '3%',
        right: '3%',
        bottom: 60,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: allDates,
        axisLine: { lineStyle: { color: gridColor } },
        axisLabel: { textStyle: textStyle },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        scale: true,
        axisLine: { show: false },
        axisLabel: { textStyle: textStyle },
        splitLine: { lineStyle: { color: gridColor, type: 'dashed' } },
      },
      dataZoom: [
        {
          type: 'inside',
          start: Math.max(0, Math.floor(((histDates.length - 120) / allDates.length) * 100)),
          end: 100,
        },
        {
          type: 'slider',
          bottom: 35,
          start: Math.max(0, Math.floor(((histDates.length - 120) / allDates.length) * 100)),
          end: 100,
          textStyle: textStyle,
        },
      ],
      series: [
        {
          name: '歷史收盤價',
          type: 'line',
          data: histCloseAligned,
          smooth: true,
          showSymbol: false,
          lineStyle: {
            color: '#3b82f6',
            width: 2.5,
          },
          itemStyle: {
            color: '#3b82f6',
          },
          markArea: {
            silent: true,
            data: getMarkAreaData(),
          },
        },
        {
          name: '預估價格',
          type: 'line',
          data: foreCloseAligned,
          smooth: true,
          showSymbol: false,
          lineStyle: {
            color: '#10b981',
            type: 'dashed',
            width: 2.5,
          },
          itemStyle: {
            color: '#10b981',
          },
        },
        // Stacked area lines to draw confidence interval
        {
          name: '信心下軌',
          type: 'line',
          data: foreLowerAligned,
          lineStyle: { opacity: 0 },
          stack: 'confidence-band',
          symbol: 'none',
        },
        {
          name: '95% 信心區間',
          type: 'line',
          data: foreUpperDiffAligned,
          lineStyle: { opacity: 0 },
          stack: 'confidence-band',
          symbol: 'none',
          areaStyle: {
            color: 'rgba(16, 185, 129, 0.15)',
          },
        },
        {
          name: benchmarkName || '大盤基準指數',
          type: 'line',
          data: benchAligned,
          smooth: true,
          showSymbol: false,
          lineStyle: {
            color: '#f59e0b',
            type: 'dotted',
            width: 2.0,
          },
          itemStyle: {
            color: '#f59e0b',
          },
        },
      ],
    };
  };

  // Option 2: Equity Curve Chart
  const getEquityOption = () => {
    const eqDates = equityCurve.map((item) => item.date);
    const stratEquity = equityCurve.map((item) => Math.round(item.strategy_equity));
    const bhEquity = equityCurve.map((item) => Math.round(item.buy_hold_equity));

    return {
      backgroundColor: 'transparent',
      title: {
        text: '投資組合資產淨值曲線 (Equity Curve)',
        left: 'center',
        textStyle: {
          color: dark ? '#f4f4f5' : '#18181b',
          fontSize: 14,
          fontWeight: 600,
        },
        top: 10,
      },
      legend: {
        data: ['交易策略資產', '基準持有資產'],
        bottom: 10,
        textStyle: textStyle,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
        },
        backgroundColor: dark ? '#0c0c0f' : '#ffffff',
        borderColor: dark ? '#27272a' : '#e4e4e7',
        textStyle: {
          color: dark ? '#f4f4f5' : '#18181b',
        },
        formatter: (params) => {
          let output = `<b>日期: ${params[0].name}</b><br/>`;
          params.forEach((param) => {
            output += `${param.marker} ${param.seriesName}: $${param.value.toLocaleString()} TWD<br/>`;
          });
          return output;
        },
      },
      grid: {
        top: 60,
        left: '3%',
        right: '3%',
        bottom: 60,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: eqDates,
        axisLine: { lineStyle: { color: gridColor } },
        axisLabel: { textStyle: textStyle },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        scale: true,
        axisLine: { show: false },
        axisLabel: { 
          textStyle: textStyle,
          formatter: (val) => `$${(val / 10000).toLocaleString()}萬`
        },
        splitLine: { lineStyle: { color: gridColor, type: 'dashed' } },
      },
      dataZoom: [
        {
          type: 'inside',
          start: 0,
          end: 100,
        },
        {
          type: 'slider',
          bottom: 35,
          start: 0,
          end: 100,
          textStyle: textStyle,
        },
      ],
      series: [
        {
          name: '交易策略資產',
          type: 'line',
          data: stratEquity,
          smooth: true,
          showSymbol: false,
          lineStyle: {
            color: '#10b981',
            width: 2.5,
          },
          itemStyle: {
            color: '#10b981',
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(16, 185, 129, 0.15)' },
                { offset: 1, color: 'rgba(16, 185, 129, 0.0)' },
              ],
            },
          },
        },
        {
          name: '基準持有資產',
          type: 'line',
          data: bhEquity,
          smooth: true,
          showSymbol: false,
          lineStyle: {
            color: '#f59e0b',
            width: 1.5,
          },
          itemStyle: {
            color: '#f59e0b',
          },
        },
      ],
    };
  };

  return (
    <div className="bg-white dark:bg-darkCard border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 glow-card">
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 mb-5 pb-px">
        <button
          onClick={() => setActiveTab('price')}
          className={`pb-3 text-sm font-semibold tracking-wide border-b-2 px-4 transition-all ${
            activeTab === 'price'
              ? 'border-blue-500 text-blue-500'
              : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          股價與走勢預估
        </button>
        <button
          onClick={() => setActiveTab('equity')}
          className={`pb-3 text-sm font-semibold tracking-wide border-b-2 px-4 transition-all ${
            activeTab === 'equity'
              ? 'border-blue-500 text-blue-500'
              : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          回測資產淨值曲線
        </button>
      </div>

      <div className="h-[450px] w-full">
        {activeTab === 'price' ? (
          <ReactECharts option={getPriceOption()} style={{ height: '100%', width: '100%' }} />
        ) : (
          <ReactECharts option={getEquityOption()} style={{ height: '100%', width: '100%' }} />
        )}
      </div>

      {/* Passivation Zones Guide */}
      {activeTab === 'price' && passivationRegions && passivationRegions.length > 0 && (
        <div className="mt-4 p-3 bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200/50 dark:border-zinc-800/30 rounded-lg flex flex-col gap-2 text-xs">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
            指標鈍化區交易指南 (Passivation Zones Guide)
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-2">
              <span className="w-3 h-3 mt-0.5 rounded-full bg-rose-500/20 border border-rose-500 flex-shrink-0"></span>
              <div>
                <span className="font-bold text-rose-600 dark:text-rose-400 block">高檔強勢區 (適合買入/續抱)：</span>
                <span className="text-zinc-500 dark:text-zinc-450 leading-relaxed block">
                  KD 或 RSI 處於高檔強勢鈍化（如 KD K值 $\ge 80$ 且連續 3 日以上），代表極強勢上漲趨勢，拉回即是絕佳買入或加碼點。
                </span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-3 h-3 mt-0.5 rounded-full bg-blue-500/20 border border-blue-500 flex-shrink-0"></span>
              <div>
                <span className="font-bold text-blue-600 dark:text-blue-400 block">低檔弱勢區 (適合賣出/觀望)：</span>
                <span className="text-zinc-500 dark:text-zinc-450 leading-relaxed block">
                  KD 或 RSI 處於低檔弱勢減速鈍化（如 KD K值 $\le 20$ 且連續 3 日以上），代表極弱勢下跌趨勢，應避免介入買入或尋求停損平倉。
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
