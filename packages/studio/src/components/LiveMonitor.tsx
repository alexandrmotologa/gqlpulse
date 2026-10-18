import React, { useState } from 'react';
import { Search, Flame, ShieldAlert, CheckCircle2, Filter, Play, ArrowUpRight, Clock } from 'lucide-react';
import { WaterfallTrace, NPlusOneAlert } from '../types.js';

interface LiveMonitorProps {
  traces: WaterfallTrace[];
  onSelectTrace: (trace: WaterfallTrace) => void;
  onOpenDataLoaderModal: (alert: NPlusOneAlert) => void;
  onExecuteSample: (query: string) => void;
}

export const LiveMonitor: React.FC<LiveMonitorProps> = ({
  traces,
  onSelectTrace,
  onOpenDataLoaderModal,
  onExecuteSample,
}) => {
  const [filterType, setFilterType] = useState<'ALL' | 'BLOCKED' | 'N1' | 'SUCCESS'>('ALL');
  const [search, setSearch] = useState('');

  const filteredTraces = traces.filter((t) => {
    if (filterType === 'BLOCKED' && t.status !== 'BLOCKED') return false;
    if (filterType === 'SUCCESS' && t.status !== 'SUCCESS') return false;
    if (filterType === 'N1' && (!t.nPlusOneAlerts || t.nPlusOneAlerts.length === 0)) return false;

    if (search) {
      const q = search.toLowerCase();
      const matchOp = t.operationName?.toLowerCase().includes(q);
      const matchQuery = t.query.toLowerCase().includes(q);
      const matchIp = t.clientIp?.toLowerCase().includes(q);
      if (!matchOp && !matchQuery && !matchIp) return false;
    }

    return true;
  });

  const blockedCount = traces.filter((t) => t.status === 'BLOCKED').length;
  const n1Count = traces.filter((t) => t.nPlusOneAlerts && t.nPlusOneAlerts.length > 0).length;
  const successCount = traces.filter((t) => t.status === 'SUCCESS').length;

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Filter Pills */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition ${
              filterType === 'ALL'
                ? 'bg-slate-800 text-slate-100 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Queries ({traces.length})
          </button>

          <button
            onClick={() => setFilterType('BLOCKED')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition ${
              filterType === 'BLOCKED'
                ? 'bg-rose-950/40 text-rose-300 border border-rose-800/60'
                : 'text-slate-400 hover:text-rose-300'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Blocked ({blockedCount})</span>
          </button>

          <button
            onClick={() => setFilterType('N1')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition ${
              filterType === 'N1'
                ? 'bg-amber-950/40 text-amber-300 border border-amber-800/60'
                : 'text-slate-400 hover:text-amber-300'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>N+1 Cascades ({n1Count})</span>
          </button>

          <button
            onClick={() => setFilterType('SUCCESS')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition ${
              filterType === 'SUCCESS'
                ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/60'
                : 'text-slate-400 hover:text-emerald-300'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Passed ({successCount})</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search query, operation, IP..."
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
      </div>

      {/* Traces Feed Table */}
      {filteredTraces.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-12 text-center">
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-12 h-12 rounded-full bg-cyan-950/40 border border-cyan-800/40 flex items-center justify-center mx-auto text-cyan-400">
              <Play className="w-6 h-6 ml-0.5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-200">No matching GraphQL queries in feed</h3>
              <p className="text-xs text-slate-400 mt-1">
                Send queries through the reverse proxy on <code className="text-cyan-400 font-mono">http://localhost:4000/graphql</code>,
                or execute sample queries below to test live profiling:
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() =>
                  onExecuteSample(`query GetUsersAndPosts {
  users(first: 5) {
    id
    displayName
    role
  }
}`)
                }
                className="px-3 py-2 text-xs font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-between"
              >
                <span>⚡ Run Normal Query (Low Complexity)</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                onClick={() =>
                  onExecuteSample(`query UnbatchedN1Query {
  posts(first: 6) {
    id
    title
    author {
      id
      displayName
    }
    comments(limit: 3) {
      id
      text
      author {
        id
        username
      }
    }
  }
}`)
                }
                className="px-3 py-2 text-xs font-mono rounded bg-amber-950/30 hover:bg-amber-950/50 border border-amber-800/40 text-amber-300 flex items-center justify-between"
              >
                <span>🔥 Run N+1 Cascade Query (Unbatched Authors)</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
              </button>

              <button
                onClick={() =>
                  onExecuteSample(`query DeepAbusiveDoSAttack {
  users(first: 20) {
    posts {
      comments {
        author {
          posts {
            comments {
              author {
                posts {
                  id
                }
              }
            }
          }
        }
      }
    }
  }
}`)
                }
                className="px-3 py-2 text-xs font-mono rounded bg-rose-950/30 hover:bg-rose-950/50 border border-rose-800/40 text-rose-300 flex items-center justify-between"
              >
                <span>🛡️ Run Abusive DoS Query (Triggers Blocker)</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTraces.map((trace) => {
            const isBlocked = trace.status === 'BLOCKED';
            const hasN1 = trace.nPlusOneAlerts && trace.nPlusOneAlerts.length > 0;

            let complexityBadge = 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
            if (trace.complexity > 200) complexityBadge = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
            else if (trace.complexity > 100) complexityBadge = 'bg-amber-500/10 text-amber-400 border-amber-500/20';

            return (
              <div
                key={trace.id}
                onClick={() => onSelectTrace(trace)}
                className="bg-slate-900 border border-slate-800/80 hover:border-slate-700 rounded-xl p-4 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
              >
                <div className="flex items-start space-x-3.5 min-w-0">
                  <div className="mt-1">
                    {isBlocked ? (
                      <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 block">
                        <ShieldAlert className="w-4 h-4" />
                      </span>
                    ) : (
                      <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 block">
                        <CheckCircle2 className="w-4 h-4" />
                      </span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-bold font-mono text-slate-100 truncate group-hover:text-cyan-400 transition">
                        {trace.operationName || 'GraphQL Query'}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${
                          isBlocked
                            ? 'bg-rose-950/40 text-rose-300 border-rose-800/60'
                            : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
                        }`}
                      >
                        {trace.status}
                      </span>
                      {hasN1 && (
                        <span className="flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-950/50 text-amber-400 border border-amber-800/60">
                          <Flame className="w-3 h-3" />
                          <span>N+1 ({trace.nPlusOneAlerts.length})</span>
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-mono text-slate-400 truncate max-w-xl mt-1">
                      {trace.query.replace(/\s+/g, ' ').substring(0, 95)}...
                    </p>

                    {isBlocked && trace.errorMessage && (
                      <p className="text-[11px] font-mono text-rose-400 mt-1 flex items-center space-x-1 truncate max-w-lg">
                        <span>{trace.errorMessage}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Metrics on Card */}
                <div className="flex items-center space-x-4 shrink-0 text-xs font-mono">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block uppercase">Latency</span>
                    <span className="font-semibold text-slate-200">{trace.totalDurationMs}ms</span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block uppercase">Score</span>
                    <span className={`px-2 py-0.5 rounded border font-bold ${complexityBadge}`}>
                      {trace.complexity} pts
                    </span>
                  </div>

                  <div className="text-right hidden md:block">
                    <span className="text-[10px] text-slate-400 block uppercase">Depth</span>
                    <span className="text-slate-300">{trace.depth} lvls</span>
                  </div>

                  <button className="px-3 py-1.5 rounded-lg bg-slate-800 group-hover:bg-cyan-500/20 text-slate-300 group-hover:text-cyan-300 text-xs font-semibold transition">
                    Inspect
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
