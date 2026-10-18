import { startDemoServer } from './server.js';

export * from './server.js';
export * from './resolvers.js';
export * from './db.js';

// Auto-run if executed directly as script
if (require.main === module) {
  const port = parseInt(process.env.PORT || '4001', 10);
  const version = (process.env.SCHEMA_VERSION || 'v1') as 'v1' | 'v2';
  startDemoServer({ port, schemaVersion: version });
}
