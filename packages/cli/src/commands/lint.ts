import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { QueryComplexityCalculator } from '@gqlpulse/core';
import { buildSchema, GraphQLSchema } from 'graphql';

export interface LintCliOptions {
  schema?: string;
  maxComplexity?: string;
  maxDepth?: string;
  json?: boolean;
}

export async function runLintCommand(queryOrFile: string, options: LintCliOptions): Promise<void> {
  let queryString = queryOrFile;

  // Check if argument is a file path
  if (fs.existsSync(queryOrFile)) {
    queryString = fs.readFileSync(path.resolve(process.cwd(), queryOrFile), 'utf8');
  }

  let schema: GraphQLSchema | undefined;
  if (options.schema) {
    const fullPath = path.resolve(process.cwd(), options.schema);
    if (!fs.existsSync(fullPath)) {
      console.error(chalk.red(`Error: Schema file not found at ${fullPath}`));
      process.exit(1);
    }
    const schemaContent = fs.readFileSync(fullPath, 'utf8');
    schema = buildSchema(schemaContent);
  }

  const maxComplexity = options.maxComplexity ? parseInt(options.maxComplexity, 10) : 250;
  const maxDepth = options.maxDepth ? parseInt(options.maxDepth, 10) : 10;

  const calculator = new QueryComplexityCalculator(
    {
      maxComplexity,
      maxDepth,
    },
    schema
  );

  const result = calculator.analyze(queryString);

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.isBlocked ? 1 : 0);
  }

  console.log(chalk.cyan.bold('\n🔍 GQLPulse Query Complexity Linter Report\n'));
  console.log(chalk.gray(`  • Total Complexity: `) + (result.complexity > maxComplexity ? chalk.red.bold(`${result.complexity} pts (LIMIT: ${maxComplexity})`) : chalk.green.bold(`${result.complexity} pts`)));
  console.log(chalk.gray(`  • Nesting Depth:    `) + (result.depth > maxDepth ? chalk.red.bold(`${result.depth} levels (LIMIT: ${maxDepth})`) : chalk.white(`${result.depth} levels`)));
  console.log(chalk.gray(`  • AST Field Nodes:  `) + chalk.white(`${result.nodeCount}`));
  console.log(chalk.gray(`  • Linter Latency:   `) + chalk.cyan(`${result.durationMs.toFixed(3)}ms (<0.5ms threshold)`));
  console.log('');

  if (result.violations.length > 0) {
    console.log(chalk.red.bold('✖ VIOLATIONS DETECTED:'));
    for (const v of result.violations) {
      console.log(chalk.red(`  • [${v.type}] ${v.message}`));
    }
    console.log('');
    console.log(chalk.red.bold('Status: REJECTED (Query blocked by security thresholds)\n'));
    process.exit(1);
  } else {
    console.log(chalk.green.bold('✔ QUERY APPROVED (Within complexity and depth limits)\n'));
    process.exit(0);
  }
}
