import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, FastForward } from 'lucide-react';

export default function SimulationPlayer({ 
  totalBars, 
  simIndex, 
  setSimIndex, 
  isPlaying, 
  setIsPlaying, 
  currentDate, 
  trades,
  speed,
  setSpeed
}) {
  const [muted, setMuted] = useState(false);
  const prevSimIndex = useRef(simIndex);

  // Sound generator using Web Audio API
  const playChime = (type) => {
    if (muted) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === 'buy') {
        // Bullish rising major chord
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        
        osc.start(now);
        osc.stop(now + 0.4);
      } else {
        // Bearish dropping minor chord
        osc.type = 'sine';
        osc.frequency.setValueAtTime(783.99, now); // G5
        osc.frequency.setValueAtTime(587.33, now + 0.08); // D5
        osc.frequency.setValueAtTime(493.88, now + 0.16); // B4
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        
        osc.start(now);
        osc.stop(now + 0.4);
      }
    } catch (e) {
      console.error("Web Audio API error", e);
    }
  };

  // Play sound when entering a trade index
  useEffect(() => {
    // Check if simIndex changed and is going forward
    if (simIndex > prevSimIndex.current && trades && trades.length > 0) {
      // Find if there is a trade executed at this simIndex
      // A trade contains 'date' property. We check the trade that matches currentDate.
      const tradeOnThisDay = trades.find(t => t.date === currentDate);
      if (tradeOnThisDay) {
        if (tradeOnThisDay.type === 'Buy') {
          playChime('buy');
        } else if (tradeOnThisDay.type.includes('Sell')) {
          playChime('sell');
        }
      }
    }
    prevSimIndex.current = simIndex;
  }, [simIndex, currentDate, trades]);

  // Simulation timer loop
  useEffect(() => {
    let timer = null;
    if (isPlaying) {
      // Speed mappings (interval in ms)
      const intervalMap = {
        1: 250, // 1x
        2: 120, // 2x
        5: 50,  // 5x
        10: 20  // 10x
      };
      
      const interval = intervalMap[speed] || 250;
      
      timer = setInterval(() => {
        setSimIndex((prev) => {
          if (prev >= totalBars - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, interval);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, speed, totalBars]);

  const handleReset = () => {
    setIsPlaying(false);
    setSimIndex(0);
  };

  const handleJumpToEnd = () => {
    setIsPlaying(false);
    setSimIndex(totalBars - 1);
  };

  return (
    <div className="bg-white dark:bg-darkCard border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 glow-card">
      
      {/* Simulation Play Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className={`p-2.5 rounded-lg border text-white font-medium transition-all ${
            isPlaying 
              ? 'bg-amber-500 border-amber-500 hover:bg-amber-600' 
              : 'bg-blue-500 border-blue-500 hover:bg-blue-600'
          }`}
          title={isPlaying ? "暫停模擬" : "啟動時間模擬播放"}
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
        </button>

        <button
          onClick={handleReset}
          className="p-2.5 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors"
          title="重設至第一天"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Speed Selector */}
        <div className="flex items-center border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-zinc-50 dark:bg-zinc-900/50">
          {[1, 2, 5, 10].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-2.5 py-1.5 text-[10px] font-bold transition-all ${
                speed === s
                  ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50'
                  : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Mute Toggle */}
        <button
          onClick={() => setMuted(!muted)}
          className={`p-2.5 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${
            muted ? 'text-rose-500 border-rose-200/50' : 'text-zinc-500 dark:text-zinc-400'
          }`}
          title={muted ? "取消靜音" : "靜音交易聲響"}
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Progress scrubbing bar */}
      <div className="flex-1 flex items-center gap-3">
        <span className="text-[10px] text-zinc-400 font-mono w-14">
          Day 1
        </span>
        <input
          type="range"
          min="0"
          max={totalBars - 1}
          value={simIndex}
          onChange={(e) => {
            setIsPlaying(false);
            setSimIndex(parseInt(e.target.value));
          }}
          className="flex-grow h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <button 
          onClick={handleJumpToEnd}
          className="text-[10px] text-zinc-400 hover:text-blue-500 font-mono w-16 text-right transition-colors"
          title="跳至最後一天顯示完整回測"
        >
          最後一天 ({totalBars})
        </button>
      </div>

      {/* Simulation Info readout */}
      <div className="flex items-center gap-2 border-l border-zinc-200 dark:border-zinc-800 pl-4 font-mono">
        <div className="text-right">
          <span className="text-[10px] text-zinc-400 block uppercase">模擬當前日期</span>
          <span className="text-sm font-bold text-blue-500 dark:text-blue-400">{currentDate}</span>
        </div>
        <span className="text-xs text-zinc-300 dark:text-zinc-700">|</span>
        <div className="text-left">
          <span className="text-[10px] text-zinc-400 block uppercase">播放進度</span>
          <span className="text-xs font-bold text-zinc-950 dark:text-zinc-100">
            {simIndex + 1} / {totalBars} K
          </span>
        </div>
      </div>

    </div>
  );
}
