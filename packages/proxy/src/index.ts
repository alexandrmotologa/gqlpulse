export * from './config.js';
export * from './rate-limiter.js';
export * from './proxy-server.js';

import { GQLPulseProxyServer } from './proxy-server.js';
import { DEFAULT_PROXY_CONFIG } from './config.js';

// Auto-run if executed as script directly
if (require.main === module) {
  const targetUrl = process.env.TARGET_URL || DEFAULT_PROXY_CONFIG.targetUrl;
  const port = parseInt(process.env.PORT || String(DEFAULT_PROXY_CONFIG.port), 10);

  const server = new GQLPulseProxyServer({ targetUrl, port });
  server.start().catch((err) => {
    console.error('Failed to start GQLPulse Proxy:', err);
    process.exit(1);
  });
}
