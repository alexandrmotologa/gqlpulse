import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {
  QueryComplexityCalculator,
  ResolverProfiler,
  SchemaDiffEngine,
  DeprecationTracker,
  SchemaImpactAnalyzer,
  ResponseDataMasker,
  WaterfallTrace,
  ResolverSpan,
  QueryComplexityConfig,
  ComparisonSimulationResult,
} from '@gqlpulse/core';
import { GQLPulseProxyConfig, DEFAULT_PROXY_CONFIG } from './config.js';
import { ComplexityRateLimiter } from './rate-limiter.js';
import { formatPrometheusMetrics } from './prometheus.js';
import { PersistedQueryManager } from './apq.js';
import { buildSchema, GraphQLSchema } from 'graphql';

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

export class GQLPulseProxyServer {
  private config: GQLPulseProxyConfig;
  private server?: http.Server;
  private calculator: QueryComplexityCalculator;
  private profiler: ResolverProfiler;
  private diffEngine: SchemaDiffEngine;
  private deprecationTracker: DeprecationTracker;
  private impactAnalyzer: SchemaImpactAnalyzer;
  private rateLimiter: ComplexityRateLimiter;
  private apqManager: PersistedQueryManager;
  private masker: ResponseDataMasker;
  private schema?: GraphQLSchema;

  private traces: WaterfallTrace[] = [];
  private readonly maxTraces = 300;
  private sseClients: Set<http.ServerResponse> = new Set();
  private startedAt = Date.now();

  private metrics: ProxyMetrics = {
    totalQueries: 0,
    blockedQueries: 0,
    nPlusOneAlertCount: 0,
    totalDurationMs: 0,
    avgLatencyMs: 0,
    totalComplexity: 0,
    avgComplexity: 0,
    activeSseClients: 0,
    uptimeSeconds: 0,
    startedAt: this.startedAt,
  };

  constructor(customConfig: Partial<GQLPulseProxyConfig> = {}, initialSchema?: string | GraphQLSchema) {
    this.config = {
      ...DEFAULT_PROXY_CONFIG,
      ...customConfig,
      apq: { ...DEFAULT_PROXY_CONFIG.apq, ...(customConfig.apq || {}) },
      maskingRules: customConfig.maskingRules || DEFAULT_PROXY_CONFIG.maskingRules,
      complexity: { ...DEFAULT_PROXY_CONFIG.complexity, ...(customConfig.complexity || {}) },
    };

    if (initialSchema) {
      this.schema = typeof initialSchema === 'string' ? buildSchema(initialSchema) : initialSchema;
    }

    this.calculator = new QueryComplexityCalculator(this.config.complexity, this.schema);
    this.profiler = new ResolverProfiler();
    this.diffEngine = new SchemaDiffEngine();
    this.deprecationTracker = new DeprecationTracker(this.schema);
    this.impactAnalyzer = new SchemaImpactAnalyzer();
    this.rateLimiter = new ComplexityRateLimiter(this.config.rateLimitWindowMs, this.config.rateLimitMaxBudget);
    this.apqManager = new PersistedQueryManager(this.config.apq.enabled, this.config.apq.strictSafelist);
    this.masker = new ResponseDataMasker(this.config.maskingRules);
  }

  public setSchema(schemaOrStr: string | GraphQLSchema): void {
    this.schema = typeof schemaOrStr === 'string' ? buildSchema(schemaOrStr) : schemaOrStr;
    this.calculator.setSchema(this.schema);
    this.deprecationTracker.setSchema(this.schema);
  }

  public start(): Promise<http.Server> {
    return new Promise((resolve) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.listen(this.config.port, () => {
        console.log(`[gqlpulse] Reverse Proxy active on http://localhost:${this.config.port}${this.config.graphqlPath}`);
        console.log(`[gqlpulse] Studio Dashboard available on http://localhost:${this.config.port}${this.config.studioPath}`);
        console.log(`[gqlpulse] Prometheus Metrics available on http://localhost:${this.config.port}/metrics`);
        console.log(`[gqlpulse] Forwarding queries to upstream backend: ${this.config.targetUrl}`);
        resolve(this.server!);
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-gqlpulse-mode');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    // 1. Prometheus /metrics endpoint
    if (pathname === '/metrics' && req.method === 'GET') {
      this.metrics.uptimeSeconds = Math.round((Date.now() - this.startedAt) / 1000);
      res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' });
      res.end(formatPrometheusMetrics(this.metrics));
      return;
    }

    // 2. SSE Stream endpoint
    if (pathname === '/events') {
      this.handleSseStream(req, res);
      return;
    }

    // 3. REST API endpoints
    if (pathname.startsWith('/api/')) {
      this.handleApiRoute(pathname, req, res, url);
      return;
    }

    // 4. GraphQL Proxy endpoint
    if (pathname === this.config.graphqlPath) {
      this.handleGraphQLProxy(req, res, url);
      return;
    }

    // 5. Studio web dashboard & static assets
    if (
      pathname === this.config.studioPath ||
      pathname === '/' ||
      pathname.startsWith('/studio') ||
      pathname.startsWith('/assets') ||
      pathname.endsWith('.js') ||
      pathname.endsWith('.css') ||
      pathname.endsWith('.svg') ||
      pathname.endsWith('.png') ||
      pathname.endsWith('.ico')
    ) {
      this.handleStudioStatic(pathname, req, res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Not found: ${pathname}` }));
  }

  private handleSseStream(req: http.IncomingMessage, res: http.ServerResponse): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: Date.now() })}\n\n`);

    this.sseClients.add(res);
    this.metrics.activeSseClients = this.sseClients.size;

    req.on('close', () => {
      this.sseClients.delete(res);
      this.metrics.activeSseClients = this.sseClients.size;
    });
  }

  private broadcastEvent(type: string, payload: unknown): void {
    const data = `data: ${JSON.stringify({ type, payload, timestamp: Date.now() })}\n\n`;
    for (const client of this.sseClients) {
      client.write(data);
    }
  }

  private handleGraphQLProxy(req: http.IncomingMessage, res: http.ServerResponse, url: URL): void {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', async () => {
      const startTime = performance.now();
      const clientId = this.rateLimiter.extractClientId(req);

      try {
        let payload: {
          query?: string;
          variables?: Record<string, unknown>;
          operationName?: string;
          extensions?: { persistedQuery?: { sha256Hash?: string; version?: number } };
        } = {};

        if (req.method === 'POST') {
          payload = body ? JSON.parse(body) : {};
        } else if (req.method === 'GET') {
          payload = {
            query: url.searchParams.get('query') || undefined,
            variables: url.searchParams.get('variables') ? JSON.parse(url.searchParams.get('variables')!) : undefined,
            operationName: url.searchParams.get('operationName') || undefined,
            extensions: url.searchParams.get('extensions') ? JSON.parse(url.searchParams.get('extensions')!) : undefined,
          };
        }

        // --- STEP 1: AUTOMATIC PERSISTED QUERIES (APQ) PROCESSING ---
        const apqHash = payload.extensions?.persistedQuery?.sha256Hash;
        if (apqHash) {
          const apqResult = this.apqManager.processAPQ(apqHash, payload.query);
          if (apqResult.status === 'NOT_FOUND') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                errors: [
                  {
                    message: 'PersistedQueryNotFound',
                    extensions: { code: 'PERSISTED_QUERY_NOT_FOUND' },
                  },
                ],
              })
            );
            return;
          }

          if (apqResult.status === 'NOT_ALLOWED' || apqResult.status === 'INVALID_HASH') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                errors: [
                  {
                    message: apqResult.errorMessage || 'Query rejected by persisted query policy',
                    extensions: { code: 'PERSISTED_QUERY_VIOLATION' },
                  },
                ],
              })
            );
            return;
          }

          payload.query = apqResult.query;
        }

        if (!payload.query) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ errors: [{ message: 'No GraphQL query supplied' }] }));
          return;
        }

        // --- STEP 2: PRE-EXECUTION AST COMPLEXITY & DEPTH LINTING (<0.5ms) ---
        const analysis = this.calculator.analyze(payload.query, payload.variables);

        // Check rate limit budget
        const rateLimitResult = this.rateLimiter.checkAndRecord(clientId, analysis.complexity);

        // Attach rate limit headers
        res.setHeader('X-RateLimit-Limit-Complexity', String(rateLimitResult.maxBudget));
        res.setHeader('X-RateLimit-Remaining-Complexity', String(rateLimitResult.remainingBudget));
        res.setHeader('X-RateLimit-Reset-Ms', String(rateLimitResult.resetInMs));

        // Track deprecated fields
        if (this.schema) {
          try {
            const { parse } = await import('graphql');
            this.deprecationTracker.inspectQuery(parse(payload.query), clientId);
          } catch {
            // ignore syntax errors already caught
          }
        }

        // If query is blocked by complexity, depth, introspection, or rate budget
        if (analysis.isBlocked || !rateLimitResult.allowed) {
          this.metrics.totalQueries++;
          this.metrics.blockedQueries++;

          let errorMessage = 'Query execution rejected by GQLPulse security policy';
          let violations = [...analysis.violations];

          if (!rateLimitResult.allowed) {
            violations.push({
              type: 'MAX_COMPLEXITY',
              message: `Rate limit budget exceeded. Client has used ${rateLimitResult.currentTotal}/${rateLimitResult.maxBudget} points in the current window.`,
              value: rateLimitResult.currentTotal,
              limit: rateLimitResult.maxBudget,
            });
          }

          if (violations.length > 0) {
            errorMessage = violations.map((v) => v.message).join('; ');
          }

          const blockedTrace: WaterfallTrace = {
            id: `trace-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            operationName: payload.operationName,
            query: payload.query,
            variables: payload.variables,
            timestamp: Date.now(),
            totalDurationMs: performance.now() - startTime,
            spans: [],
            nPlusOneAlerts: [],
            complexity: analysis.complexity,
            depth: analysis.depth,
            status: 'BLOCKED',
            errorMessage,
            clientIp: clientId,
          };

          this.recordTrace(blockedTrace);
          this.broadcastEvent('QUERY_BLOCKED', blockedTrace);

          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              errors: [
                {
                  message: errorMessage,
                  extensions: {
                    code: 'GQLPULSE_QUERY_BLOCKED',
                    complexity: analysis.complexity,
                    depth: analysis.depth,
                    maxComplexity: this.config.complexity.maxComplexity,
                    maxDepth: this.config.complexity.maxDepth,
                    violations,
                    linterDurationMs: analysis.durationMs,
                  },
                },
              ],
            })
          );
          return;
        }

        // --- STEP 3: FORWARD TO TARGET BACKEND ---
        const targetUrlObj = new URL(this.config.targetUrl);
        const outPayloadStr = JSON.stringify(payload);
        const forwardHeaders: Record<string, any> = {
          ...req.headers,
          host: targetUrlObj.host,
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(outPayloadStr),
          'x-forwarded-for': clientId,
        };

        const proxyReq = http.request(
          {
            hostname: targetUrlObj.hostname,
            port: targetUrlObj.port || (targetUrlObj.protocol === 'https:' ? 443 : 80),
            path: targetUrlObj.pathname + targetUrlObj.search,
            method: req.method,
            headers: forwardHeaders,
          },
          (proxyRes) => {
            let upstreamBody = '';
            proxyRes.on('data', (c) => {
              upstreamBody += c;
            });

            proxyRes.on('end', () => {
              const totalDurationMs = performance.now() - startTime;
              this.metrics.totalQueries++;
              this.metrics.totalDurationMs += totalDurationMs;
              this.metrics.avgLatencyMs = Math.round((this.metrics.totalDurationMs / this.metrics.totalQueries) * 10) / 10;
              this.metrics.totalComplexity += analysis.complexity;
              this.metrics.avgComplexity = Math.round(this.metrics.totalComplexity / this.metrics.totalQueries);

              let spans: ResolverSpan[] = [];
              let nPlusOneAlerts: any[] = [];
              let parsedUpstream: any = null;

              try {
                parsedUpstream = JSON.parse(upstreamBody);

                // --- SENSITIVE DATA MASKING ---
                if (parsedUpstream.data && this.config.maskingRules.length > 0) {
                  parsedUpstream.data = this.masker.mask(parsedUpstream.data);
                }

                // Extract spans if present in extensions
                if (parsedUpstream?.extensions?.gqlpulse?.spans) {
                  spans = parsedUpstream.extensions.gqlpulse.spans;
                } else if (parsedUpstream?.extensions?.tracing?.execution?.resolvers) {
                  const resolvers = parsedUpstream.extensions.tracing.execution.resolvers;
                  spans = resolvers.map((r: any) => ({
                    path: r.path,
                    parentType: r.parentType,
                    fieldName: r.fieldName,
                    returnType: r.returnType,
                    startOffsetUs: Math.round(r.startOffset / 1000),
                    durationUs: Math.round(r.duration / 1000),
                    selfTimeUs: Math.round(r.duration / 1000),
                  }));
                }

                // Run N+1 profiler
                if (spans.length > 0) {
                  const profilerResult = this.profiler.analyzeSpans(spans);
                  nPlusOneAlerts = profilerResult.alerts;
                  spans = profilerResult.spansWithSelfTime;
                  this.metrics.nPlusOneAlertCount += nPlusOneAlerts.length;
                }
              } catch {
                // Non-JSON response
              }

              const trace: WaterfallTrace = {
                id: `trace-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                operationName: payload.operationName,
                query: payload.query!,
                variables: payload.variables,
                timestamp: Date.now(),
                totalDurationMs: Math.round(totalDurationMs * 10) / 10,
                spans,
                nPlusOneAlerts,
                complexity: analysis.complexity,
                depth: analysis.depth,
                status: 'SUCCESS',
                clientIp: clientId,
              };

              this.recordTrace(trace);
              this.broadcastEvent('QUERY_EXECUTED', trace);

              // Inject GQLPulse telemetry into response extensions
              if (parsedUpstream && typeof parsedUpstream === 'object') {
                parsedUpstream.extensions = {
                  ...(parsedUpstream.extensions || {}),
                  gqlpulse: {
                    ...(parsedUpstream.extensions?.gqlpulse || {}),
                    traceId: trace.id,
                    complexity: analysis.complexity,
                    depth: analysis.depth,
                    nPlusOneCascadesDetected: nPlusOneAlerts.length,
                    durationMs: Math.round(totalDurationMs * 10) / 10,
                  },
                };
                upstreamBody = JSON.stringify(parsedUpstream);
              }

              res.writeHead(proxyRes.statusCode || 200, {
                'Content-Type': 'application/json',
                'X-GQLPulse-Complexity': String(analysis.complexity),
                'X-GQLPulse-Depth': String(analysis.depth),
                'X-GQLPulse-N1-Alerts': String(nPlusOneAlerts.length),
              });
              res.end(upstreamBody);
            });
          }
        );

        proxyReq.on('error', (err) => {
          this.metrics.totalQueries++;
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              errors: [
                {
                  message: `GQLPulse Proxy could not connect to upstream backend at ${this.config.targetUrl}: ${err.message}`,
                  extensions: { code: 'BAD_GATEWAY' },
                },
              ],
            })
          );
        });

        // Forward updated body (with resolved query if APQ was used)
        proxyReq.write(outPayloadStr);
        proxyReq.end();
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ errors: [{ message: err.message || 'Internal Proxy Error' }] }));
      }
    });
  }

  private handleApiRoute(pathname: string, req: http.IncomingMessage, res: http.ServerResponse, url: URL): void {
    if (pathname === '/api/metrics') {
      this.metrics.uptimeSeconds = Math.round((Date.now() - this.startedAt) / 1000);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.metrics));
      return;
    }

    if (pathname === '/api/traces') {
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.traces.slice(0, limit)));
      return;
    }

    if (pathname.startsWith('/api/trace/')) {
      const id = pathname.replace('/api/trace/', '');
      const found = this.traces.find((t) => t.id === id);
      if (found) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(found));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Trace not found' }));
      }
      return;
    }

    if (pathname === '/api/analyze' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const { query, variables } = JSON.parse(body);
          const result = this.calculator.analyze(query, variables);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (err: any) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (pathname === '/api/diff' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const { oldSchema, newSchema } = JSON.parse(body);
          const diff = this.diffEngine.diff(oldSchema, newSchema);
          const impacts = this.impactAnalyzer.analyzeImpact(diff, this.traces);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ...diff, impacts }));
        } catch (err: any) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // DataLoader Simulator comparison endpoint
    if (pathname === '/api/simulate-dataloader' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', async () => {
        try {
          const { query, variables } = JSON.parse(body);

          // 1. Run unbatched
          const start1 = performance.now();
          const res1 = await fetch(this.config.targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables }),
          });
          const dur1 = performance.now() - start1;
          const json1: any = await res1.json();
          const spans1: ResolverSpan[] = json1.extensions?.gqlpulse?.spans || [];
          const prof1 = this.profiler.analyzeSpans(spans1);

          // 2. Run batched with DataLoader mode
          const start2 = performance.now();
          const res2 = await fetch(this.config.targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-gqlpulse-mode': 'dataloader' },
            body: JSON.stringify({ query, variables }),
          });
          const dur2 = performance.now() - start2;
          const json2: any = await res2.json();
          const spans2: ResolverSpan[] = json2.extensions?.gqlpulse?.spans || [];
          const prof2 = this.profiler.analyzeSpans(spans2);

          const comparison: ComparisonSimulationResult = {
            query,
            unbatched: {
              durationMs: Math.round(dur1 * 10) / 10,
              dbQueriesEstimated: spans1.length > 0 ? spans1.length : 1,
              spansCount: spans1.length,
              nPlusOneCascades: prof1.alerts.length,
              spans: prof1.spansWithSelfTime,
            },
            batched: {
              durationMs: Math.round(dur2 * 10) / 10,
              dbQueriesEstimated: prof2.alerts.length === 0 ? Math.max(1, Math.round(spans2.length * 0.2)) : 1,
              spansCount: spans2.length,
              nPlusOneCascades: prof2.alerts.length,
              spans: prof2.spansWithSelfTime,
            },
            latencyReductionPercent: Math.max(0, Math.round(((dur1 - dur2) / dur1) * 100)),
            dbQueriesSavedPercent: Math.max(0, Math.round(((spans1.length - spans2.length) / Math.max(1, spans1.length)) * 100)),
          };

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(comparison));
        } catch (err: any) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (pathname === '/api/apq' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.apqManager.getStats()));
      return;
    }

    if (pathname === '/api/rules') {
      if (req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            ...this.config.complexity,
            apq: this.config.apq,
            maskingRules: this.config.maskingRules,
          })
        );
      } else if (req.method === 'PUT') {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          try {
            const updated: any = JSON.parse(body);
            if (updated.apq) {
              this.config.apq = { ...this.config.apq, ...updated.apq };
              this.apqManager.updateConfig(this.config.apq.enabled, this.config.apq.strictSafelist);
            }
            if (updated.maskingRules) {
              this.config.maskingRules = updated.maskingRules;
              this.masker.updateRules(this.config.maskingRules);
            }

            this.config.complexity = { ...this.config.complexity, ...updated };
            this.calculator.updateConfig(this.config.complexity);
            this.broadcastEvent('RULES_UPDATED', this.config);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(this.config.complexity));
          } catch (err: any) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      }
      return;
    }

    if (pathname === '/api/deprecations') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          knownDeprecated: this.deprecationTracker.getKnownDeprecatedFields(),
          usageStats: this.deprecationTracker.getStats(),
        })
      );
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `API route not found: ${pathname}` }));
  }

  private handleStudioStatic(pathname: string, req: http.IncomingMessage, res: http.ServerResponse): void {
    const possiblePaths = [
      path.join(process.cwd(), 'packages', 'studio', 'dist'),
      path.join(__dirname, '..', '..', 'studio', 'dist'),
    ];

    let studioDist = possiblePaths.find((p) => fs.existsSync(p));

    if (studioDist) {
      let relativePath = pathname.replace('/studio', '');
      if (relativePath === '' || relativePath === '/') relativePath = '/index.html';

      const filePath = path.join(studioDist, relativePath);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        const mimeTypes: Record<string, string> = {
          '.html': 'text/html',
          '.js': 'application/javascript',
          '.css': 'text/css',
          '.svg': 'image/svg+xml',
          '.json': 'application/json',
          '.png': 'image/png',
          '.ico': 'image/x-icon',
        };
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
        return;
      }

      const indexPath = path.join(studioDist, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        fs.createReadStream(indexPath).pipe(res);
        return;
      }
    }

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <title>GQLPulse Studio</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-slate-100 font-sans p-8">
  <div class="max-w-4xl mx-auto">
    <div class="flex items-center justify-between pb-6 border-b border-slate-800">
      <div>
        <h1 class="text-2xl font-bold text-white tracking-tight">GQLPulse Studio</h1>
        <p class="text-sm text-slate-400 mt-1">Real-Time GraphQL Query Complexity Linter & Resolver N+1 Profiler</p>
      </div>
      <div class="flex items-center space-x-2">
        <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Proxy Live :${this.config.port}
        </span>
      </div>
    </div>
    <div class="mt-8 bg-slate-900 border border-slate-800 rounded-lg p-6">
      <h2 class="text-lg font-semibold text-slate-200">Studio Build Notice</h2>
      <p class="text-sm text-slate-400 mt-2">
        The integrated React 19 Studio dashboard is ready to build via <code class="text-cyan-400 font-mono">npm run build:studio</code>.
      </p>
      <div class="mt-6 flex space-x-3">
        <a href="/metrics" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sm font-medium rounded-md text-slate-200">View /metrics (Prometheus)</a>
        <a href="/api/traces" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sm font-medium rounded-md text-slate-200">View /api/traces</a>
      </div>
    </div>
  </div>
</body>
</html>`);
  }

  private recordTrace(trace: WaterfallTrace): void {
    this.traces.unshift(trace);
    if (this.traces.length > this.maxTraces) {
      this.traces.pop();
    }
  }
}
