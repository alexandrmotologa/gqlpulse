import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { buildSchema, graphql, GraphQLSchema } from 'graphql';
import { resolvers, createDataLoaders, bindResolversToSchema, GraphQLContext } from './resolvers.js';

export interface DemoServerOptions {
  port?: number;
  schemaVersion?: 'v1' | 'v2';
}

export function startDemoServer(options: DemoServerOptions = {}): Promise<http.Server> {
  const port = options.port || 4001;
  const version = options.schemaVersion || 'v1';

  const schemaFile = version === 'v2' ? 'schema-v2.graphql' : 'schema-v1.graphql';
  // Check both in src and dist/src or root
  let schemaPath = path.join(__dirname, schemaFile);
  if (!fs.existsSync(schemaPath)) {
    schemaPath = path.join(__dirname, '..', 'src', schemaFile);
  }
  if (!fs.existsSync(schemaPath)) {
    schemaPath = path.join(process.cwd(), 'packages', 'demo-server', 'src', schemaFile);
  }

  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  const schema: GraphQLSchema = buildSchema(schemaContent);
  bindResolversToSchema(schema, resolvers);

  const server = http.createServer(async (req, res) => {
    // Enable CORS for testing & playground
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-gqlpulse-mode');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: 'gqlpulse-demo-backend', port, version }));
      return;
    }

    if (url.pathname === '/schema') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(schemaContent);
      return;
    }

    if (url.pathname === '/graphql') {
      let bodyStr = '';
      req.on('data', (chunk) => {
        bodyStr += chunk;
      });

      req.on('end', async () => {
        try {
          let payload: { query?: string; variables?: Record<string, unknown>; operationName?: string } = {};

          if (req.method === 'POST') {
            payload = bodyStr ? JSON.parse(bodyStr) : {};
          } else if (req.method === 'GET') {
            payload = {
              query: url.searchParams.get('query') || undefined,
              variables: url.searchParams.get('variables') ? JSON.parse(url.searchParams.get('variables')!) : undefined,
              operationName: url.searchParams.get('operationName') || undefined,
            };
          }

          if (!payload.query) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ errors: [{ message: 'Missing GraphQL query in request' }] }));
            return;
          }

          const isDataLoaderMode =
            req.headers['x-gqlpulse-mode'] === 'dataloader' ||
            url.searchParams.get('dataloader') === 'true' ||
            url.searchParams.get('batch') === 'true';

          const contextValue: GraphQLContext = {
            isDataLoaderMode,
            startTimeUs: Math.round(performance.now() * 1000),
            spans: [],
            loaders: createDataLoaders(),
          };

          const executionStart = performance.now();
          const executionResult = await graphql({
            schema,
            source: payload.query,
            contextValue,
            variableValues: payload.variables,
            operationName: payload.operationName,
          });
          const executionDurationMs = performance.now() - executionStart;

          // Attach tracing extensions
          const responsePayload = {
            ...executionResult,
            extensions: {
              ...(executionResult.extensions || {}),
              gqlpulse: {
                spans: contextValue.spans,
                isDataLoaderMode,
                executionDurationMs: Math.round(executionDurationMs * 100) / 100,
                totalSpans: contextValue.spans.length,
              },
            },
          };

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(responsePayload));
        } catch (err: any) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ errors: [{ message: err.message || 'Internal GraphQL execution error' }] }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found. Use POST /graphql' }));
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`[gqlpulse-demo] GraphQL Target Server running on http://localhost:${port}/graphql (${version})`);
      resolve(server);
    });
  });
}
