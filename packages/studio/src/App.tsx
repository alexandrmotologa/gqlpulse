import React, { useState, useEffect } from 'react';
import { useProxyEvents } from './hooks/useProxyEvents.js';
import { Header } from './components/Header.js';
import { LiveMonitor } from './components/LiveMonitor.js';
import { FlamegraphView } from './components/FlamegraphView.js';
import { LinterSandbox } from './components/LinterSandbox.js';
import { SchemaEvolutionView } from './components/SchemaEvolutionView.js';
import { RulesConfigView } from './components/RulesConfigView.js';
import { TraceDrawer } from './components/TraceDrawer.js';
import { DataLoaderModal } from './components/DataLoaderModal.js';
import { DataLoaderSimulatorModal } from './components/DataLoaderSimulatorModal.js';
import { CommandPalette } from './components/CommandPalette.js';
import { WaterfallTrace, NPlusOneAlert } from './types.js';

export function App() {
  const [activeTab, setActiveTab] = useState<'monitor' | 'flamegraph' | 'linter' | 'schema' | 'rules'>('monitor');
  const [selectedTrace, setSelectedTrace] = useState<WaterfallTrace | null>(null);
  const [activeDataLoaderAlert, setActiveDataLoaderAlert] = useState<NPlusOneAlert | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [simulatorQuery, setSimulatorQuery] = useState<string | undefined>(undefined);

  const { traces, metrics, isConnected } = useProxyEvents();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleExecuteSample = async (query: string) => {
    try {
      await fetch('/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
    } catch {
      // Handled via SSE broadcast
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col font-sans">
      {/* Studio Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={(t) => setActiveTab(t as any)}
        metrics={metrics}
        isConnected={isConnected}
        totalTraces={traces.length}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
      />

      {/* Main Tab Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'monitor' && (
          <LiveMonitor
            traces={traces}
            onSelectTrace={setSelectedTrace}
            onOpenDataLoaderModal={setActiveDataLoaderAlert}
            onExecuteSample={handleExecuteSample}
          />
        )}

        {activeTab === 'flamegraph' && (
          <FlamegraphView
            traces={traces}
            onOpenDataLoaderModal={setActiveDataLoaderAlert}
            onOpenSimulatorModal={(q) => {
              setSimulatorQuery(q);
              setIsSimulatorOpen(true);
            }}
          />
        )}

        {activeTab === 'linter' && <LinterSandbox />}

        {activeTab === 'schema' && <SchemaEvolutionView />}

        {activeTab === 'rules' && <RulesConfigView />}
      </main>

      {/* Trace Details Drawer */}
      <TraceDrawer
        trace={selectedTrace}
        onClose={() => setSelectedTrace(null)}
        onOpenDataLoaderModal={(alert) => {
          setSelectedTrace(null);
          setActiveDataLoaderAlert(alert);
        }}
      />

      {/* DataLoader Fix Modal */}
      <DataLoaderModal
        alert={activeDataLoaderAlert}
        onClose={() => setActiveDataLoaderAlert(null)}
      />

      {/* DataLoader Simulator (Before vs After) Modal */}
      <DataLoaderSimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        initialQuery={simulatorQuery}
        onOpenFixSnippet={(sig) => {
          setIsSimulatorOpen(false);
          // Find or create dummy alert to open snippet
          setActiveDataLoaderAlert({
            id: 'sim-' + Date.now(),
            parentType: sig.split('.')[0] || 'Type',
            fieldName: sig.split('.')[1] || 'field',
            signature: sig,
            occurrences: 5,
            parentCount: 5,
            totalDurationUs: 25000,
            averageDurationUs: 5000,
            severity: 'CRITICAL',
            message: `Batching simulated for ${sig}`,
            dataLoaderSnippet: `// Batch loader for ${sig}\nconst loader = new DataLoader(async (ids) => batchFetch(ids));`,
            resolverFixSnippet: `// Resolver fix\nreturn context.loaders.${sig.split('.')[1] || 'item'}Loader.load(parent.id);`,
          });
        }}
      />

      {/* Command Palette (Ctrl+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigateTab={(tab) => setActiveTab(tab as any)}
        onExecuteSample={handleExecuteSample}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
      />
    </div>
  );
}
export default App;
