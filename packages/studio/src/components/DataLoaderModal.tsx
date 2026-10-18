import React, { useState } from 'react';
import { X, Copy, Check, Sparkles, Code2, AlertTriangle, ArrowRight } from 'lucide-react';
import { NPlusOneAlert } from '../types.js';

interface DataLoaderModalProps {
  alert: NPlusOneAlert | null;
  onClose: () => void;
}

export const DataLoaderModal: React.FC<DataLoaderModalProps> = ({ alert, onClose }) => {
  const [copiedBatch, setCopiedBatch] = useState(false);
  const [copiedResolver, setCopiedResolver] = useState(false);

  if (!alert) return null;

  const handleCopyBatch = () => {
    navigator.clipboard.writeText(alert.dataLoaderSnippet);
    setCopiedBatch(true);
    setTimeout(() => setCopiedBatch(false), 2000);
  };

  const handleCopyResolver = () => {
    navigator.clipboard.writeText(alert.resolverFixSnippet);
    setCopiedResolver(true);
    setTimeout(() => setCopiedResolver(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100 flex items-center space-x-2">
                <span>Remediate N+1 Cascade with DataLoader</span>
                <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono font-medium border border-amber-500/20">
                  {alert.signature}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Automatically generated batching implementation and refactored resolver code
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-x-0 space-y-5 overflow-y-auto">
          {/* Diagnostic Stats Banner */}
          <div className="bg-amber-950/20 border border-amber-800/40 rounded-lg p-4 flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <div className="font-semibold text-amber-200">
                Cascade Detected: {alert.occurrences} sequential executions
              </div>
              <div className="text-slate-300">
                Total duration: <span className="font-mono text-amber-300">{(alert.totalDurationUs / 1000).toFixed(2)}ms</span> across {alert.occurrences} items.
                Adopting DataLoader collapses this into 1 single batched roundtrip, yielding an estimated ~85% reduction in latency.
              </div>
            </div>
          </div>

          {/* Snippet 1: DataLoader Function */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center space-x-2">
                <Code2 className="w-4 h-4 text-cyan-400" />
                <span>1. Batch Loader Definition (DataLoader)</span>
              </label>
              <button
                onClick={handleCopyBatch}
                className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                {copiedBatch ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedBatch ? 'Copied' : 'Copy Loader'}</span>
              </button>
            </div>
            <pre className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs text-cyan-200/90 overflow-x-auto leading-relaxed">
              <code>{alert.dataLoaderSnippet}</code>
            </pre>
          </div>

          {/* Snippet 2: Refactored Resolver */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center space-x-2">
                <ArrowRight className="w-4 h-4 text-emerald-400" />
                <span>2. Updated Resolver Implementation</span>
              </label>
              <button
                onClick={handleCopyResolver}
                className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                {copiedResolver ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedResolver ? 'Copied' : 'Copy Resolver'}</span>
              </button>
            </div>
            <pre className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs text-emerald-200/90 overflow-x-auto leading-relaxed">
              <code>{alert.resolverFixSnippet}</code>
            </pre>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
