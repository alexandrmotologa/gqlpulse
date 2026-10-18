import { QueryComplexityConfig, DEFAULT_COMPLEXITY_CONFIG } from '@gqlpulse/core';

export interface GQLPulseProxyConfig {
  /** Target GraphQL backend URL (default: http://localhost:4001/graphql) */
  targetUrl: string;
  /** Port where the GQLPulse proxy listens (default: 4000) */
  port: number;
  /** Path for the proxy GraphQL endpoint (default: /graphql) */
  graphqlPath: string;
  /** Path for the Studio dashboard (default: /studio) */
  studioPath: string;
  /** Whether to serve the web Studio dashboard (default: true) */
  enableStudio: boolean;
  /** Sliding window for complexity rate limiting in milliseconds (default: 60000 = 1 min) */
  rateLimitWindowMs: number;
  /** Max complexity budget allowed per client per sliding window (default: 10000) */
  rateLimitMaxBudget: number;
  /** Complexity and depth rules */
  complexity: QueryComplexityConfig;
}

export const DEFAULT_PROXY_CONFIG: GQLPulseProxyConfig = {
  targetUrl: 'http://localhost:4001/graphql',
  port: 4000,
  graphqlPath: '/graphql',
  studioPath: '/studio',
  enableStudio: true,
  rateLimitWindowMs: 60000,
  rateLimitMaxBudget: 10000,
  complexity: {
    ...DEFAULT_COMPLEXITY_CONFIG,
    maxComplexity: 250,
    maxDepth: 8,
    defaultListMultiplier: 10,
    blockIntrospection: false,
    dryRun: false,
  },
};
