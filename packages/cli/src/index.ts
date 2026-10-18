#!/usr/bin/env node
import { Command } from 'commander';
import { runProxyCommand } from './commands/proxy.js';
import { runLintCommand } from './commands/lint.js';
import { runDiffCommand } from './commands/diff.js';
import { runDemoCommand } from './commands/demo.js';
import { runCheckCommand } from './commands/check.js';

const program = new Command();

program
  .name('gqlpulse')
  .description('Real-Time GraphQL Query Complexity Linter, Resolver N+1 Profiler & Schema Evolution Studio')
  .version('1.0.0');

program
  .command('proxy')
  .description('Start the GQLPulse transparent reverse proxy and Studio dashboard')
  .option('-t, --target <url>', 'Upstream target GraphQL URL', 'http://localhost:4001/graphql')
  .option('-p, --port <number>', 'Port for GQLPulse proxy server', '4000')
  .option('-s, --schema <path>', 'Path to local GraphQL schema file (.graphql)')
  .option('-c, --max-complexity <number>', 'Maximum query complexity score before blocking', '250')
  .option('-d, --max-depth <number>', 'Maximum query nesting depth before blocking', '10')
  .option('--dry-run', 'Audit mode: calculate violations without rejecting queries')
  .action(runProxyCommand);

program
  .command('lint')
  .description('Lint a GraphQL query for complexity and depth in <0.5ms')
  .argument('<query-or-file>', 'GraphQL query string or path to .graphql query file')
  .option('-s, --schema <path>', 'Path to GraphQL schema file')
  .option('-c, --max-complexity <number>', 'Maximum query complexity allowed', '250')
  .option('-d, --max-depth <number>', 'Maximum query depth allowed', '10')
  .option('--json', 'Output results as JSON')
  .action(runLintCommand);

program
  .command('diff')
  .description('Compare two GraphQL schemas and detect breaking changes for mobile/web clients')
  .argument('<old-schema>', 'Path to baseline schema.graphql')
  .argument('<new-schema>', 'Path to candidate schema.graphql')
  .action(runDiffCommand);

program
  .command('check')
  .description('CI/CD Schema check with GitHub Actions markdown comment support')
  .argument('<schema-file>', 'Path to candidate schema file')
  .option('-a, --against <baseline-file>', 'Baseline schema file to compare against', 'packages/demo-server/dist/schema-v1.graphql')
  .option('--github-comment', 'Format output as GitHub Actions Markdown for PR comments')
  .option('--json', 'Output report as JSON')
  .action(runCheckCommand);

program
  .command('demo')
  .description('Launch both the demo GraphQL backend and the GQLPulse proxy with Studio')
  .action(runDemoCommand);

program.parse(process.argv);
