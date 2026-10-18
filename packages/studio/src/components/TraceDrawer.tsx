import React, { useState } from 'react';
import { X, Copy, Check, Clock, ShieldAlert, CheckCircle2, Flame, Layers, Code } from 'lucide-react';
import { WaterfallTrace, NPlusOneAlert } from '../types.js';

interface TraceDrawerProps {
  trace: WaterfallTrace | null;
  onClose: () => void;
  onOpenDataLoaderModal: (alert: NPlusOneAlert) => void;
}

export const TraceDrawer: React.FC<TraceDrawerProps> = ({
  trace,
  onClose,
  onOpenDataLoaderModal,
}) => {
  const [copiedQuery, setCopiedQuery] = useState(false);

  if (!trace) return null;

  const handleCopyQuery = () => {
    navigator.clipboard.writeText(trace.query);
    setCopiedQuery(true);
    setTimeout(() => setCopiedQuery(false), 2000);
  };

  const isBlocked = trace.status === 'BLOCKED';
  const hasN1 = trace.nPlusOneAlerts && trace.nPlusOneAlerts.length > 0;

  // Max duration for scaling waterfall bars
  const maxSpanDuration = Math.max(...(trace.spans.map((s) => s.startOffsetUs + s.durationUs) || [1]), 1);

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {isBlocked ? (
            <span className="p-1.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <ShieldAlert className="w-5 h-5" />
            </span>
          ) : (
            <span className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </span>
          )}
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold font-mono text-slate-100">
                {trace.operationName || 'Anonymous Operation'}
              </h2>
              <span
                className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded ${
                  isBlocked
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {trace.status}
              </span>
            </div>
            <p className="text-[11px] font-mono text-slate-400 mt-0.5">{trace.id}</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Drawer Body */}
      <div className="p-6 space-y-6 overflow-y-auto flex-1">
        {/* Metric Badges */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3">
            <span className="text-[10px] uppercase font-mono text-slate-400">Total Latency</span>
            <div className="text-base font-bold font-mono text-slate-100 mt-1">
              {trace.totalDurationMs} <span className="text-xs font-normal text-slate-400">ms</span>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3">
            <span className="text-[10px] uppercase font-mono text-slate-400">Complexity</span>
            <div className="text-base font-bold font-mono text-cyan-400 mt-1">
              {trace.complexity} <span className="text-xs font-normal text-slate-400">pts</span>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3">
            <span className="text-[10px] uppercase font-mono text-slate-400">Nesting Depth</span>
            <div className="text-base font-bold font-mono text-slate-200 mt-1">
              {trace.depth} <span className="text-xs font-normal text-slate-400">lvls</span>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3">
            <span className="text-[10px] uppercase font-mono text-slate-400">Spans Traced</span>
            <div className="text-base font-bold font-mono text-indigo-400 mt-1">
              {trace.spans.length}
            </div>
          </div>
        </div>

        {/* Blocked Violation Message */}
        {isBlocked && trace.errorMessage && (
          <div className="bg-rose-950/20 border border-rose-800/40 rounded-lg p-4 flex items-start space-x-3">
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <div className="font-semibold text-rose-200">Execution Blocked by GQLPulse</div>
              <div className="text-rose-300 font-mono text-[11px]">{trace.errorMessage}</div>
            </div>
          </div>
        )}

        {/* N+1 Alerts Banner */}
        {hasN1 && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-amber-300 flex items-center space-x-2">
              <Flame className="w-4 h-4 text-amber-400" />
              <span>N+1 Resolver Cascades Detected ({trace.nPlusOneAlerts.length})</span>
            </h3>
            {trace.nPlusOneAlerts.map((alert) => (
              <div
                key={alert.id}
                className="bg-amber-950/20 border border-amber-800/50 rounded-lg p-3.5 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold text-amber-200">{alert.signature}</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 font-semibold">
                      {alert.occurrences} calls
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1">
                    Added {(alert.totalDurationUs / 1000).toFixed(2)}ms across repeated resolver loops.
                  </p>
                </div>
                <button
                  onClick={() => onOpenDataLoaderModal(alert)}
                  className="px-3 py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-medium transition"
                >
                  Generate Fix
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Resolver Spans Waterfall */}
        {trace.spans && trace.spans.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-200 flex items-center space-x-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>Resolver Execution Waterfall</span>
              </h3>
              <span className="text-[11px] text-slate-400 font-mono">
                {trace.spans.length} resolvers profiled
              </span>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-[11px] space-y-2 max-h-72 overflow-y-auto">
              {trace.spans.map((span, idx) => {
                const pathStr = span.path.join('.');
                const offsetPercent = Math.min(100, (span.startOffsetUs / maxSpanDuration) * 100);
                const widthPercent = Math.max(2, Math.min(100 - offsetPercent, (span.durationUs / maxSpanDuration) * 100));

                const isSlow = span.durationUs > 10000;

                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="truncate max-w-[280px]" title={pathStr}>
                        <span className="text-slate-500">{span.parentType}.</span>
                        <span className="text-cyan-300 font-semibold">{span.fieldName}</span>
                      </span>
                      <span className="text-slate-400 text-[10px]">
                        {(span.durationUs / 1000).toFixed(2)}ms (self: {(span.selfTimeUs / 1000).toFixed(2)}ms)
                      </span>
                    </div>

                    {/* Timeline bar */}
                    <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden relative">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isSlow ? 'bg-amber-500' : 'bg-cyan-500'
                        }`}
                        style={{
                          marginLeft: `${offsetPercent}%`,
                          width: `${widthPercent}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* GraphQL Query String */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300 flex items-center space-x-2">
              <Code className="w-4 h-4 text-slate-400" />
              <span>Query Payload</span>
            </label>
            <button
              onClick={handleCopyQuery}
              className="flex items-center space-x-1.5 px-2 py-1 text-xs font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              {copiedQuery ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedQuery ? 'Copied' : 'Copy Query'}</span>
            </button>
          </div>
          <pre className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed">
            <code>{trace.query}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
