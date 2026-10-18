export interface ResolverSpan {
  path: (string | number)[];
  parentType: string;
  fieldName: string;
  returnType: string;
  startOffsetUs: number;
  durationUs: number;
  selfTimeUs: number;
}

export interface NPlusOneAlert {
  id: string;
  parentType: string;
  fieldName: string;
  signature: string;
  occurrences: number;
  parentCount: number;
  totalDurationUs: number;
  averageDurationUs: number;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  message: string;
  dataLoaderSnippet: string;
  resolverFixSnippet: string;
}

export interface WaterfallTrace {
  id: string;
  operationName?: string;
  query: string;
  variables?: Record<string, unknown>;
  timestamp: number;
  totalDurationMs: number;
  spans: ResolverSpan[];
  nPlusOneAlerts: NPlusOneAlert[];
  complexity: number;
  depth: number;
  status: 'SUCCESS' | 'BLOCKED' | 'ERROR';
  errorMessage?: string;
  clientIp?: string;
}

export interface ProxyMetrics {
  totalQueries: number;
  blockedQueries: number;
  nPlusOneAlertCount: number;
  totalDurationMs: number;
  avgLatencyMs: number;
  totalComplexity: number;
  avgComplexity: number;
  activeSseClients: number;
  uptimeSeconds: number;
  startedAt: number;
}

export interface QueryComplexityConfig {
  scalarCost: number;
  objectCost: number;
  defaultListMultiplier: number;
  listArgumentNames: string[];
  maxDepth: number;
  maxComplexity: number;
  fieldCosts: Record<string, number>;
  fieldMultipliers: Record<string, string>;
  directiveName: string;
  blockIntrospection: boolean;
  dryRun: boolean;
  apq?: APQConfig;
  maskingRules?: MaskingRule[];
}

export interface SchemaDiffItem {
  category: 'BREAKING' | 'DANGEROUS' | 'SAFE';
  code: string;
  path: string;
  description: string;
  oldValue?: string;
  newValue?: string;
}

export interface ClientTrafficImpact {
  schemaPath: string;
  changeCode: string;
  totalHitsInSession: number;
  distinctClientsCount: number;
  sampleClients: string[];
  sampleOperations: string[];
  severity: 'HIGH_IMPACT' | 'LOW_IMPACT' | 'NO_IMPACT';
}

export interface SchemaDiffResult {
  items: SchemaDiffItem[];
  breakingCount: number;
  dangerousCount: number;
  safeCount: number;
  hasBreakingChanges: boolean;
  timestamp: number;
  impacts?: ClientTrafficImpact[];
}

export interface ComparisonSimulationResult {
  query: string;
  unbatched: {
    durationMs: number;
    dbQueriesEstimated: number;
    spansCount: number;
    nPlusOneCascades: number;
    spans: ResolverSpan[];
  };
  batched: {
    durationMs: number;
    dbQueriesEstimated: number;
    spansCount: number;
    nPlusOneCascades: number;
    spans: ResolverSpan[];
  };
  latencyReductionPercent: number;
  dbQueriesSavedPercent: number;
}

export interface MaskingRule {
  fieldPattern: string;
  strategy: 'REDACT' | 'PARTIAL_EMAIL' | 'HASH' | 'NULL';
}

export interface APQConfig {
  enabled: boolean;
  strictSafelist: boolean;
}

export interface DeprecatedFieldUsage {
  fieldPath: string;
  reason: string;
  hitCount: number;
  lastSeenTimestamp: number;
  clients: string[];
}
