import React, { useState } from 'react';
import { useProxyEvents } from './hooks/useProxyEvents.js';
import { Header } from './components/Header.js';
import { LiveMonitor } from './components/LiveMonitor.js';
import { FlamegraphView } from './components/FlamegraphView.js';
import { LinterSandbox } from './components/LinterSandbox.js';
import { SchemaEvolutionView } from './components/SchemaEvolutionView.js';
import { RulesConfigView } from './components/RulesConfigView.js';
import { TraceDrawer } from './components/TraceDrawer.js';
import { DataLoaderModal } from './components/DataLoaderModal.js';
import { WaterfallTrace, NPlusOneAlert } from './types.js';

export function App() {
  const [activeTab, setActiveTab] = useState<'monitor' | 'flamegraph' | 'linter' | 'schema' | 'rules'>('monitor');
  const [selectedTrace, setSelectedTrace] = useState<WaterfallTrace | null>(null);
  const [activeDataLoaderAlert, setActiveDataLoaderAlert] = useState<NPlusOneAlert | null>(null);

  const { traces, metrics, isConnected } = useProxyEvents();

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
    </div>
  );
}
export default App;
