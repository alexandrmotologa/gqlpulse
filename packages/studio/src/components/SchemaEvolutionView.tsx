import React, { useState, useEffect } from 'react';
import { GitBranch, ShieldAlert, AlertTriangle, CheckCircle2, RefreshCw, Eye, ArrowRight, Ban, AlertOctagon } from 'lucide-react';
import { SchemaDiffResult, DeprecatedFieldUsage } from '../types.js';

export const SchemaEvolutionView: React.FC = () => {
  const SAMPLE_V1 = `type User {
  id: ID!
  username: String!
  email: String!
  displayName: String!
  bio: String
  role: String!
  legacyToken: String
  posts(limit: Int): [Post!]!
}

type Post {
  id: ID!
  title: String!
  slug: String!
  content: String!
  author: User!
}

type Query {
  users(first: Int): [User!]!
  user(id: ID!): User
  posts(first: Int): [Post!]!
}`;

  const SAMPLE_V2 = `type User {
  id: ID!
  username: String!
  email: String!
  displayName: String!
  bio: String @deprecated(reason: "Use profileBio instead for rich markdown format")
  profileBio: String
  role: String!
  posts(limit: Int): [Post!]!
}

type Post {
  id: ID!
  title: String!
  slug: String!
  content: String!
  author: User!
}

type Query {
  users(first: Int): [User!]!
  user(id: ID!): User
  posts(first: Int, search: String): [Post!]!
  searchOrders(status: String!): [String!]!
}`;

  const [oldSchema, setOldSchema] = useState(SAMPLE_V1);
  const [newSchema, setNewSchema] = useState(SAMPLE_V2);
  const [diffResult, setDiffResult] = useState<SchemaDiffResult | null>(null);
  const [deprecations, setDeprecations] = useState<{
    knownDeprecated: Array<{ fieldPath: string; reason: string }>;
    usageStats: DeprecatedFieldUsage[];
  } | null>(null);
  const [diffing, setDiffing] = useState(false);

  const handleDiff = async () => {
    setDiffing(true);
    try {
      const res = await fetch('/api/diff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldSchema, newSchema }),
      });
      const data = await res.json();
      setDiffResult(data);
    } catch {
      // Ignore
    } finally {
      setDiffing(false);
    }
  };

  const fetchDeprecations = async () => {
    try {
      const res = await fetch('/api/deprecations');
      if (res.ok) {
        const data = await res.json();
        setDeprecations(data);
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    handleDiff();
    fetchDeprecations();
    const interval = setInterval(fetchDeprecations, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <GitBranch className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100">Schema Evolution & Breaking Change Diff Studio</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Compare GraphQL schema revisions, safeguard legacy mobile clients, and track live @deprecated field traffic
            </p>
          </div>
        </div>

        <button
          onClick={handleDiff}
          disabled={diffing}
          className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-mono font-bold transition shadow-lg shadow-cyan-500/20"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${diffing ? 'animate-spin' : ''}`} />
          <span>Compare Revisions</span>
        </button>
      </div>

      {/* Diff Result Cards */}
      {diffResult && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono">
            <div className="bg-rose-950/20 border border-rose-800/40 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-rose-300 font-semibold uppercase">Breaking Changes</span>
                <ShieldAlert className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-2xl font-bold text-rose-400 mt-1">{diffResult.breakingCount}</div>
              <p className="text-[11px] text-slate-400 mt-1">May crash existing mobile & web consumers</p>
            </div>

            <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-amber-300 font-semibold uppercase">Dangerous Notices</span>
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-amber-400 mt-1">{diffResult.dangerousCount}</div>
              <p className="text-[11px] text-slate-400 mt-1">Deprecations & potential behavioral changes</p>
            </div>

            <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-emerald-300 font-semibold uppercase">Safe Additions</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">{diffResult.safeCount}</div>
              <p className="text-[11px] text-slate-400 mt-1">Non-breaking optional fields & types</p>
            </div>
          </div>

          {/* Change Items Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <span className="text-xs font-bold font-mono text-slate-300 uppercase">
                Detailed AST Evolution Diff ({diffResult.items.length} items)
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4">Severity</th>
                    <th className="py-2.5 px-4">Change Code</th>
                    <th className="py-2.5 px-4">Schema Path</th>
                    <th className="py-2.5 px-4">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {diffResult.items.map((item, idx) => {
                    let badgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                    if (item.category === 'BREAKING') badgeClass = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
                    else if (item.category === 'DANGEROUS') badgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/30';

                    return (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass}`}>
                            {item.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-400 text-[11px] font-semibold">{item.code}</td>
                        <td className="py-2.5 px-4 text-cyan-300 font-medium">{item.path}</td>
                        <td className="py-2.5 px-4 text-slate-300">{item.description}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Real-World Client Traffic Impact Analysis */}
          {diffResult.impacts && diffResult.impacts.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 bg-rose-950/30 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <AlertOctagon className="w-4 h-4 text-rose-400" />
                  <span className="text-xs font-bold font-mono text-rose-200 uppercase">
                    Client Traffic Impact Correlation (Production Telemetry)
                  </span>
                </div>
                <span className="text-[11px] font-mono text-rose-300">
                  Cross-referenced against real queries in proxy memory
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4">Impact Level</th>
                      <th className="py-2.5 px-4">Schema Path</th>
                      <th className="py-2.5 px-4">Change Type</th>
                      <th className="py-2.5 px-4 text-center">Hits in Session</th>
                      <th className="py-2.5 px-4 text-center">Affected Clients</th>
                      <th className="py-2.5 px-4">Sample Operations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {diffResult.impacts.map((imp, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              imp.severity === 'HIGH_IMPACT'
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                : imp.severity === 'LOW_IMPACT'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            {imp.severity}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-cyan-300 font-bold">{imp.schemaPath}</td>
                        <td className="py-2.5 px-4 text-slate-400">{imp.changeCode}</td>
                        <td className="py-2.5 px-4 text-center font-bold text-slate-100">
                          {imp.totalHitsInSession}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <span className="text-rose-400 font-bold">{imp.distinctClientsCount}</span>
                          {imp.sampleClients.length > 0 && (
                            <span className="text-slate-500 text-[10px] ml-1">
                              ({imp.sampleClients.join(', ')})
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-slate-300 truncate max-w-xs">
                          {imp.sampleOperations.length > 0
                            ? imp.sampleOperations.join(', ')
                            : 'Anonymous queries'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Live Deprecation Usage Tracker */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden space-y-3 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Ban className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold font-mono text-slate-200 uppercase">
              Live @deprecated Field Traffic Monitor
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Intercepts incoming query ASTs in real time
          </span>
        </div>

        {deprecations && deprecations.knownDeprecated.length > 0 ? (
          <div className="border border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[11px]">
                <tr>
                  <th className="py-2 px-4">Field Path</th>
                  <th className="py-2 px-4">Deprecation Reason</th>
                  <th className="py-2 px-3 text-center">Hit Count</th>
                  <th className="py-2 px-4 text-right">Migration Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {deprecations.knownDeprecated.map((dep, idx) => {
                  const stat = deprecations.usageStats.find((s) => s.fieldPath === dep.fieldPath);
                  const hits = stat?.hitCount || 0;

                  return (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-4 text-amber-300 font-semibold">{dep.fieldPath}</td>
                      <td className="py-2.5 px-4 text-slate-400 text-[11px]">{dep.reason}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-100">{hits}</td>
                      <td className="py-2.5 px-4 text-right">
                        {hits > 0 ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            Active Traffic (DO NOT REMOVE)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            0 Hits (Safe to Decommission)
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-6 text-slate-500 text-xs">
            No fields with @deprecated found in current schema.
          </div>
        )}
      </div>

      {/* Side-by-side Schema Editors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-mono text-slate-300 uppercase">
              Baseline Schema (v1)
            </span>
          </div>
          <textarea
            value={oldSchema}
            onChange={(e) => setOldSchema(e.target.value)}
            rows={12}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs text-slate-300 focus:outline-none focus:border-cyan-500/60 leading-relaxed resize-y"
          />
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-mono text-slate-300 uppercase">
              New Candidate Schema (v2)
            </span>
          </div>
          <textarea
            value={newSchema}
            onChange={(e) => setNewSchema(e.target.value)}
            rows={12}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs text-slate-300 focus:outline-none focus:border-cyan-500/60 leading-relaxed resize-y"
          />
        </div>
      </div>
    </div>
  );
};
