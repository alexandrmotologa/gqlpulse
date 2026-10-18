import React, { useState, useEffect } from 'react';
import { Settings, Shield, Sliders, Save, Check, RefreshCw, AlertCircle } from 'lucide-react';
import { QueryComplexityConfig } from '../types.js';

export const RulesConfigView: React.FC = () => {
  const [rules, setRules] = useState<QueryComplexityConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldCost, setNewFieldCost] = useState(10);

  const fetchRules = async () => {
    try {
      const res = await fetch('/api/rules');
      if (res.ok) {
        const data = await res.json();
        setRules(data);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!rules) return;
    setSaving(true);
    setSavedSuccess(false);

    try {
      const res = await fetch('/api/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rules),
      });

      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      }
    } catch {
      // Ignore
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  if (loading || !rules) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400 text-xs font-mono">
        Loading proxy security configuration...
      </div>
    );
  }

  const handleAddFieldOverride = () => {
    if (!newFieldKey.trim()) return;
    setRules({
      ...rules,
      fieldCosts: {
        ...(rules.fieldCosts || {}),
        [newFieldKey.trim()]: newFieldCost,
      },
    });
    setNewFieldKey('');
  };

  const handleRemoveFieldOverride = (key: string) => {
    const updated = { ...rules.fieldCosts };
    delete updated[key];
    setRules({
      ...rules,
      fieldCosts: updated,
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Settings className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100">Security & Complexity Budget Rules</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Tune thresholds, block cyclic DoS attacks, and hot-reload rules across the proxy without downtime
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs font-mono transition shadow-lg shadow-cyan-500/20"
        >
          {savedSuccess ? (
            <>
              <Check className="w-4 h-4 text-slate-950" />
              <span>Saved & Hot-Reloaded!</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>{saving ? 'Applying...' : 'Save & Hot Reload'}</span>
            </>
          )}
        </button>
      </div>

      {/* Sliders Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
        <h3 className="text-xs font-bold font-mono text-slate-300 uppercase tracking-wide flex items-center space-x-2">
          <Sliders className="w-4 h-4 text-cyan-400" />
          <span>Core Thresholds & Scoring Weights</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Max Complexity */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">Max Query Complexity:</span>
              <span className="font-bold text-cyan-400">{rules.maxComplexity} pts</span>
            </div>
            <input
              type="range"
              min="50"
              max="1000"
              step="25"
              value={rules.maxComplexity}
              onChange={(e) => setRules({ ...rules, maxComplexity: parseInt(e.target.value, 10) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <p className="text-[11px] text-slate-500">Queries exceeding this score are rejected before hitting the database.</p>
          </div>

          {/* Max Depth */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">Max Nesting Depth:</span>
              <span className="font-bold text-cyan-400">{rules.maxDepth} levels</span>
            </div>
            <input
              type="range"
              min="3"
              max="20"
              step="1"
              value={rules.maxDepth}
              onChange={(e) => setRules({ ...rules, maxDepth: parseInt(e.target.value, 10) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <p className="text-[11px] text-slate-500">Rejects deeply nested cyclic trees that can exhaust server call stacks.</p>
          </div>

          {/* Default List Multiplier */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">Default List Multiplier:</span>
              <span className="font-bold text-cyan-400">{rules.defaultListMultiplier}x</span>
            </div>
            <input
              type="range"
              min="2"
              max="50"
              step="2"
              value={rules.defaultListMultiplier}
              onChange={(e) => setRules({ ...rules, defaultListMultiplier: parseInt(e.target.value, 10) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <p className="text-[11px] text-slate-500">Multiplier applied when a list field has no explicit slice argument.</p>
          </div>

          {/* Object Base Cost */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">Composite Object Cost:</span>
              <span className="font-bold text-cyan-400">{rules.objectCost} pts</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={rules.objectCost}
              onChange={(e) => setRules({ ...rules, objectCost: parseInt(e.target.value, 10) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <p className="text-[11px] text-slate-500">Base weight applied to each composite field containing subselections.</p>
          </div>
        </div>

        {/* Toggles */}
        <div className="border-t border-slate-800 pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-start space-x-3 cursor-pointer bg-slate-950 p-3.5 rounded-lg border border-slate-800 hover:border-slate-700 transition">
            <input
              type="checkbox"
              checked={rules.blockIntrospection}
              onChange={(e) => setRules({ ...rules, blockIntrospection: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0 cursor-pointer"
            />
            <div>
              <span className="text-xs font-semibold text-slate-200 block">Block Introspection Queries</span>
              <span className="text-[11px] text-slate-400">
                Immediately drops queries accessing __schema or __type to prevent external schema harvesting.
              </span>
            </div>
          </label>

          <label className="flex items-start space-x-3 cursor-pointer bg-slate-950 p-3.5 rounded-lg border border-slate-800 hover:border-slate-700 transition">
            <input
              type="checkbox"
              checked={rules.dryRun}
              onChange={(e) => setRules({ ...rules, dryRun: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0 cursor-pointer"
            />
            <div>
              <span className="text-xs font-semibold text-slate-200 block">Dry Run / Audit Mode</span>
              <span className="text-[11px] text-slate-400">
                Calculates violations and emits telemetry warnings without rejecting client requests.
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* Field Overrides Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold font-mono text-slate-300 uppercase tracking-wide">
            Custom Field Cost Overrides
          </h3>
          <span className="text-[11px] text-slate-400 font-mono">
            {Object.keys(rules.fieldCosts || {}).length} custom overrides
          </span>
        </div>

        {/* Add Override Input Row */}
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={newFieldKey}
            onChange={(e) => setNewFieldKey(e.target.value)}
            placeholder="e.g. Query.users or User.orders"
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
          />
          <input
            type="number"
            min="1"
            max="100"
            value={newFieldCost}
            onChange={(e) => setNewFieldCost(parseInt(e.target.value, 10) || 1)}
            className="w-20 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500 text-center"
          />
          <button
            onClick={handleAddFieldOverride}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-mono font-medium rounded-lg text-slate-200 transition"
          >
            Add Override
          </button>
        </div>

        {/* Overrides List */}
        {rules.fieldCosts && Object.keys(rules.fieldCosts).length > 0 && (
          <div className="border border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2 px-3">Field Signature</th>
                  <th className="py-2 px-3 text-center">Assigned Weight</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {Object.entries(rules.fieldCosts).map(([key, val]) => (
                  <tr key={key} className="hover:bg-slate-800/30">
                    <td className="py-2 px-3 text-cyan-300 font-semibold">{key}</td>
                    <td className="py-2 px-3 text-center font-bold text-slate-100">{val} pts</td>
                    <td className="py-2 px-3 text-right">
                      <button
                        onClick={() => handleRemoveFieldOverride(key)}
                        className="text-rose-400 hover:text-rose-300 text-[11px] transition"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
