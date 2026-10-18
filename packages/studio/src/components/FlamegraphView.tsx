import React, { useState } from 'react';
import { Flame, Clock, Layers, Sparkles, AlertTriangle, ArrowRight, Check, Copy } from 'lucide-react';
import { WaterfallTrace, ResolverSpan, NPlusOneAlert } from '../types.js';

interface FlamegraphViewProps {
  traces: WaterfallTrace[];
  onOpenDataLoaderModal: (alert: NPlusOneAlert) => void;
}

export const FlamegraphView: React.FC<FlamegraphViewProps> = ({ traces, onOpenDataLoaderModal }) => {
  // Find traces that have resolver spans
  const tracesWithSpans = traces.filter((t) => t.spans && t.spans.length > 0);
  const [selectedTraceId, setSelectedTraceId] = useState<string>(
    tracesWithSpans[0]?.id || traces[0]?.id || ''
  );

  const selectedTrace = traces.find((t) => t.id === selectedTraceId) || tracesWithSpans[0] || traces[0];

  if (!selectedTrace) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
        <Flame className="w-8 h-8 text-slate-500 mx-auto mb-2" />
        <h3 className="text-sm font-semibold text-slate-200">No profiled traces available</h3>
        <p className="text-xs text-slate-400 mt-1">
          Execute GraphQL queries against the proxy to record resolver timing spans and inspect waterfalls.
        </p>
      </div>
    );
  }

  const spans = selectedTrace.spans || [];
  const maxSpanEndUs = Math.max(...spans.map((s) => s.startOffsetUs + s.durationUs), 1000);
  const totalDurationMs = selectedTrace.totalDurationMs || Math.round(maxSpanEndUs / 1000);

  // Group repeated resolvers to highlight N+1
  const signatureCounts = new Map<string, number>();
  for (const s of spans) {
    const sig = `${s.parentType}.${s.fieldName}`;
    signatureCounts.set(sig, (signatureCounts.get(sig) || 0) + 1);
  }

  return (
    <div className="space-y-6">
      {/* Selector & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Layers className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
              <span>Waterfall Flamegraph Explorer</span>
              <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                {spans.length} spans
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Inspect execution timing, resolver self-time, and detect cascading N+1 database fetches
            </p>
          </div>
        </div>

        {/* Trace Selector Dropdown */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-400 font-mono">Trace:</span>
          <select
            value={selectedTrace.id}
            onChange={(e) => setSelectedTraceId(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500"
          >
            {traces.map((t) => (
              <option key={t.id} value={t.id}>
                {t.operationName || 'Query'} ({t.totalDurationMs}ms, {t.spans?.length || 0} spans) - {t.id.slice(-6)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* N+1 Alerts on Selected Trace */}
      {selectedTrace.nPlusOneAlerts && selectedTrace.nPlusOneAlerts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold font-mono text-amber-400 uppercase tracking-wider flex items-center space-x-2">
            <Flame className="w-4 h-4 text-amber-400" />
            <span>N+1 Bottleneck Alerts in this Query ({selectedTrace.nPlusOneAlerts.length})</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {selectedTrace.nPlusOneAlerts.map((alert) => (
              <div
                key={alert.id}
                className="bg-amber-950/20 border border-amber-800/50 rounded-xl p-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-bold text-amber-300">{alert.signature}</span>
                    <span className="px-2 py-0.5 text-xs font-mono font-semibold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {alert.occurrences}x cascade
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-2">
                    {alert.message}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-amber-800/30 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-amber-400/80">
                    Saved latency: ~{Math.round((alert.totalDurationUs * 0.85) / 1000)}ms
                  </span>
                  <button
                    onClick={() => onOpenDataLoaderModal(alert)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate DataLoader Fix</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Flamegraph / Gantt Timeline View */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        {/* Timeline Axis Ruler */}
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 border-b border-slate-800 pb-2">
          <span>0ms</span>
          <span>{(totalDurationMs * 0.25).toFixed(1)}ms</span>
          <span>{(totalDurationMs * 0.5).toFixed(1)}ms</span>
          <span>{(totalDurationMs * 0.75).toFixed(1)}ms</span>
          <span>{totalDurationMs.toFixed(1)}ms</span>
        </div>

        {/* Spans Gantt Bars */}
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {spans.map((span, idx) => {
            const sig = `${span.parentType}.${span.fieldName}`;
            const isRepeated = (signatureCounts.get(sig) || 0) >= 3;
            const isSlow = span.durationUs > 12000;

            const offsetPercent = Math.min(98, (span.startOffsetUs / maxSpanEndUs) * 100);
            const widthPercent = Math.max(2, Math.min(100 - offsetPercent, (span.durationUs / maxSpanEndUs) * 100));

            const depthIndent = (span.path.length - 1) * 12;

            let barColor = 'bg-cyan-500 hover:bg-cyan-400';
            if (isRepeated) {
              barColor = 'bg-amber-500 hover:bg-amber-400';
            } else if (isSlow) {
              barColor = 'bg-rose-500 hover:bg-rose-400';
            }

            return (
              <div key={idx} className="group relative">
                <div className="flex items-center justify-between text-xs font-mono text-slate-300 mb-1">
                  <div className="flex items-center space-x-2 truncate" style={{ paddingLeft: `${depthIndent}px` }}>
                    <span className="text-slate-500">{span.parentType}.</span>
                    <span className="text-slate-200 font-semibold">{span.fieldName}</span>
                    {isRepeated && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-amber-500/20 text-amber-300">
                        N+1
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-3 text-[11px] text-slate-400 shrink-0">
                    <span>total: <span className="text-slate-200">{(span.durationUs / 1000).toFixed(2)}ms</span></span>
                    <span>self: <span className="text-slate-200">{(span.selfTimeUs / 1000).toFixed(2)}ms</span></span>
                  </div>
                </div>

                <div className="w-full bg-slate-950 rounded-md h-3 overflow-hidden relative border border-slate-800/60">
                  <div
                    className={`h-full rounded transition-all cursor-pointer ${barColor}`}
                    style={{
                      marginLeft: `${offsetPercent}%`,
                      width: `${widthPercent}%`,
                    }}
                    title={`${span.parentType}.${span.fieldName} (${(span.durationUs / 1000).toFixed(2)}ms)`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
