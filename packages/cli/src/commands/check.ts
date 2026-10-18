import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { SchemaDiffEngine } from '@gqlpulse/core';

export interface CheckCliOptions {
  against: string;
  githubComment?: boolean;
  json?: boolean;
  failOnBreaking?: boolean;
}

export async function runCheckCommand(schemaPath: string, options: CheckCliOptions): Promise<void> {
  const currentPath = path.resolve(process.cwd(), schemaPath);
  if (!fs.existsSync(currentPath)) {
    console.error(chalk.red(`Error: Local schema file not found at ${currentPath}`));
    process.exit(1);
  }

  const currentContent = fs.readFileSync(currentPath, 'utf8');
  let baseContent = '';

  const againstTarget = options.against || 'schema.graphql';
  const againstPath = path.resolve(process.cwd(), againstTarget);

  if (fs.existsSync(againstPath)) {
    baseContent = fs.readFileSync(againstPath, 'utf8');
  } else {
    console.error(chalk.red(`Error: Baseline schema for comparison not found at ${againstPath}`));
    process.exit(1);
  }

  const diffEngine = new SchemaDiffEngine();
  const result = diffEngine.diff(baseContent, currentContent);

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.hasBreakingChanges ? 1 : 0);
  }

  if (options.githubComment) {
    console.log('## 🔍 GQLPulse Schema Evolution & PR Check');
    console.log('');
    console.log(`| Severity | Count | Status |`);
    console.log(`| :--- | :--- | :--- |`);
    console.log(`| 🚨 **Breaking** | ${result.breakingCount} | ${result.breakingCount > 0 ? '❌ Action Required' : '✅ Clean'} |`);
    console.log(`| ⚠️ **Dangerous** | ${result.dangerousCount} | ${result.dangerousCount > 0 ? '⚠️ Review Deprecations' : '✅ None'} |`);
    console.log(`| ✨ **Safe** | ${result.safeCount} | ✅ Backwards-Compatible |`);
    console.log('');

    if (result.items.length > 0) {
      console.log('### Detected Schema Modifications');
      console.log('');
      console.log('| Type | Code | Target Path | Description |');
      console.log('| :--- | :--- | :--- | :--- |');
      for (const item of result.items) {
        const badge = item.category === 'BREAKING' ? '🚨 BREAKING' : item.category === 'DANGEROUS' ? '⚠️ DANGEROUS' : '✨ SAFE';
        console.log(`| ${badge} | \`${item.code}\` | \`${item.path}\` | ${item.description} |`);
      }
      console.log('');
    }

    if (result.hasBreakingChanges) {
      console.log('> [!CAUTION]');
      console.log('> This PR introduces breaking changes to the GraphQL schema. Mobile and legacy web clients may crash if deployed without client migration.');
      process.exit(1);
    } else {
      console.log('> [!NOTE]');
      console.log('> All schema modifications are backwards-compatible and safe for deployment.');
      process.exit(0);
    }
  }

  // Standard Terminal Output
  console.log(chalk.cyan.bold('\n🔍 GQLPulse CI/CD Schema Check\n'));
  console.log(chalk.gray(`  • Candidate Schema: `) + chalk.white(path.basename(currentPath)));
  console.log(chalk.gray(`  • Compared Against: `) + chalk.white(path.basename(againstPath)));
  console.log(
    chalk.gray(`  • Results:          `) +
      (result.breakingCount > 0 ? chalk.red.bold(`${result.breakingCount} Breaking`) : chalk.green('0 Breaking')) +
      chalk.gray(` | `) +
      chalk.yellow(`${result.dangerousCount} Dangerous`) +
      chalk.gray(` | `) +
      chalk.green(`${result.safeCount} Safe`)
  );
  console.log('');

  for (const item of result.items) {
    const tag =
      item.category === 'BREAKING'
        ? chalk.red.bold('[BREAKING]')
        : item.category === 'DANGEROUS'
        ? chalk.yellow.bold('[DANGEROUS]')
        : chalk.green('[SAFE]    ');

    console.log(`${tag} ${chalk.cyan(item.path.padEnd(28))} ${item.description}`);
  }
  console.log('');

  if (result.hasBreakingChanges) {
    console.log(chalk.red.bold('✖ CHECK FAILED: Breaking schema modifications detected.\n'));
    process.exit(1);
  } else {
    console.log(chalk.green.bold('✔ CHECK PASSED: Schema changes are backward-compatible.\n'));
    process.exit(0);
  }
}
