import React, { useState, useEffect } from 'react';
import { Search, Activity, Flame, Zap, GitBranch, Settings, Play, X, Sparkles } from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: string) => void;
  onExecuteSample: (query: string) => void;
  onOpenSimulator: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onExecuteSample,
  onOpenSimulator,
}) => {
  const [search, setSearch] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else onClose(); // parent handles toggle
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const actions = [
    {
      id: 'tab-monitor',
      category: 'Navigation',
      label: 'Switch to Live Monitor',
      icon: Activity,
      action: () => {
        onNavigateTab('monitor');
        onClose();
      },
    },
    {
      id: 'tab-flamegraph',
      category: 'Navigation',
      label: 'Switch to Resolver Flamegraph & N+1',
      icon: Flame,
      action: () => {
        onNavigateTab('flamegraph');
        onClose();
      },
    },
    {
      id: 'tab-linter',
      category: 'Navigation',
      label: 'Switch to Complexity Linter & Sandbox',
      icon: Zap,
      action: () => {
        onNavigateTab('linter');
        onClose();
      },
    },
    {
      id: 'tab-schema',
      category: 'Navigation',
      label: 'Switch to Schema Evolution & Diff',
      icon: GitBranch,
      action: () => {
        onNavigateTab('schema');
        onClose();
      },
    },
    {
      id: 'tab-rules',
      category: 'Navigation',
      label: 'Switch to Security & Rules Config',
      icon: Settings,
      action: () => {
        onNavigateTab('rules');
        onClose();
      },
    },
    {
      id: 'action-simulate',
      category: 'DataLoader',
      label: 'Open DataLoader Before vs After Simulator',
      icon: Sparkles,
      action: () => {
        onOpenSimulator();
        onClose();
      },
    },
    {
      id: 'query-n1',
      category: 'Test Queries',
      label: 'Execute N+1 Cascade Query (Posts & Authors)',
      icon: Play,
      action: () => {
        onExecuteSample(`query CascadePosts { posts(first: 6) { id title author { id displayName } } }`);
        onClose();
      },
    },
    {
      id: 'query-dos',
      category: 'Test Queries',
      label: 'Execute Deep DoS Query (Triggers Blocker)',
      icon: Play,
      action: () => {
        onExecuteSample(`query DeepAttack { users { posts { comments { author { posts { id } } } } } }`);
        onClose();
      },
    },
    {
      id: 'query-normal',
      category: 'Test Queries',
      label: 'Execute Normal Low-Complexity Query',
      icon: Play,
      action: () => {
        onExecuteSample(`query GetUsers { users(first: 5) { id displayName email } }`);
        onClose();
      },
    },
  ];

  const filtered = actions.filter(
    (a) =>
      a.label.toLowerCase().includes(search.toLowerCase()) ||
      a.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col">
        {/* Search Input Bar */}
        <div className="px-4 py-3 border-b border-slate-800 flex items-center space-x-3 bg-slate-950/60">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type a command, query, or tab... (Esc to close)"
            className="w-full bg-transparent text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Results */}
        <div className="p-2 max-h-80 overflow-y-auto space-y-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs font-mono text-slate-500">
              No matching commands or actions found.
            </div>
          ) : (
            filtered.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-200 transition group"
                >
                  <div className="flex items-center space-x-3">
                    <Icon className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition" />
                    <span>{item.label}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 uppercase">{item.category}</span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 border-t border-slate-800 bg-slate-950 text-[10px] font-mono text-slate-500 flex justify-between items-center">
          <span>Navigate with mouse or keyboard</span>
          <span>Shortcut: <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">Ctrl+K</kbd></span>
        </div>
      </div>
    </div>
  );
};
