import chalk from 'chalk';
import { startDemoServer } from '@gqlpulse/demo-server';
import { GQLPulseProxyServer } from '@gqlpulse/proxy';

export async function runDemoCommand(): Promise<void> {
  console.log(chalk.cyan.bold('\n🚀 Launching GQLPulse Full-Stack Live Demo Environment\n'));

  // 1. Start Demo Backend on port 4001
  await startDemoServer({ port: 4001, schemaVersion: 'v1' });

  // 2. Start GQLPulse Proxy on port 4000
  const proxy = new GQLPulseProxyServer({
    port: 4000,
    targetUrl: 'http://localhost:4001/graphql',
    enableStudio: true,
  });
  await proxy.start();

  console.log(chalk.green.bold('✔ All GQLPulse services running successfully!\n'));
  console.log(chalk.white('───────────────────────────────────────────────────────────────────'));
  console.log(chalk.gray('  • Studio Web Dashboard: ') + chalk.cyan.bold('http://localhost:4000/studio'));
  console.log(chalk.gray('  • Proxy GraphQL Endpoint: ') + chalk.white.bold('http://localhost:4000/graphql'));
  console.log(chalk.gray('  • Upstream Demo Server:  ') + chalk.white('http://localhost:4001/graphql'));
  console.log(chalk.white('───────────────────────────────────────────────────────────────────\n'));
  console.log(chalk.yellow.bold('Quick Testing Workflows:'));
  console.log(chalk.gray('  1. Open the Studio Dashboard at ') + chalk.cyan('http://localhost:4000/studio'));
  console.log(chalk.gray('  2. Try the "N+1 Cascade Query" in the Live Monitor or Linter Sandbox.'));
  console.log(chalk.gray('  3. Inspect the Waterfall Flamegraph and click "Generate DataLoader Fix".'));
  console.log(chalk.gray('  4. Test the "Deep Nested DoS Attack" to see real-time blocking in <0.5ms.'));
  console.log(chalk.gray('  5. Open the Schema Evolution tab to compare v1 vs v2 breaking diffs.\n'));
  console.log(chalk.gray('Press Ctrl+C to terminate both servers.'));
}
