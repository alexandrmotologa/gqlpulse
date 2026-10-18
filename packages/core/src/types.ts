/**
 * GQLPulse Core Type Definitions
 */

export interface QueryComplexityConfig {
  /** Cost assigned to leaf scalar fields (default: 1) */
  scalarCost: number;
  /** Cost assigned to object composite fields (default: 2) */
  objectCost: number;
  /** Multiplier applied to list fields when no explicit pagination argument is found (default: 10) */
  defaultListMultiplier: number;
  /** Argument names inspected for list slicing (e.g. ['first', 'limit', 'count', 'last']) */
  listArgumentNames: string[];
  /** Maximum nesting depth allowed before a query is rejected (default: 10) */
  maxDepth: number;
  /** Maximum total complexity score allowed before a query is rejected (default: 250) */
  maxComplexity: number;
  /** Specific cost overrides by type and field name, e.g. { 'Query.users': 5, 'User.orders': 15 } */
  fieldCosts: Record<string, number>;
  /** Field-specific multiplier argument overrides, e.g. { 'Query.search': 'limit' } */
  fieldMultipliers: Record<string, string>;
  /** Name of the GraphQL directive used for static complexity annotations in schema (default: 'complexity') */
  directiveName: string;
  /** Whether to block GraphQL introspection queries (__schema, __type) in production */
  blockIntrospection: boolean;
  /** Enable or disable blocking mode (if false, queries are audited and tagged without being rejected) */
  dryRun: boolean;
}

export interface FieldCostNode {
  path: string;
  fieldName: string;
  parentType: string;
  cost: number;
  multiplier: number;
  effectiveCost: number;
  depth: number;
  isList: boolean;
}

export interface ComplexityViolation {
  type: 'MAX_COMPLEXITY' | 'MAX_DEPTH' | 'CYCLIC_QUERY' | 'INTROSPECTION_BLOCKED';
  message: string;
  value: number;
  limit: number;
}

export interface ComplexityAnalysisResult {
  complexity: number;
  depth: number;
  nodeCount: number;
  fieldBreakdown: FieldCostNode[];
  cyclicPaths: string[];
  isIntrospection: boolean;
  isBlocked: boolean;
  violations: ComplexityViolation[];
  durationMs: number;
}

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
  signature: string; // e.g. 'Post.author'
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

export type DiffChangeCategory = 'BREAKING' | 'DANGEROUS' | 'SAFE';

export interface SchemaDiffItem {
  category: DiffChangeCategory;
  code: string;
  path: string;
  description: string;
  oldValue?: string;
  newValue?: string;
}

export interface SchemaDiffResult {
  items: SchemaDiffItem[];
  breakingCount: number;
  dangerousCount: number;
  safeCount: number;
  hasBreakingChanges: boolean;
  timestamp: number;
}

export interface MaskingRule {
  fieldPattern: string; // e.g. 'email', 'legacyToken', 'password'
  strategy: 'REDACT' | 'PARTIAL_EMAIL' | 'HASH' | 'NULL';
}

export interface APQConfig {
  enabled: boolean;
  strictSafelist: boolean;
}

export interface ClientTrafficImpact {
  schemaPath: string; // e.g. 'User.legacyToken'
  changeCode: string;
  totalHitsInSession: number;
  distinctClientsCount: number;
  sampleClients: string[];
  sampleOperations: string[];
  severity: 'HIGH_IMPACT' | 'LOW_IMPACT' | 'NO_IMPACT';
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

export interface DeprecatedFieldUsage {
  fieldPath: string; // e.g. 'User.oldBio'
  reason: string;
  hitCount: number;
  lastSeenTimestamp: number;
  clients: string[];
}

