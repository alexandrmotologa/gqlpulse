import React from 'react';
import { Activity, ShieldAlert, Cpu, GitBranch, Settings, Layers, Flame, Zap } from 'lucide-react';
import { ProxyMetrics } from '../types.js';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  metrics: ProxyMetrics | null;
  isConnected: boolean;
  totalTraces: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  metrics,
  isConnected,
  totalTraces,
}) => {
  const tabs = [
    { id: 'monitor', label: 'Live Monitor', icon: Activity, badge: totalTraces > 0 ? totalTraces : undefined },
    { id: 'flamegraph', label: 'Resolver Flamegraph & N+1', icon: Flame, badge: metrics?.nPlusOneAlertCount ? `${metrics.nPlusOneAlertCount}` : undefined },
    { id: 'linter', label: 'Complexity Linter', icon: Zap },
    { id: 'schema', label: 'Schema Evolution & Diff', icon: GitBranch },
    { id: 'rules', label: 'Security & Rules', icon: Settings },
  ];

  return (
    <header className="border-b border-slate-800 bg-[#0d131f]/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Product Name */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-600 to-indigo-500 p-0.5 shadow-lg shadow-cyan-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[7px] flex items-center justify-center">
                <Activity className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-white font-mono">GQLPULSE</span>
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60 font-semibold">
                  Studio
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono hidden sm:block">
                GraphQL AST Complexity Linter & N+1 Profiler
              </p>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="hidden md:flex items-center space-x-4">
            <div className="flex items-center space-x-1.5 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-md text-xs font-mono">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-slate-400">Proxy:</span>
              <span className="text-slate-200 font-semibold">:4000</span>
            </div>

            <div className="flex items-center space-x-2 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-md text-xs font-mono">
              <span className="text-slate-400">Queries:</span>
              <span className="text-cyan-400 font-bold">{metrics?.totalQueries || 0}</span>
            </div>

            <div className="flex items-center space-x-2 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-md text-xs font-mono">
              <span className="text-slate-400">Avg Latency:</span>
              <span className="text-slate-200 font-semibold">{metrics?.avgLatencyMs || 0}ms</span>
            </div>

            {metrics && metrics.nPlusOneAlertCount > 0 && (
              <div className="flex items-center space-x-1.5 bg-amber-950/40 border border-amber-800/60 px-3 py-1.5 rounded-md text-xs font-mono text-amber-400">
                <Flame className="w-3.5 h-3.5" />
                <span>N+1: {metrics.nPlusOneAlertCount}</span>
              </div>
            )}

            {metrics && metrics.blockedQueries > 0 && (
              <div className="flex items-center space-x-1.5 bg-rose-950/40 border border-rose-800/60 px-3 py-1.5 rounded-md text-xs font-mono text-rose-400">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Blocked: {metrics.blockedQueries}</span>
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 overflow-x-auto pb-0 -mb-px">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-2.5 px-3.5 border-b-2 font-medium text-xs whitespace-nowrap transition-all duration-150 ${
                  isActive
                    ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-semibold ${
                      isActive ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
