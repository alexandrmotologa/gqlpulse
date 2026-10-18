import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { SchemaDiffEngine } from '@gqlpulse/core';

export async function runDiffCommand(oldSchemaPath: string, newSchemaPath: string): Promise<void> {
  const oldFull = path.resolve(process.cwd(), oldSchemaPath);
  const newFull = path.resolve(process.cwd(), newSchemaPath);

  if (!fs.existsSync(oldFull)) {
    console.error(chalk.red(`Error: Baseline schema not found: ${oldFull}`));
    process.exit(1);
  }
  if (!fs.existsSync(newFull)) {
    console.error(chalk.red(`Error: Target schema not found: ${newFull}`));
    process.exit(1);
  }

  const oldContent = fs.readFileSync(oldFull, 'utf8');
  const newContent = fs.readFileSync(newFull, 'utf8');

  const diffEngine = new SchemaDiffEngine();
  const result = diffEngine.diff(oldContent, newContent);

  console.log(chalk.cyan.bold('\n🧬 GQLPulse Schema Evolution & Breaking Change Diff Report\n'));
  console.log(chalk.gray(`  • Baseline Schema:  `) + chalk.white(path.basename(oldFull)));
  console.log(chalk.gray(`  • Candidate Schema: `) + chalk.white(path.basename(newFull)));
  console.log(chalk.gray(`  • Total Changes:    `) + chalk.white(`${result.items.length}`));
  console.log(
    chalk.gray(`  • Change Breakdown: `) +
      chalk.red.bold(`${result.breakingCount} Breaking`) +
      chalk.gray(` | `) +
      chalk.yellow.bold(`${result.dangerousCount} Dangerous`) +
      chalk.gray(` | `) +
      chalk.green.bold(`${result.safeCount} Safe`)
  );
  console.log('');

  if (result.items.length === 0) {
    console.log(chalk.green('✓ Schemas are identical. No differences found.\n'));
    process.exit(0);
  }

  for (const item of result.items) {
    let tag = chalk.green('[SAFE]     ');
    if (item.category === 'BREAKING') tag = chalk.red.bold('[BREAKING] ');
    else if (item.category === 'DANGEROUS') tag = chalk.yellow.bold('[DANGEROUS]');

    console.log(`${tag} ${chalk.cyan(item.path.padEnd(28))} ${chalk.gray(item.code.padEnd(20))} ${item.description}`);
  }
  console.log('');

  if (result.hasBreakingChanges) {
    console.log(chalk.red.bold('✖ RESULT: Schema contains breaking changes that will impact existing consumers.\n'));
    process.exit(1);
  } else {
    console.log(chalk.green.bold('✔ RESULT: Schema evolution is backwards compatible.\n'));
    process.exit(0);
  }
}
