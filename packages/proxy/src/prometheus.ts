import { ProxyMetrics } from './proxy-server.js';

export function formatPrometheusMetrics(metrics: ProxyMetrics): string {
  const lines: string[] = [
    '# HELP gqlpulse_queries_total Total number of GraphQL queries intercepted by GQLPulse',
    '# TYPE gqlpulse_queries_total counter',
    `gqlpulse_queries_total ${metrics.totalQueries}`,
    '',
    '# HELP gqlpulse_blocked_queries_total Total queries rejected by complexity, depth, or rate limits',
    '# TYPE gqlpulse_blocked_queries_total counter',
    `gqlpulse_blocked_queries_total ${metrics.blockedQueries}`,
    '',
    '# HELP gqlpulse_n_plus_one_cascades_total Total detected unbatched N+1 resolver cascades',
    '# TYPE gqlpulse_n_plus_one_cascades_total counter',
    `gqlpulse_n_plus_one_cascades_total ${metrics.nPlusOneAlertCount}`,
    '',
    '# HELP gqlpulse_avg_latency_ms Average query response latency in milliseconds',
    '# TYPE gqlpulse_avg_latency_ms gauge',
    `gqlpulse_avg_latency_ms ${metrics.avgLatencyMs}`,
    '',
    '# HELP gqlpulse_avg_complexity_score Average AST complexity score across processed queries',
    '# TYPE gqlpulse_avg_complexity_score gauge',
    `gqlpulse_avg_complexity_score ${metrics.avgComplexity}`,
    '',
    '# HELP gqlpulse_active_sse_clients Number of active Server-Sent Events subscribers',
    '# TYPE gqlpulse_active_sse_clients gauge',
    `gqlpulse_active_sse_clients ${metrics.activeSseClients}`,
    '',
    '# HELP gqlpulse_uptime_seconds Proxy operational uptime in seconds',
    '# TYPE gqlpulse_uptime_seconds gauge',
    `gqlpulse_uptime_seconds ${metrics.uptimeSeconds}`,
    '',
  ];

  return lines.join('\n');
}
