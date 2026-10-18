import React, { useState } from 'react';
import { X, Play, Sparkles, ArrowRight, CheckCircle2, Flame, RefreshCw, Layers } from 'lucide-react';
import { ComparisonSimulationResult } from '../types.js';

interface DataLoaderSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenFixSnippet: (signature: string) => void;
  initialQuery?: string;
}

export const DataLoaderSimulatorModal: React.FC<DataLoaderSimulatorModalProps> = ({
  isOpen,
  onClose,
  onOpenFixSnippet,
  initialQuery,
}) => {
  const DEFAULT_SIMULATION_QUERY = `query CompareDataLoaderCascades {
  posts(first: 6) {
    id
    title
    author {
      id
      displayName
      role
    }
    comments(limit: 2) {
      id
      text
      author {
        id
        username
      }
    }
  }
}`;

  const [query, setQuery] = useState(initialQuery || DEFAULT_SIMULATION_QUERY);
  const [simulation, setSimulation] = useState<ComparisonSimulationResult | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleRunSimulation = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/simulate-dataloader', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      if (res.ok) {
        const data = await res.json();
        setSimulation(data);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Sparkles className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                <span>DataLoader Performance Benchmarking Simulator</span>
                <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono font-medium">
                  Side-by-Side Dual Run
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Simulates real-world database roundtrips comparing unbatched resolvers against batch DataLoader execution
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Query input and run button */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-semibold text-slate-300">
                Simulation Query Payload:
              </label>
              <button
                onClick={handleRunSimulation}
                disabled={loading}
                className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold font-mono text-xs transition shadow-lg shadow-cyan-500/20"
              >
                <Play className={`w-3.5 h-3.5 fill-current ${loading ? 'animate-spin' : ''}`} />
                <span>{loading ? 'Simulating Dual Execution...' : 'Run Side-by-Side Comparison'}</span>
              </button>
            </div>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={5}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs text-cyan-200/90 focus:outline-none focus:border-cyan-500/60 leading-relaxed resize-y"
            />
          </div>

          {/* Results Side-by-Side */}
          {simulation && (
            <div className="space-y-6">
              {/* Savings Banner */}
              <div className="bg-gradient-to-r from-emerald-950/40 via-cyan-950/30 to-slate-950 border border-emerald-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-emerald-200">
                      DataLoader Optimization Verified!
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Batching with DataLoader eliminated <span className="text-emerald-400 font-bold">{simulation.unbatched.spansCount - simulation.batched.spansCount} redundant roundtrips</span> and reduced query latency by <span className="text-cyan-300 font-bold">{simulation.latencyReductionPercent}%</span>.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => onOpenFixSnippet('Post.author')}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-mono font-bold transition whitespace-nowrap"
                >
                  View Code Fix
                </button>
              </div>

              {/* Side-by-Side Comparison Columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Column 1: Unbatched (Before) */}
                <div className="bg-slate-950 border border-amber-900/40 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-amber-950 pb-3">
                    <div className="flex items-center space-x-2">
                      <Flame className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold font-mono text-amber-300 uppercase">
                        Unbatched (Before)
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      N+1 Detected
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 font-mono">
                    <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-lg">
                      <span className="text-[10px] text-slate-400 uppercase block">Total Latency</span>
                      <span className="text-base font-bold text-amber-400">
                        {simulation.unbatched.durationMs} ms
                      </span>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-lg">
                      <span className="text-[10px] text-slate-400 uppercase block">DB Queries</span>
                      <span className="text-base font-bold text-rose-400">
                        {simulation.unbatched.spansCount} calls
                      </span>
                    </div>
                  </div>

                  {/* Waterfall Snippet */}
                  <div className="space-y-1.5 pt-2">
                    <span className="text-[11px] font-mono text-slate-400 block">Execution Timeline:</span>
                    <div className="space-y-1.5 bg-slate-900 p-3 rounded-lg max-h-48 overflow-y-auto">
                      {simulation.unbatched.spans.slice(0, 8).map((s, i) => (
                        <div key={i} className="space-y-1">
                          <div className="flex justify-between text-[10px] font-mono text-slate-300">
                            <span className="text-amber-300">{s.parentType}.{s.fieldName}</span>
                            <span>{(s.durationUs / 1000).toFixed(1)}ms</span>
                          </div>
                          <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-amber-500 h-full rounded-full" style={{ width: '80%' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Column 2: Batched (After) */}
                <div className="bg-slate-950 border border-emerald-900/40 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-emerald-950 pb-3">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold font-mono text-emerald-300 uppercase">
                        DataLoader Batched (After)
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      0 Cascades
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 font-mono">
                    <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-lg">
                      <span className="text-[10px] text-slate-400 uppercase block">Total Latency</span>
                      <span className="text-base font-bold text-emerald-400">
                        {simulation.batched.durationMs} ms
                      </span>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-lg">
                      <span className="text-[10px] text-slate-400 uppercase block">DB Queries</span>
                      <span className="text-base font-bold text-emerald-400">
                        {simulation.batched.dbQueriesEstimated} batched
                      </span>
                    </div>
                  </div>

                  {/* Waterfall Snippet */}
                  <div className="space-y-1.5 pt-2">
                    <span className="text-[11px] font-mono text-slate-400 block">Execution Timeline:</span>
                    <div className="space-y-1.5 bg-slate-900 p-3 rounded-lg max-h-48 overflow-y-auto">
                      {simulation.batched.spans.slice(0, 4).map((s, i) => (
                        <div key={i} className="space-y-1">
                          <div className="flex justify-between text-[10px] font-mono text-slate-300">
                            <span className="text-emerald-300">{s.parentType}.{s.fieldName}</span>
                            <span>{(s.durationUs / 1000).toFixed(1)}ms</span>
                          </div>
                          <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-emerald-500 h-full rounded-full" style={{ width: '30%' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-mono font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition"
          >
            Close Simulator
          </button>
        </div>
      </div>
    </div>
  );
};
