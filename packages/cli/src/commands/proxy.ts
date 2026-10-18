import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { GQLPulseProxyServer } from '@gqlpulse/proxy';

export interface ProxyCliOptions {
  target: string;
  port: string;
  schema?: string;
  maxComplexity?: string;
  maxDepth?: string;
  dryRun?: boolean;
}

export async function runProxyCommand(options: ProxyCliOptions): Promise<void> {
  const port = parseInt(options.port || '4000', 10);
  const targetUrl = options.target || 'http://localhost:4001/graphql';

  let schemaContent: string | undefined;
  if (options.schema) {
    const fullPath = path.resolve(process.cwd(), options.schema);
    if (!fs.existsSync(fullPath)) {
      console.error(chalk.red(`Error: Schema file not found: ${fullPath}`));
      process.exit(1);
    }
    schemaContent = fs.readFileSync(fullPath, 'utf8');
  }

  const maxComplexity = options.maxComplexity ? parseInt(options.maxComplexity, 10) : 250;
  const maxDepth = options.maxDepth ? parseInt(options.maxDepth, 10) : 10;
  const dryRun = !!options.dryRun;

  console.log(chalk.cyan.bold('\n⚡ Starting GQLPulse Transparent Reverse Proxy\n'));
  console.log(chalk.gray(`  • Upstream Target:   `) + chalk.white.bold(targetUrl));
  console.log(chalk.gray(`  • Listening Port:    `) + chalk.white.bold(`http://localhost:${port}/graphql`));
  console.log(chalk.gray(`  • Studio Dashboard:  `) + chalk.cyan.bold(`http://localhost:${port}/studio`));
  console.log(chalk.gray(`  • Max Complexity:    `) + chalk.white(`${maxComplexity} pts`));
  console.log(chalk.gray(`  • Max Nesting Depth: `) + chalk.white(`${maxDepth} levels`));
  console.log(chalk.gray(`  • Dry-Run Mode:      `) + (dryRun ? chalk.yellow('ENABLED (Audit only)') : chalk.green('DISABLED (Active blocking)')));
  console.log('');

  const proxy = new GQLPulseProxyServer(
    {
      targetUrl,
      port,
      complexity: {
        maxComplexity,
        maxDepth,
        dryRun,
      } as any,
    },
    schemaContent
  );

  await proxy.start();
  console.log(chalk.green(`✓ Reverse proxy ready. Forwarding traffic and analyzing ASTs in <0.5ms.\n`));
}
