import React, { useState } from 'react';
import { Zap, Play, AlertTriangle, ShieldCheck, ShieldAlert, CheckCircle2, RefreshCw, Layers } from 'lucide-react';

export const LinterSandbox: React.FC = () => {
  const PRESETS: Record<string, string> = {
    'Healthy Query': `query GetProductsAndCategories {
  products(first: 5) {
    id
    name
    price
    category {
      id
      name
    }
  }
}`,
    'N+1 Cascade (Posts & Authors)': `query UnbatchedN1Query {
  posts(first: 8) {
    id
    title
    author {
      id
      displayName
      role
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
}`,
    'Deep Nested DoS Attack': `query DeepAttack {
  users(first: 10) {
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
}`,
    'Abusive List Multiplier': `query HighMultiplierAttack {
  users(first: 50) {
    posts(limit: 30) {
      id
      title
      comments(limit: 20) {
        id
        text
      }
    }
  }
}`,
    'Introspection Query': `query IntrospectionProbe {
  __schema {
    types {
      name
      fields {
        name
      }
    }
  }
}`,
  };

  const [query, setQuery] = useState(PRESETS['N+1 Cascade (Posts & Authors)']);
  const [analysis, setAnalysis] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [executionResponse, setExecutionResponse] = useState<any>(null);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      setAnalysis(data);
    } catch (err: any) {
      setAnalysis({ isBlocked: true, violations: [{ message: err.message }] });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleExecute = async () => {
    setExecuting(true);
    setExecutionResponse(null);
    try {
      const res = await fetch('/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      setExecutionResponse({
        status: res.status,
        data,
      });
      // also re-analyze
      handleAnalyze();
    } catch (err: any) {
      setExecutionResponse({
        status: 500,
        data: { error: err.message },
      });
    } finally {
      setExecuting(false);
    }
  };

  // Run initial analysis on first load
  React.useEffect(() => {
    handleAnalyze();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Zap className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100">Query Complexity Linter & Pre-Flight Sandbox</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Simulate AST complexity scoring, list multipliers, recursion cycles, and test query execution in real time
            </p>
          </div>
        </div>

        {/* Preset Selector */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-400 font-mono">Load Preset:</span>
          <select
            onChange={(e) => {
              const selected = PRESETS[e.target.value];
              if (selected) {
                setQuery(selected);
                setExecutionResponse(null);
              }
            }}
            className="bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500"
          >
            {Object.keys(PRESETS).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Split Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Query Editor */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-mono text-slate-300 uppercase tracking-wide">
              GraphQL Query Input
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-medium transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${analyzing ? 'animate-spin' : ''}`} />
                <span>Lint AST (&lt;0.5ms)</span>
              </button>

              <button
                onClick={handleExecute}
                disabled={executing}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-mono font-bold transition shadow-lg shadow-cyan-500/20"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{executing ? 'Executing...' : 'Run Query'}</span>
              </button>
            </div>
          </div>

          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={14}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs text-cyan-200/90 focus:outline-none focus:border-cyan-500/60 leading-relaxed resize-y"
            placeholder="Enter GraphQL query..."
          />

          {/* Real Execution Response Preview */}
          {executionResponse && (
            <div className="border-t border-slate-800 pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-slate-300">
                  Response (Status: {executionResponse.status})
                </span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                    executionResponse.status === 200
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-rose-500/20 text-rose-300'
                  }`}
                >
                  {executionResponse.status === 200 ? 'SUCCESS' : 'REJECTED / ERROR'}
                </span>
              </div>
              <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-[11px] text-slate-300 max-h-48 overflow-y-auto">
                <code>{JSON.stringify(executionResponse.data, null, 2)}</code>
              </pre>
            </div>
          )}
        </div>

        {/* Right: AST Complexity Analysis Report */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-mono text-slate-300 uppercase tracking-wide">
              Real-Time Complexity Diagnostics
            </span>
            {analysis && (
              <span className="text-[11px] font-mono text-slate-400">
                Linter compute time: <span className="text-cyan-400 font-semibold">{analysis.durationMs?.toFixed(2)}ms</span>
              </span>
            )}
          </div>

          {analysis ? (
            <div className="space-y-5">
              {/* Status Alert Banner */}
              {analysis.isBlocked ? (
                <div className="bg-rose-950/20 border border-rose-800/40 rounded-lg p-4 flex items-start space-x-3">
                  <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <div className="font-semibold text-rose-200">Query Blocked by Proxy Guard</div>
                    {analysis.violations?.map((v: any, i: number) => (
                      <div key={i} className="text-rose-300 font-mono text-[11px]">
                        • {v.message}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-lg p-4 flex items-center space-x-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div className="text-xs text-emerald-300 font-medium">
                    Query complexity and depth are within allowed limits. Safe to execute.
                  </div>
                </div>
              )}

              {/* Gauge Counters */}
              <div className="grid grid-cols-3 gap-3 font-mono">
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                  <span className="text-[10px] text-slate-400 uppercase block">Complexity Score</span>
                  <div className="text-lg font-bold text-cyan-400 mt-1">
                    {analysis.complexity} <span className="text-xs font-normal text-slate-400">pts</span>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                  <span className="text-[10px] text-slate-400 uppercase block">Nesting Depth</span>
                  <div className="text-lg font-bold text-slate-200 mt-1">
                    {analysis.depth} <span className="text-xs font-normal text-slate-400">levels</span>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                  <span className="text-[10px] text-slate-400 uppercase block">AST Nodes</span>
                  <div className="text-lg font-bold text-indigo-400 mt-1">
                    {analysis.nodeCount}
                  </div>
                </div>
              </div>

              {/* Cyclic paths alert */}
              {analysis.cyclicPaths && analysis.cyclicPaths.length > 0 && (
                <div className="bg-amber-950/20 border border-amber-800/50 rounded-lg p-3 text-xs">
                  <div className="font-semibold text-amber-300 flex items-center space-x-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Cyclic Recursion Paths Detected:</span>
                  </div>
                  <ul className="mt-1 font-mono text-[11px] text-amber-200/90 list-disc list-inside">
                    {analysis.cyclicPaths.map((cp: string, i: number) => (
                      <li key={i}>{cp}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Node-by-node cost breakdown */}
              {analysis.fieldBreakdown && analysis.fieldBreakdown.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-300 block">
                    AST Field Cost Breakdown
                  </span>
                  <div className="bg-slate-950 border border-slate-800 rounded-lg max-h-56 overflow-y-auto">
                    <table className="w-full text-left text-[11px] font-mono">
                      <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 sticky top-0">
                        <tr>
                          <th className="py-2 px-3">Field Path</th>
                          <th className="py-2 px-2 text-center">Depth</th>
                          <th className="py-2 px-2 text-center">Base</th>
                          <th className="py-2 px-2 text-center">Mult</th>
                          <th className="py-2 px-3 text-right">Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {analysis.fieldBreakdown.map((f: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-900/50">
                            <td className="py-1.5 px-3 text-cyan-300 font-medium">
                              {f.path} {f.isList && <span className="text-amber-400 font-normal">[list]</span>}
                            </td>
                            <td className="py-1.5 px-2 text-center text-slate-400">{f.depth}</td>
                            <td className="py-1.5 px-2 text-center text-slate-400">{f.cost}</td>
                            <td className="py-1.5 px-2 text-center text-slate-400">{f.multiplier}x</td>
                            <td className="py-1.5 px-3 text-right font-bold text-slate-100">{f.effectiveCost}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 text-xs">
              Click &quot;Lint AST&quot; or &quot;Run Query&quot; to evaluate complexity.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
