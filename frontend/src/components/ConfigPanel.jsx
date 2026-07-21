import React from 'react';
import { Play, Settings, ShieldAlert, LineChart, Cpu, Database, Shield, Sliders } from 'lucide-react';

export default function ConfigPanel({ config, setConfig, onRun, loading, historyList, onSelectHistory }) {
  const [activeTab, setActiveTab] = React.useState('data');
  const [activeSubTab, setActiveSubTab] = React.useState('data_settings');
  const [profiles, setProfiles] = React.useState({});
  const [profileName, setProfileName] = React.useState('');
  const [selectedProfile, setSelectedProfile] = React.useState('');

  const fetchProfiles = async () => {
    try {
      const res = await fetch('/api/profiles');
      if (res.ok) {
        const data = await res.json();
        setProfiles(data);
      }
    } catch (e) {
      console.error("Failed to fetch profiles:", e);
    }
  };

  React.useEffect(() => {
    fetchProfiles();
  }, []);

  const handleSaveProfile = async () => {
    if (!profileName.trim()) {
      alert("請輸入設定檔名稱！");
      return;
    }
    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profileName.trim(),
          config: config
        })
      });
      if (res.ok) {
        alert(`設定檔 '${profileName.trim()}' 儲存成功！`);
        setProfileName('');
        fetchProfiles();
      } else {
        alert("儲存失敗");
      }
    } catch (e) {
      console.error(e);
      alert("儲存設定檔出錯");
    }
  };

  const handleDeleteProfile = async (name) => {
    if (!name || name === 'latest') return;
    if (!confirm(`確定要刪除設定檔 '${name}' 嗎？`)) return;
    try {
      const res = await fetch(`/api/profiles/${encodeURIComponent(name)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setSelectedProfile('');
        fetchProfiles();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleApplyProfile = (name) => {
    setSelectedProfile(name);
    if (!name) return;
    if (profiles[name]) {
      setConfig({
        ...config,
        ...profiles[name]
      });
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'data') {
      setActiveSubTab('data_settings');
    } else if (tab === 'risk') {
      setActiveSubTab('risk_loss');
    } else if (tab === 'signal') {
      setActiveSubTab('sig_momentum');
    }
  };

  const handleInputChange = (field, value) => {
    setConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleRiskChange = (field, value) => {
    setConfig((prev) => ({
      ...prev,
      risk_params: {
        ...prev.risk_params,
        [field]: value
      }
    }));
  };

  const handleParamChange = (field, value) => {
    setConfig((prev) => ({
      ...prev,
      params: {
        ...prev.params,
        [field]: value
      }
    }));
  };

  const handleConditionChange = (field, checked) => {
    setConfig((prev) => {
      const enabled = {
        ...prev.enabled_conditions,
        [field]: checked
      };

      // Sync entry_sequence
      let entrySeq = [...(prev.entry_sequence || [])];
      if (checked) {
        if (!entrySeq.some(x => x.id === field)) {
          if (entrySeq.length > 0) {
            entrySeq[entrySeq.length - 1].gate = 'AND';
          }
          entrySeq.push({ id: field, gate: null });
        }
      } else {
        entrySeq = entrySeq.filter(x => x.id !== field);
        if (entrySeq.length > 0) {
          entrySeq[entrySeq.length - 1].gate = null;
        }
      }

      // Sync exit_sequence
      let exitSeq = [...(prev.exit_sequence || [])];
      if (checked) {
        if (!exitSeq.some(x => x.id === field)) {
          if (exitSeq.length > 0) {
            exitSeq[exitSeq.length - 1].gate = 'OR';
          }
          exitSeq.push({ id: field, gate: null });
        }
      } else {
        exitSeq = exitSeq.filter(x => x.id !== field);
        if (exitSeq.length > 0) {
          exitSeq[exitSeq.length - 1].gate = null;
        }
      }

      return {
        ...prev,
        enabled_conditions: enabled,
        entry_sequence: entrySeq,
        exit_sequence: exitSeq
      };
    });
  };

  const handleGateChange = (idx, val, type) => {
    const seqKey = type === 'entry' ? 'entry_sequence' : 'exit_sequence';
    const list = [...(config[seqKey] || [])];
    list[idx] = {
      ...list[idx],
      gate: val
    };
    setConfig(prev => ({
      ...prev,
      [seqKey]: list
    }));
  };

  const handleDragStart = (e, index, type) => {
    e.dataTransfer.setData('text/plain', index);
    e.dataTransfer.setData('type', type);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetIdx, type) => {
    e.preventDefault();
    const sourceIdx = parseInt(e.dataTransfer.getData('text/plain'));
    const dragType = e.dataTransfer.getData('type');
    if (dragType !== type) return;
    if (sourceIdx === targetIdx) return;

    const seqKey = type === 'entry' ? 'entry_sequence' : 'exit_sequence';
    const list = [...(config[seqKey] || [])];
    const [movedItem] = list.splice(sourceIdx, 1);
    list.splice(targetIdx, 0, movedItem);

    list.forEach((item, idx) => {
      if (idx === list.length - 1) {
        item.gate = null;
      } else if (item.gate === null) {
        item.gate = type === 'entry' ? 'AND' : 'OR';
      }
    });

    setConfig(prev => ({
      ...prev,
      [seqKey]: list
    }));
  };

  const renderInlineParams = (sig) => {
    if (!config.params) return null;
    switch (sig) {
      case 'rsi':
        return (
          <div className="pl-6 pb-1.5 flex items-center gap-2 animate-fadeIn mt-2">
            <span className="text-xs text-zinc-400 dark:text-zinc-500 font-semibold">計算週期 (Window):</span>
            <input
              type="number"
              className="w-16 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-950 dark:text-zinc-100 focus:outline-none"
              value={config.params.rsi_window || 14}
              onChange={(e) => handleParamChange('rsi_window', parseInt(e.target.value) || 14)}
            />
          </div>
        );
      case 'kd':
        return (
          <div className="pl-6 pb-1.5 grid grid-cols-3 gap-2 animate-fadeIn mt-2 max-w-sm">
            <div>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold block mb-0.5">RSV 週期</span>
              <input
                type="number"
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-950 dark:text-zinc-100 focus:outline-none"
                value={config.params.kd_window || 9}
                onChange={(e) => handleParamChange('kd_window', parseInt(e.target.value) || 9)}
              />
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold block mb-0.5">K值平滑</span>
              <input
                type="number"
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-950 dark:text-zinc-100 focus:outline-none"
                value={config.params.kd_smooth_k || 3}
                onChange={(e) => handleParamChange('kd_smooth_k', parseInt(e.target.value) || 3)}
              />
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold block mb-0.5">D值平滑</span>
              <input
                type="number"
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-950 dark:text-zinc-100 focus:outline-none"
                value={config.params.kd_smooth_d || 3}
                onChange={(e) => handleParamChange('kd_smooth_d', parseInt(e.target.value) || 3)}
              />
            </div>
          </div>
        );
      case 'macd':
        return (
          <div className="pl-6 pb-1.5 grid grid-cols-3 gap-2 animate-fadeIn mt-2 max-w-sm">
            <div>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold block mb-0.5">快線</span>
              <input
                type="number"
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-955 dark:text-zinc-100 focus:outline-none"
                value={config.params.macd_fast || 12}
                onChange={(e) => handleParamChange('macd_fast', parseInt(e.target.value) || 12)}
              />
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold block mb-0.5">慢線</span>
              <input
                type="number"
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-955 dark:text-zinc-100 focus:outline-none"
                value={config.params.macd_slow || 26}
                onChange={(e) => handleParamChange('macd_slow', parseInt(e.target.value) || 26)}
              />
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold block mb-0.5">訊號</span>
              <input
                type="number"
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-955 dark:text-zinc-100 focus:outline-none"
                value={config.params.macd_signal || 9}
                onChange={(e) => handleParamChange('macd_signal', parseInt(e.target.value) || 9)}
              />
            </div>
          </div>
        );
      case 'williams_r':
        return (
          <div className="pl-6 pb-1.5 flex items-center gap-2 animate-fadeIn mt-2">
            <span className="text-xs text-zinc-400 dark:text-zinc-500 font-semibold">威廉週期:</span>
            <input
              type="number"
              className="w-16 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-950 dark:text-zinc-100 focus:outline-none"
              value={config.params.williams_window || 14}
              onChange={(e) => handleParamChange('williams_window', parseInt(e.target.value) || 14)}
            />
          </div>
        );
      case 'cci':
        return (
          <div className="pl-6 pb-1.5 flex items-center gap-2 animate-fadeIn mt-2">
            <span className="text-xs text-zinc-400 dark:text-zinc-500 font-semibold">CCI 週期:</span>
            <input
              type="number"
              className="w-16 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-950 dark:text-zinc-100 focus:outline-none"
              value={config.params.cci_window || 14}
              onChange={(e) => handleParamChange('cci_window', parseInt(e.target.value) || 14)}
            />
          </div>
        );
      case 'sma':
        return (
          <div className="pl-6 pb-1.5 grid grid-cols-3 gap-2 animate-fadeIn mt-2 max-w-sm">
            <div>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold block mb-0.5">短期</span>
              <input
                type="number"
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-950 dark:text-zinc-100 focus:outline-none"
                value={config.params.sma_short || 5}
                onChange={(e) => handleParamChange('sma_short', parseInt(e.target.value) || 5)}
              />
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold block mb-0.5">中期</span>
              <input
                type="number"
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded px-2 py-1 text-xs font-mono text-zinc-950 dark:text-zinc-100 focus:outline-none"
                value={config.params.sma_mid || 20}
                onChange={(e) => handleParamChange('sma_mid', parseInt(e.target.value) || 20)}
              />
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold block mb-0.5">長期</span>
              <input
                type="number"
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-950 dark:text-zinc-100 focus:outline-none"
                value={config.params.sma_long || 60}
                onChange={(e) => handleParamChange('sma_long', parseInt(e.target.value) || 60)}
              />
            </div>
          </div>
        );
      case 'ema':
        return (
          <div className="pl-6 pb-1.5 grid grid-cols-2 gap-2 animate-fadeIn mt-2 max-w-xs">
            <div>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold block mb-0.5">短期</span>
              <input
                type="number"
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded px-2 py-1 text-xs font-mono text-zinc-950 dark:text-zinc-100 focus:outline-none"
                value={config.params.ema_short || 10}
                onChange={(e) => handleParamChange('ema_short', parseInt(e.target.value) || 10)}
              />
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold block mb-0.5">長期</span>
              <input
                type="number"
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-950 dark:text-zinc-100 focus:outline-none"
                value={config.params.ema_long || 30}
                onChange={(e) => handleParamChange('ema_long', parseInt(e.target.value) || 30)}
              />
            </div>
          </div>
        );
      case 'adx':
        return (
          <div className="pl-6 pb-1.5 flex items-center gap-2 animate-fadeIn mt-2">
            <span className="text-xs text-zinc-400 dark:text-zinc-500 font-semibold">ADX 週期:</span>
            <input
              type="number"
              className="w-16 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-950 dark:text-zinc-100 focus:outline-none"
              value={config.params.adx_window || 14}
              onChange={(e) => handleParamChange('adx_window', parseInt(e.target.value) || 14)}
            />
          </div>
        );
      case 'bb':
        return (
          <div className="pl-6 pb-1.5 grid grid-cols-2 gap-2 animate-fadeIn mt-2 max-w-xs">
            <div>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold block mb-0.5">布林週期</span>
              <input
                type="number"
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded px-2 py-1 text-xs font-mono text-zinc-950 dark:text-zinc-100 focus:outline-none"
                value={config.params.bb_window || 20}
                onChange={(e) => handleParamChange('bb_window', parseInt(e.target.value) || 20)}
              />
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold block mb-0.5">標準差倍</span>
              <input
                type="number"
                step="0.1"
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-950 dark:text-zinc-100 focus:outline-none"
                value={config.params.bb_std || 2.0}
                onChange={(e) => handleParamChange('bb_std', parseFloat(e.target.value) || 2.0)}
              />
            </div>
          </div>
        );
      case 'atr':
        return (
          <div className="pl-6 pb-1.5 flex items-center gap-2 animate-fadeIn mt-2">
            <span className="text-xs text-zinc-400 dark:text-zinc-500 font-semibold">ATR 週期:</span>
            <input
              type="number"
              className="w-16 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-950 dark:text-zinc-100 focus:outline-none"
              value={config.params.atr_window || 14}
              onChange={(e) => handleParamChange('atr_window', parseInt(e.target.value) || 14)}
            />
          </div>
        );
      case 'std_dev':
        return (
          <div className="pl-6 pb-1.5 flex items-center gap-2 animate-fadeIn mt-2">
            <span className="text-xs text-zinc-400 dark:text-zinc-500 font-semibold">標準差週期:</span>
            <input
              type="number"
              className="w-16 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-950 dark:text-zinc-100 focus:outline-none"
              value={config.params.std_window || 20}
              onChange={(e) => handleParamChange('std_window', parseInt(e.target.value) || 20)}
            />
          </div>
        );
      case 'mfi':
        return (
          <div className="pl-6 pb-1.5 flex items-center gap-2 animate-fadeIn mt-2">
            <span className="text-xs text-zinc-400 dark:text-zinc-500 font-semibold">MFI 週期:</span>
            <input
              type="number"
              className="w-16 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-950 dark:text-zinc-100 focus:outline-none"
              value={config.params.mfi_window || 14}
              onChange={(e) => handleParamChange('mfi_window', parseInt(e.target.value) || 14)}
            />
          </div>
        );
      case 'cmf':
        return (
          <div className="pl-6 pb-1.5 flex items-center gap-2 animate-fadeIn mt-2">
            <span className="text-xs text-zinc-400 dark:text-zinc-500 font-semibold">CMF 週期:</span>
            <input
              type="number"
              className="w-16 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-950 dark:text-zinc-100 focus:outline-none"
              value={config.params.cmf_window || 20}
              onChange={(e) => handleParamChange('cmf_window', parseInt(e.target.value) || 20)}
            />
          </div>
        );
      case 'vwap':
        return (
          <div className="pl-6 pb-1.5 flex items-center gap-2 animate-fadeIn mt-2">
            <span className="text-xs text-zinc-400 dark:text-zinc-500 font-semibold">VWAP 週期:</span>
            <input
              type="number"
              className="w-16 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-950 dark:text-zinc-100 focus:outline-none"
              value={config.params.vwap_window || 20}
              onChange={(e) => handleParamChange('vwap_window', parseInt(e.target.value) || 20)}
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white dark:bg-darkCard border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 glow-card space-y-6">
      
      {/* Configuration Profile Management */}
      <div className="bg-zinc-50/50 dark:bg-zinc-900/40 p-4 rounded-xl border border-zinc-200/50 dark:border-zinc-800/40 space-y-3">
        <label className="block text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5" /> 設定檔儲存與共享 (Profiles Sharing)
        </label>
        
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Load Profile Dropdown */}
          <div className="flex-1">
            <select
              className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 focus:outline-none"
              value={selectedProfile}
              onChange={(e) => handleApplyProfile(e.target.value)}
            >
              <option value="">-- 選擇已儲存的設定檔 (Select Profile) --</option>
              {Object.keys(profiles).filter(k => k !== 'latest').map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          
          {/* Delete Active Profile Button */}
          {selectedProfile && selectedProfile !== 'latest' && (
            <button
              onClick={() => handleDeleteProfile(selectedProfile)}
              className="px-3 py-2 text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-650 dark:text-red-400 rounded-lg border border-red-500/20 dark:border-red-500/10 transition-colors"
            >
              刪除設定
            </button>
          )}
        </div>

        {/* Save Current Config as Profile */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="為當前設定命名 (e.g. 高勝率動能策略)"
            className="flex-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-lg px-3 py-2 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none font-medium"
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
          />
          <button
            onClick={handleSaveProfile}
            className="px-4 py-2 text-xs font-bold bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors shadow-sm"
          >
            儲存目前設定
          </button>
        </div>
      </div>

      {/* Target History Quick Select */}
      {historyList && historyList.length > 0 && (
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
            歷史快速選擇 (Quick Select)
          </label>
          <div className="flex flex-wrap gap-1.5 max-h-[85px] overflow-y-auto custom-scrollbar">
            {historyList.map((item) => (
              <button
                key={item.stock_id}
                onClick={() => onSelectHistory && onSelectHistory(item.stock_id)}
                className={`px-3 py-1.5 text-xs rounded-md border font-medium transition-all ${
                  config.stock_id === item.stock_id
                    ? 'bg-blue-500 border-blue-500 text-white shadow-sm'
                    : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/80'
                }`}
                title={`快速切換至已下載數據的標的：${item.stock_name} (${item.stock_id})`}
              >
                {item.stock_name} ({item.stock_id})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ================= CONFIGURATION GRID ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
        
        {/* Left Column: Main tab selectors & inputs */}
        <div className="lg:col-span-2 space-y-4 flex flex-col">

          {/* ================= MAIN TABS SELECTOR ================= */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap gap-1">
        <button
          onClick={() => handleTabChange('data')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-sm transition-all ${
            activeTab === 'data'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          <Database className="w-4 h-4" /> 數據與回測設定 (Data & Engine)
        </button>
        <button
          onClick={() => handleTabChange('risk')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-sm transition-all ${
            activeTab === 'risk'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          <Shield className="w-4 h-4" /> 風險與資金管理 (Risk & Exits)
        </button>
        <button
          onClick={() => handleTabChange('signal')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-sm transition-all ${
            activeTab === 'signal'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          <Cpu className="w-4 h-4" /> 信號條件庫 (Signal Library)
        </button>
      </div>

      {/* ================= SUB TABS SELECTOR ================= */}
      <div className="flex flex-wrap gap-1.5">
        {activeTab === 'data' && (
          <>
            <button
              onClick={() => setActiveSubTab('data_settings')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                activeSubTab === 'data_settings'
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
                  : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900/50'
              }`}
            >
              數據源與時間範圍
            </button>
            <button
              onClick={() => setActiveSubTab('engine_settings')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                activeSubTab === 'engine_settings'
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
                  : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900/50'
              }`}
            >
              回測規則與引擎
            </button>
          </>
        )}
        {activeTab === 'risk' && (
          <>
            <button
              onClick={() => setActiveSubTab('risk_loss')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                activeSubTab === 'risk_loss'
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
                  : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900/50'
              }`}
            >
              停損與目標停利
            </button>
            <button
              onClick={() => setActiveSubTab('risk_time')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                activeSubTab === 'risk_time'
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
                  : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900/50'
              }`}
            >
              移動停損與時間出場
            </button>
          </>
        )}
        {activeTab === 'signal' && (
          <>
            <button
              onClick={() => setActiveSubTab('sig_momentum')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                activeSubTab === 'sig_momentum'
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
                  : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900/50'
              }`}
            >
              動能指標 (Momentum)
            </button>
            <button
              onClick={() => setActiveSubTab('sig_trend')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                activeSubTab === 'sig_trend'
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
                  : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900/50'
              }`}
            >
              趨勢指標 (Trend)
            </button>
            <button
              onClick={() => setActiveSubTab('sig_vol')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                activeSubTab === 'sig_vol'
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
                  : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900/50'
              }`}
            >
              量能與波動 (Volume/Volatility)
            </button>
            <button
              onClick={() => setActiveSubTab('sig_logic')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                activeSubTab === 'sig_logic'
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
                  : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900/50'
              }`}
            >
              條件順序與邏輯 (Drag & Drop Logic)
            </button>
          </>
        )}
      </div>

      {/* ================= TAB CONTENT CONTAINER ================= */}
      <div className="bg-zinc-50/20 dark:bg-zinc-900/10 border border-zinc-100 dark:border-zinc-800/40 rounded-2xl p-6 min-h-[220px]">
        {/* Data Settings */}
        {activeTab === 'data' && activeSubTab === 'data_settings' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
            <div title="請輸入欲回測的商品代號，台股如 2330、0050，美股如 AAPL、TSLA。系統會自動下載增量更新近期數據。">
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2 cursor-help uppercase tracking-wider">
                商品代碼 (Symbol) 🛈
              </label>
              <input
                type="text"
                placeholder="2330"
                className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-zinc-950 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-mono"
                value={config.stock_id}
                onChange={(e) => handleInputChange('stock_id', e.target.value)}
                disabled={loading}
              />
            </div>

            <div title="回測與計算指標所使用的K線收盤價週期，目前支援日線 (1d)、4小時線 (4h)、1小時線 (1h)。">
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2 cursor-help uppercase tracking-wider">
                K線週期 (Timeframe) 🛈
              </label>
              <select
                className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-zinc-950 dark:text-zinc-100 focus:outline-none"
                value={config.timeframe || '1d'}
                onChange={(e) => handleInputChange('timeframe', e.target.value)}
                disabled={loading}
              >
                <option value="1d">1 日 (Daily)</option>
                <option value="4h">4 小時 (4h)</option>
                <option value="1h">1 小時 (1h)</option>
              </select>
            </div>

            <div title="回測模擬時欲向前載入的最大 K 線根數上限。載入越多可提供更長期的指標計算參考。">
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2 cursor-help uppercase tracking-wider">
                最大載入 (K-Bars) 🛈
              </label>
              <input
                type="number"
                className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-zinc-950 dark:text-zinc-100 focus:outline-none font-mono"
                value={config.bars || 1000}
                onChange={(e) => handleInputChange('bars', parseInt(e.target.value) || 1000)}
                disabled={loading}
              />
            </div>

            <div title="歷史回測與策略搜尋的起點日期。">
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2 cursor-help uppercase tracking-wider">
                起始日期 (Start) 🛈
              </label>
              <input
                type="date"
                className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-950 dark:text-zinc-100 focus:outline-none font-mono"
                value={config.start_date}
                onChange={(e) => handleInputChange('start_date', e.target.value)}
                disabled={loading}
              />
            </div>

            <div title="歷史回測與策略搜尋的終點日期。">
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2 cursor-help uppercase tracking-wider">
                結束日期 (End) 🛈
              </label>
              <input
                type="date"
                className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-950 dark:text-zinc-100 focus:outline-none font-mono"
                value={config.end_date}
                onChange={(e) => handleInputChange('end_date', e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
        )}

        {/* Engine Settings */}
        {activeTab === 'data' && activeSubTab === 'engine_settings' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
            <div title="回測起始時帳戶內擁有的現金餘額，預設為 1,000,000。">
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2 cursor-help uppercase tracking-wider">
                初始資金 (Cash) 🛈
              </label>
              <input
                type="number"
                className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-zinc-950 dark:text-zinc-100 focus:outline-none font-mono"
                value={config.initial_cash}
                onChange={(e) => handleInputChange('initial_cash', parseFloat(e.target.value) || 1000000)}
                disabled={loading}
              />
            </div>

            <div title="每筆買入或賣出交易時所需扣除的單邊交易手續費比率，例如 0.002 代表 0.2%。">
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2 cursor-help uppercase tracking-wider">
                交易手續費率 🛈
              </label>
              <input
                type="number"
                step="0.0001"
                className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-zinc-950 dark:text-zinc-100 focus:outline-none font-mono"
                value={config.fee_rate}
                onChange={(e) => handleInputChange('fee_rate', parseFloat(e.target.value) || 0.002)}
                disabled={loading}
              />
            </div>

            <div title="回測引擎在信號庫中隨機配對、交叉搜尋生成新策略時的試驗次數。數值越高搜尋越深，但耗時較長。">
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2 cursor-help uppercase tracking-wider">
                策略搜尋 Trials 🛈
              </label>
              <input
                type="number"
                className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-zinc-950 dark:text-zinc-100 focus:outline-none font-mono"
                value={config.trials}
                onChange={(e) => handleInputChange('trials', parseInt(e.target.value) || 500)}
                disabled={loading}
              />
            </div>

            <div title="過濾候選策略時的篩選門檻。總交易次數低於此數值的策略將不予納入排行以避免統計失真。">
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2 cursor-help uppercase tracking-wider">
                最少交易數過濾 🛈
              </label>
              <input
                type="number"
                className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-zinc-950 dark:text-zinc-100 focus:outline-none font-mono"
                value={config.min_trades}
                onChange={(e) => handleInputChange('min_trades', parseInt(e.target.value) || 5)}
                disabled={loading}
              />
            </div>

            <div title="用以排序與篩選最優策略的評估指標。支援夏普值、總報酬率、獲利因子與勝率排序。">
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2 cursor-help uppercase tracking-wider">
                優化目標指標 🛈
              </label>
              <select
                className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-zinc-950 dark:text-zinc-100 focus:outline-none"
                value={config.fitness_metric}
                onChange={(e) => handleInputChange('fitness_metric', e.target.value)}
                disabled={loading}
              >
                <option value="sharpe_ratio">夏普值 (Sharpe Ratio)</option>
                <option value="total_return">總報酬率 (Total Return)</option>
                <option value="profit_factor">獲利因子 (Profit Factor)</option>
                <option value="win_rate">勝率 (Win Rate)</option>
              </select>
            </div>

            <div title="當策略包含多個指標訊號時的合併邏輯：AND (所有訊號必須同時成立) 或 OR (符合任一訊號即進場)。">
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2 cursor-help uppercase tracking-wider">
                進場邏輯閘 🛈
              </label>
              <select
                className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-zinc-950 dark:text-zinc-100 focus:outline-none"
                value={config.entry_logic}
                onChange={(e) => handleInputChange('entry_logic', e.target.value)}
                disabled={loading}
              >
                <option value="AND">AND (必須全符合)</option>
                <option value="OR">OR (符合任一項)</option>
              </select>
            </div>

            <div title="生成策略時，單一進場條件組合中允許包含的最大指標數量上限。">
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2 cursor-help uppercase tracking-wider">
                進場條件上限 🛈
              </label>
              <input
                type="number"
                min="1"
                max="4"
                className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-zinc-950 dark:text-zinc-100 focus:outline-none font-mono"
                value={config.max_entry_rules}
                onChange={(e) => handleInputChange('max_entry_rules', parseInt(e.target.value) || 2)}
                disabled={loading}
              />
            </div>

            <div title="生成策略時，單一出場條件組合中允許包含的最大指標數量上限。">
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2 cursor-help uppercase tracking-wider">
                出場條件上限 🛈
              </label>
              <input
                type="number"
                min="1"
                max="3"
                className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-zinc-950 dark:text-zinc-100 focus:outline-none font-mono"
                value={config.max_exit_rules}
                onChange={(e) => handleInputChange('max_exit_rules', parseInt(e.target.value) || 2)}
                disabled={loading}
              />
            </div>
          </div>
        )}

        {/* Risk Stop Loss / Take Profit */}
        {activeTab === 'risk' && activeSubTab === 'risk_loss' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
            {/* 1. Stop Loss */}
            <div className="space-y-3 bg-zinc-50/50 dark:bg-zinc-900/30 p-4 rounded-xl border border-zinc-200/40 dark:border-zinc-800/20" title="啟用後，若持倉虧損幅度達到設定值，將即刻執行平倉以限制虧損。">
              <label className="flex items-center gap-2.5 text-sm font-bold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-blue-500 rounded border-zinc-300 dark:border-zinc-800 focus:ring-blue-500 focus:ring-2"
                  checked={config.risk_params.sl_enabled}
                  onChange={(e) => handleRiskChange('sl_enabled', e.target.checked)}
                />
                啟用強制停損 (Stop Loss) 🛈
              </label>
              {config.risk_params.sl_enabled && (
                <div className="grid grid-cols-2 gap-3 pl-7 pt-1.5">
                  <select
                    className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none"
                    value={config.risk_params.sl_mode}
                    onChange={(e) => handleRiskChange('sl_mode', e.target.value)}
                  >
                    <option value="Percent">百分比 (%)</option>
                    <option value="ATR">ATR 倍數</option>
                  </select>
                  <input
                    type="number"
                    step="0.1"
                    className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none"
                    value={config.risk_params.sl_val}
                    onChange={(e) => handleRiskChange('sl_val', parseFloat(e.target.value) || 3.0)}
                  />
                </div>
              )}
            </div>

            {/* 2. Profit Target */}
            <div className="space-y-3 bg-zinc-50/50 dark:bg-zinc-900/30 p-4 rounded-xl border border-zinc-200/40 dark:border-zinc-800/20" title="啟用後，若持倉獲利幅度達到設定值，將即刻執行平倉鎖定利潤。">
              <label className="flex items-center gap-2.5 text-sm font-bold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-blue-500 rounded border-zinc-300 dark:border-zinc-800 focus:ring-blue-500 focus:ring-2"
                  checked={config.risk_params.pt_enabled}
                  onChange={(e) => handleRiskChange('pt_enabled', e.target.checked)}
                />
                啟用目標停利 (Profit Target) 🛈
              </label>
              {config.risk_params.pt_enabled && (
                <div className="grid grid-cols-2 gap-3 pl-7 pt-1.5">
                  <select
                    className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none"
                    value={config.risk_params.pt_mode}
                    onChange={(e) => handleRiskChange('pt_mode', e.target.value)}
                  >
                    <option value="Percent">百分比 (%)</option>
                    <option value="ATR">ATR 倍數</option>
                  </select>
                  <input
                    type="number"
                    step="0.1"
                    className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none"
                    value={config.risk_params.pt_val}
                    onChange={(e) => handleRiskChange('pt_val', parseFloat(e.target.value) || 5.0)}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Risk Trailing Stop / Time Exits */}
        {activeTab === 'risk' && activeSubTab === 'risk_time' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
            {/* 3. Trailing Stop */}
            <div className="space-y-3 bg-zinc-50/50 dark:bg-zinc-900/30 p-4 rounded-xl border border-zinc-200/40 dark:border-zinc-800/20" title="動態停損機制。當價格從持倉期間的最高價回落達設定值時，觸發出場以保護獲利。">
              <label className="flex items-center gap-2.5 text-sm font-bold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-blue-500 rounded border-zinc-300 dark:border-zinc-800 focus:ring-blue-500 focus:ring-2"
                  checked={config.risk_params.ts_enabled}
                  onChange={(e) => handleRiskChange('ts_enabled', e.target.checked)}
                />
                啟用移動停損 (Trailing Stop) 🛈
              </label>
              {config.risk_params.ts_enabled && (
                <div className="grid grid-cols-2 gap-3 pl-7 pt-1.5">
                  <select
                    className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none"
                    value={config.risk_params.ts_mode}
                    onChange={(e) => handleRiskChange('ts_mode', e.target.value)}
                  >
                    <option value="Percent">百分比 (%)</option>
                    <option value="ATR">ATR 倍數</option>
                  </select>
                  <input
                    type="number"
                    step="0.1"
                    className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none"
                    value={config.risk_params.ts_val}
                    onChange={(e) => handleRiskChange('ts_val', parseFloat(e.target.value) || 2.0)}
                  />
                </div>
              )}
            </div>

            {/* Time Exits */}
            <div className="space-y-4 bg-zinc-50/50 dark:bg-zinc-900/30 p-4 rounded-xl border border-zinc-200/40 dark:border-zinc-800/20">
              <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">時間出場條件 (Time Exits)</span>
              
              <div className="space-y-2.5" title="時間出場機制。當持倉達到設定的 K 線根數後，無論損益皆強迫平倉出場。">
                <label className="flex items-center gap-2.5 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-500 rounded border-zinc-300 dark:border-zinc-800"
                    checked={config.risk_params.max_hold_enabled}
                    onChange={(e) => handleRiskChange('max_hold_enabled', e.target.checked)}
                  />
                  最長持倉時間 🛈
                </label>
                {config.risk_params.max_hold_enabled && (
                  <div className="flex items-center gap-2.5 pl-7">
                    <input
                      type="number"
                      className="w-20 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded px-3 py-1.5 text-sm font-mono text-zinc-950 dark:text-zinc-100 focus:outline-none"
                      value={config.risk_params.max_hold_bars}
                      onChange={(e) => handleRiskChange('max_hold_bars', parseInt(e.target.value) || 10)}
                    />
                    <span className="text-sm text-zinc-400">根 K 線 (Bars)</span>
                  </div>
                )}
              </div>

              <div className="pt-1.5 border-t border-zinc-200/50 dark:border-zinc-800/40">
                <label className="flex items-center gap-2.5 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer" title="週平倉機制。啟用後會在每週五交易日結束時自動出清持倉，避免隔週跳空風險。">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-500 rounded border-zinc-300 dark:border-zinc-800"
                    checked={config.risk_params.exit_friday}
                    onChange={(e) => handleRiskChange('exit_friday', e.target.checked)}
                  />
                  星期五收盤平倉 (Exit on Friday) 🛈
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Signal Momentum */}
        {activeTab === 'signal' && activeSubTab === 'sig_momentum' && (
          <div className="space-y-4 animate-fadeIn">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">MOMENTUM (動能指標)</span>
            <div className="space-y-1.5 bg-white dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200/50 dark:border-zinc-800/40 divide-y divide-zinc-200/30 dark:divide-zinc-800/20">
              {['rsi', 'macd', 'kd', 'williams_r', 'cci'].map((sig) => {
                const titleMap = {
                  rsi: "相對強弱指標。低於 30/40 代表超賣（適合買入），高於 70/60 代表超買（適合賣出）。可設定計算天數。",
                  macd: "指數平滑異同移動平均線。利用快慢線黃金交叉（大於 0）買入，死亡交叉（小於 0）賣出。可設定快慢平滑天數。",
                  kd: "隨機指標。當 K 值黃金交叉或大於 50 買入，死亡交叉或小於 50 賣出。可設定 RSV 週期與平滑值。",
                  williams_r: "威廉指標。處於 -80 以下代表超賣（適合買入），-20 以上代表超買（適合賣出）。",
                  cci: "順勢指標。低於 -100 代表超賣（適合買入），高於 100 代表超買（適合賣出）。"
                };
                return (
                  <div key={sig} className="py-2.5 first:pt-0 last:pb-0">
                    <label className="flex items-center gap-2.5 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer hover:text-blue-500 dark:hover:text-blue-400 py-0.5" title={titleMap[sig]}>
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-blue-500 rounded border-zinc-300 dark:border-zinc-800 focus:ring-blue-500 focus:ring-2"
                        checked={config.enabled_conditions[sig] || false}
                        onChange={(e) => handleConditionChange(sig, e.target.checked)}
                      />
                      <span className="font-bold text-sm uppercase">{sig.toUpperCase()}</span> 指標 🛈
                    </label>
                    {config.enabled_conditions[sig] && renderInlineParams(sig)}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Signal Trend */}
        {activeTab === 'signal' && activeSubTab === 'sig_trend' && (
          <div className="space-y-4 animate-fadeIn">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">TREND (趨勢指標)</span>
            <div className="space-y-1.5 bg-white dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200/50 dark:border-zinc-800/40 divide-y divide-zinc-200/30 dark:divide-zinc-800/20">
              {['sma', 'ema', 'adx', 'bb'].map((sig) => {
                const titleMap = {
                  sma: "簡單移動平均線。收盤價突破均線或短均線突破長均線時買入，跌破時賣出。可設定短中長期天數。",
                  ema: "指數移動平均線。加權計算近期價格，對趨勢轉折更為靈敏。可自定義短長期週期。",
                  adx: "平均趨向指標。當 ADX 大於 25 代表強趨勢成形。可自定義計算週期。",
                  bb: "布林通道。由均線與上下兩倍標準差構成。收盤價跌破下軌時買入，突破上軌時賣出。可設定週期與標準差。"
                };
                return (
                  <div key={sig} className="py-2.5 first:pt-0 last:pb-0">
                    <label className="flex items-center gap-2.5 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer hover:text-blue-500 dark:hover:text-blue-400 py-0.5" title={titleMap[sig]}>
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-blue-500 rounded border-zinc-300 dark:border-zinc-800 focus:ring-blue-500 focus:ring-2"
                        checked={config.enabled_conditions[sig] || false}
                        onChange={(e) => handleConditionChange(sig, e.target.checked)}
                      />
                      <span className="font-bold text-sm uppercase">{sig === 'bb' ? 'Bollinger Bands' : sig.toUpperCase()}</span> 🛈
                    </label>
                    {config.enabled_conditions[sig] && renderInlineParams(sig)}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Signal Volume/Volatility */}
        {activeTab === 'signal' && activeSubTab === 'sig_vol' && (
          <div className="space-y-4 animate-fadeIn">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">VOLUME / VOLATILITY (成交量與波動指標)</span>
            <div className="space-y-1.5 bg-white dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200/50 dark:border-zinc-800/40 divide-y divide-zinc-200/30 dark:divide-zinc-800/20">
              {['atr', 'std_dev', 'obv', 'mfi', 'cmf', 'vwap'].map((sig) => {
                const titleMap = {
                  atr: "真實波幅。衡量市場波動度。數值放大代表波動加劇。可設定波幅天數。",
                  std_dev: "標準差。衡量股價圍繞均線波動劇烈程度。可自定義均線天數。",
                  obv: "能量潮指標。將成交量與股價漲跌結合，研判資金流入流出方向。",
                  mfi: "資金流量指標。結合價格與成交量的 RSI，低於 20 超賣（適合買入），高於 80 超買（適合賣出）。",
                  cmf: "佳慶資金流量指標。大於 0 代表資金淨流入，小於 0 代表淨流出。可自定義計算天數。",
                  vwap: "成交量加權平均價。收盤價高於 VWAP 視為強勢買入，低於視為弱勢出場。可自定義週期。"
                };
                return (
                  <div key={sig} className="py-2.5 first:pt-0 last:pb-0">
                    <label className="flex items-center gap-2.5 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer hover:text-blue-500 dark:hover:text-blue-400 py-0.5" title={titleMap[sig]}>
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-blue-500 rounded border-zinc-300 dark:border-zinc-800 focus:ring-blue-500 focus:ring-2"
                        checked={config.enabled_conditions[sig] || false}
                        onChange={(e) => handleConditionChange(sig, e.target.checked)}
                      />
                      <span className="font-bold text-sm uppercase">{sig === 'std_dev' ? 'Standard Deviation' : sig.toUpperCase()}</span> 🛈
                    </label>
                    {config.enabled_conditions[sig] && renderInlineParams(sig)}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Signal Drag & Drop Logic */}
        {activeTab === 'signal' && activeSubTab === 'sig_logic' && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-2">
                💡 提示：按住指標區塊可以上下拖曳調整「先後順序」，並可使用中間的下拉選單設定指標之間的交集或聯集關係。
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Entry sequence editor */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-emerald-650 dark:text-emerald-400 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-800 pb-2">
                  📈 進場信號順序與邏輯 (Entry Sequence)
                </h4>
                <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
                  {(!config.entry_sequence || config.entry_sequence.length === 0) ? (
                    <div className="text-xs text-zinc-400 dark:text-zinc-500 py-6 text-center bg-white dark:bg-zinc-950 rounded-xl border border-zinc-250/30 dark:border-zinc-800/30">
                      請先在「動能指標」、「趨勢指標」或「成交量」子分頁中勾選欲啟用的指標。
                    </div>
                  ) : (
                    config.entry_sequence.map((item, idx) => {
                      const labelMap = {
                        rsi: "RSI 指標", macd: "MACD 指標", kd: "KD 指標", williams_r: "威廉指標", cci: "CCI 指標",
                        sma: "SMA 均線", ema: "EMA 均線", adx: "ADX 趨勢", bb: "布林通道",
                        atr: "ATR 波幅", std_dev: "標準差", obv: "OBV 指標", mfi: "MFI 指標", cmf: "CMF 指標", vwap: "VWAP 均線"
                      };
                      return (
                        <React.Fragment key={item.id}>
                          {/* Draggable indicator block */}
                          <div
                            draggable={true}
                            onDragStart={(e) => handleDragStart(e, idx, 'entry')}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, idx, 'entry')}
                            className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl p-3 flex items-center justify-between shadow-sm cursor-grab active:cursor-grabbing hover:border-blue-500 dark:hover:border-blue-500/50 hover:shadow-md transition-all group"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="text-xs font-bold text-zinc-400 dark:text-zinc-650 group-hover:text-blue-500 transition-colors">☰</span>
                              <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-900 px-1.5 py-0.5 rounded font-mono">#{idx+1}</span>
                              <span className="text-sm font-bold text-zinc-800 dark:text-zinc-250 uppercase">{item.id.toUpperCase()}</span>
                              <span className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">({labelMap[item.id] || item.id})</span>
                            </div>
                            <span className="text-[10px] font-bold text-zinc-400/80 dark:text-zinc-600 bg-zinc-50 dark:bg-zinc-900/30 px-2 py-0.5 rounded-full border border-zinc-200/30 dark:border-zinc-800/10">按住拖曳</span>
                          </div>

                          {/* Operator dropdown between items */}
                          {idx < config.entry_sequence.length - 1 && (
                            <div className="flex justify-center py-1">
                              <select
                                className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1 text-xs font-bold text-blue-600 dark:text-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                                value={item.gate || 'AND'}
                                onChange={(e) => handleGateChange(idx, e.target.value, 'entry')}
                              >
                                <option value="AND">交集 (AND / 全部符合)</option>
                                <option value="OR">聯集 (OR / 擇一符合)</option>
                              </select>
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Exit sequence editor */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-rose-500 dark:text-rose-455 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-800 pb-2">
                  📉 出場信號順序與邏輯 (Exit Sequence)
                </h4>
                <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
                  {(!config.exit_sequence || config.exit_sequence.length === 0) ? (
                    <div className="text-xs text-zinc-400 dark:text-zinc-500 py-6 text-center bg-white dark:bg-zinc-950 rounded-xl border border-zinc-250/30 dark:border-zinc-800/30">
                      請先在「動能指標」、「趨勢指標」或「成交量」子分頁中勾選欲啟用的指標。
                    </div>
                  ) : (
                    config.exit_sequence.map((item, idx) => {
                      const labelMap = {
                        rsi: "RSI 指標", macd: "MACD 指標", kd: "KD 指標", williams_r: "威廉指標", cci: "CCI 指標",
                        sma: "SMA 均線", ema: "EMA 均線", adx: "ADX 趨勢", bb: "布林通道",
                        atr: "ATR 波幅", std_dev: "標準差", obv: "OBV 指標", mfi: "MFI 指標", cmf: "CMF 指標", vwap: "VWAP 均線"
                      };
                      return (
                        <React.Fragment key={item.id}>
                          {/* Draggable indicator block */}
                          <div
                            draggable={true}
                            onDragStart={(e) => handleDragStart(e, idx, 'exit')}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, idx, 'exit')}
                            className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl p-3 flex items-center justify-between shadow-sm cursor-grab active:cursor-grabbing hover:border-blue-500 dark:hover:border-blue-500/50 hover:shadow-md transition-all group"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="text-xs font-bold text-zinc-400 dark:text-zinc-650 group-hover:text-blue-500 transition-colors">☰</span>
                              <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-900 px-1.5 py-0.5 rounded font-mono">#{idx+1}</span>
                              <span className="text-sm font-bold text-zinc-800 dark:text-zinc-250 uppercase">{item.id.toUpperCase()}</span>
                              <span className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">({labelMap[item.id] || item.id})</span>
                            </div>
                            <span className="text-[10px] font-bold text-zinc-400/80 dark:text-zinc-600 bg-zinc-50 dark:bg-zinc-900/30 px-2 py-0.5 rounded-full border border-zinc-200/30 dark:border-zinc-800/10">按住拖曳</span>
                          </div>

                          {/* Operator dropdown between items */}
                          {idx < config.exit_sequence.length - 1 && (
                            <div className="flex justify-center py-1">
                              <select
                                className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1 text-xs font-bold text-blue-600 dark:text-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                                value={item.gate || 'OR'}
                                onChange={(e) => handleGateChange(idx, e.target.value, 'exit')}
                              >
                                <option value="AND">交集 (AND / 全部符合)</option>
                                <option value="OR">聯集 (OR / 擇一符合)</option>
                              </select>
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      </div> {/* Closing Left Column */}

      {/* Right Column: Persistent Drag & Drop Sidebar */}
      <div className="lg:col-span-1 bg-zinc-50/50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 flex flex-col space-y-4 shadow-sm h-fit">
        <div className="border-b border-zinc-200 dark:border-zinc-850 pb-2">
          <h3 className="text-xs font-bold text-zinc-800 dark:text-zinc-250 uppercase tracking-wider flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-blue-500" />
            條件邏輯與順序 (Signal Compiler)
          </h3>
        </div>
        
        <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 leading-relaxed block">
          💡 提示：在左側勾選指標後，可在此處上下拖曳卡片調整「進出場先後順序」，並設定指標間的「交集 (AND)」或「聯集 (OR)」。
        </span>

        <div className="space-y-5">
          {/* Entry sequence editor */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              📈 進場信號 (Entry Sequence)
            </h4>
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
              {(!config.entry_sequence || config.entry_sequence.length === 0) ? (
                <div className="text-[11px] text-zinc-400 dark:text-zinc-500 py-6 text-center bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200/50 dark:border-zinc-800/30">
                  請先在左側勾選欲啟用的指標。
                </div>
              ) : (
                config.entry_sequence.map((item, idx) => {
                  const labelMap = {
                    rsi: "RSI 指標", macd: "MACD 指標", kd: "KD 指標", williams_r: "威廉指標", cci: "CCI 指標",
                    sma: "SMA 均線", ema: "EMA 均線", adx: "ADX 趨勢", bb: "布林通道",
                    atr: "ATR 波幅", std_dev: "標準差", obv: "OBV 指標", mfi: "MFI 指標", cmf: "CMF 指標", vwap: "VWAP 均線"
                  };
                  return (
                    <React.Fragment key={item.id}>
                      <div
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, idx, 'entry')}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, idx, 'entry')}
                        className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl p-2.5 flex items-center justify-between shadow-sm cursor-grab active:cursor-grabbing hover:border-blue-500 dark:hover:border-blue-500/50 transition-all group"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-zinc-300 dark:text-zinc-650 group-hover:text-blue-500">☰</span>
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-900 px-1 rounded font-mono">#{idx+1}</span>
                          <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase">{item.id.toUpperCase()}</span>
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">({labelMap[item.id] || item.id})</span>
                        </div>
                      </div>

                      {idx < config.entry_sequence.length - 1 && (
                        <div className="flex justify-center">
                          <select
                            className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 focus:outline-none"
                            value={item.gate || 'AND'}
                            onChange={(e) => handleGateChange(idx, e.target.value, 'entry')}
                          >
                            <option value="AND">交集 (AND)</option>
                            <option value="OR">聯集 (OR)</option>
                          </select>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </div>
          </div>

          {/* Exit sequence editor */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold text-rose-500 dark:text-rose-455 uppercase tracking-wider">
              📉 出場信號 (Exit Sequence)
            </h4>
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
              {(!config.exit_sequence || config.exit_sequence.length === 0) ? (
                <div className="text-[11px] text-zinc-400 dark:text-zinc-500 py-6 text-center bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200/50 dark:border-zinc-800/30">
                  請先在左側勾選欲啟用的指標。
                </div>
              ) : (
                config.exit_sequence.map((item, idx) => {
                  const labelMap = {
                    rsi: "RSI 指標", macd: "MACD 指標", kd: "KD 指標", williams_r: "威廉指標", cci: "CCI 指標",
                    sma: "SMA 均線", ema: "EMA 均線", adx: "ADX 趨勢", bb: "布林通道",
                    atr: "ATR 波幅", std_dev: "標準差", obv: "OBV 指標", mfi: "MFI 指標", cmf: "CMF 指標", vwap: "VWAP 均線"
                  };
                  return (
                    <React.Fragment key={item.id}>
                      <div
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, idx, 'exit')}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, idx, 'exit')}
                        className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl p-2.5 flex items-center justify-between shadow-sm cursor-grab active:cursor-grabbing hover:border-blue-500 dark:hover:border-blue-500/50 transition-all group"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-zinc-300 dark:text-zinc-650 group-hover:text-blue-500">☰</span>
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-900 px-1 rounded font-mono">#{idx+1}</span>
                          <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase">{item.id.toUpperCase()}</span>
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">({labelMap[item.id] || item.id})</span>
                        </div>
                      </div>

                      {idx < config.exit_sequence.length - 1 && (
                        <div className="flex justify-center">
                          <select
                            className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 focus:outline-none"
                            value={item.gate || 'OR'}
                            onChange={(e) => handleGateChange(idx, e.target.value, 'exit')}
                          >
                            <option value="AND">交集 (AND)</option>
                            <option value="OR">聯集 (OR)</option>
                          </select>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      </div> {/* Closing Grid Container */}

      {/* Action Button */}
      <button
        onClick={onRun}
        disabled={loading}
        className="w-full bg-[#0284c7] hover:bg-[#0369a1] disabled:opacity-50 disabled:cursor-not-allowed text-white hover:text-white rounded-xl py-3 font-semibold transition-colors shadow-md flex items-center justify-center gap-2 text-sm uppercase tracking-wider mt-3"
      >
        <Play className="w-4 h-4 fill-current animate-pulse" />
        隨機生成策略與歷史回測 (Generate Random Strategies)
      </button>

    </div>
  );
}
