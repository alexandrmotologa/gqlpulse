<p align="center">
  <img src="docs/images/logo.svg" alt="GQLPulse Logo" width="96" height="96" />
</p>

<h1 align="center">GQLPulse</h1>

<p align="center">
  <strong>Real-Time GraphQL Query Complexity Linter, Resolver N+1 Profiler &amp; Schema Evolution Studio</strong>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg" alt="Node.js 22+" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/typescript-5.7+-blue.svg" alt="TypeScript" /></a>
  <a href="https://graphql.org/"><img src="https://img.shields.io/badge/graphql-16.10+-e10098.svg" alt="GraphQL" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/react-19-61dafb.svg" alt="React 19" /></a>
</p>

---

<p align="center">
  <img src="docs/images/gqlpulse_demo.gif" alt="GQLPulse Live Demo" width="100%" />
</p>

---

## Overview

Engineering teams operating GraphQL backends (Apollo Server, GraphQL Yoga, NestJS, Mercurius) routinely encounter two severe reliability bottlenecks:

1. **GraphQL Denial of Service (DoS)**: Malicious or unbounded client queries with deep recursion (such as `user -> posts -> comments -> author -> posts`) that lock up node event loops and exhaust memory before reaching the database.
2. **Hidden N+1 Resolver Cascades**: Nested resolvers executing thousands of sequential database roundtrips due to missing or misconfigured DataLoader batching.

**GQLPulse** resolves both issues by deploying as a lightweight reverse proxy and developer studio. It parses and validates incoming GraphQL ASTs in less than 0.5 milliseconds, rejects abusive queries before database execution, measures resolver execution waterfalls, flags N+1 cascades, and tracks schema breaking changes in real time.

---

## Core Capabilities

- **Pre-Execution Query Linter (<0.5ms)**: Intercepts queries prior to execution. Computes AST node counts, tree depth, and cumulative complexity weights incorporating pagination arguments (`first`, `limit`, `last`).
- **Cyclic Recursion Blocker**: Traverses graph branches to detect and terminate circular reference attacks before downstream servers are touched.
- **Resolver Waterfall Flamegraphs**: Extracts execution timings across resolver hierarchies, separates self-time from child durations, and flags bottlenecks.
- **Automated DataLoader Fixes**: Identifies repeated unbatched resolver calls and outputs copyable TypeScript DataLoader definitions and refactored resolver code.
- **Schema Evolution Studio**: Diffs revisions of `schema.graphql`, identifies breaking modifications for existing mobile and web clients, and tracks real-time traffic to `@deprecated` fields.
- **Zero-Dependency Core**: AST analysis and schema diffing run on standard `graphql-js` with minimal memory footprint.

---

## Studio Interface

### 1. Live Traffic Monitor
The real-time monitor streams query throughput, status codes, complexity scores, depth gauges, and N+1 alerts over Server-Sent Events (SSE).

<p align="center">
  <img src="docs/images/gqlpulse_monitor.png" alt="GQLPulse Live Monitor" width="100%" />
</p>

### 2. Resolver Execution Waterfall & Flamegraph
Drill down into individual queries to inspect resolver offsets, self-time distributions, and identify cascading database calls.

<p align="center">
  <img src="docs/images/gqlpulse_flamegraph.png" alt="GQLPulse Flamegraph" width="100%" />
</p>

### 3. Pre-Flight Complexity Linter
Test candidate queries against scoring rules, examine field-level cost multipliers, and simulate query depth constraints before deployment.

<p align="center">
  <img src="docs/images/gqlpulse_linter.png" alt="GQLPulse Linter Sandbox" width="100%" />
</p>

### 4. Schema Evolution & Breaking Change Diff
Compare baseline and candidate schema revisions to verify backward compatibility.

<p align="center">
  <img src="docs/images/gqlpulse_schema_diff.png" alt="GQLPulse Schema Diff" width="100%" />
</p>

---

## Quickstart

### 1. Installation

Install globally or within your project monorepo:

```bash
git clone https://github.com/alexandrmotologa/gqlpulse.git
cd gqlpulse
npm install
npm run build
```

### 2. Run the Full-Stack Demo

Start both the sample GraphQL backend (port 4001) and the GQLPulse proxy with the web studio (port 4000):

```bash
npm run demo
```

Once running:
- Open the Studio dashboard: `http://localhost:4000/studio`
- Send client queries to: `http://localhost:4000/graphql`
- Target backend runs at: `http://localhost:4001/graphql`

---

## CLI Usage

### Start Reverse Proxy
Forward traffic to an existing GraphQL backend while serving the studio:

```bash
npx gqlpulse proxy \
  --target http://localhost:4001/graphql \
  --port 4000 \
  --schema ./schema.graphql \
  --max-complexity 250 \
  --max-depth 8
```

### Lint a Query in CI/CD
Evaluate query complexity from the command line or during automated builds:

```bash
# Returns exit code 0 if approved, 1 if limits are exceeded
npx gqlpulse lint "query { users(first: 50) { posts { comments { text } } } }" \
  --schema ./schema.graphql \
  --max-complexity 200 \
  --max-depth 5
```

### Diff Schema Revisions
Catch breaking schema changes before deploying new API revisions:

```bash
npx gqlpulse diff ./schema-v1.graphql ./schema-v2.graphql
```

---

## Programmatic Integration

### Core Complexity Calculation

```typescript
import { QueryComplexityCalculator } from '@gqlpulse/core';
import { buildSchema } from 'graphql';

const schema = buildSchema(`...`);
const calculator = new QueryComplexityCalculator({
  maxComplexity: 250,
  maxDepth: 10,
  defaultListMultiplier: 10,
  scalarCost: 1,
  objectCost: 2,
}, schema);

const result = calculator.analyze(`
  query GetUsers {
    users(first: 10) {
      id
      displayName
      posts(limit: 5) {
        title
      }
    }
  }
`);

console.log(result.complexity);   // Computed score
console.log(result.depth);        // Max nesting levels
console.log(result.isBlocked);    // Boolean enforcement flag
console.log(result.durationMs);   // Linter parse duration in ms
```

### Schema Breaking Change Detection

```typescript
import { SchemaDiffEngine } from '@gqlpulse/core';

const diffEngine = new SchemaDiffEngine();
const result = diffEngine.diff(schemaV1String, schemaV2String);

console.log(`Breaking: ${result.breakingCount}`);
console.log(`Dangerous: ${result.dangerousCount}`);
console.log(`Safe: ${result.safeCount}`);
```

---

## Complexity Scoring Methodology

GQLPulse calculates query complexity through deterministic AST traversal:

$$\text{Field Cost} = \text{Base Cost} \times \prod \text{Parent Multipliers}$$

1. **Leaf Scalars**: 1 point by default.
2. **Composite Objects**: 2 points by default.
3. **List Slicing**: Arguments (`first`, `limit`, `take`, `count`) multiply descendant field weights.
4. **Unpaginated Lists**: Fall back to the default list multiplier (10x).
5. **Directives**: Specific weights can be assigned via `@complexity(value: 50)` directives in the schema.

---

## Project Structure

```
gqlpulse/
├── packages/
│   ├── core/         # AST visitor, complexity calculator, profiler, and schema diff engine
│   ├── proxy/        # Transparent Node.js HTTP reverse proxy and rate limiter
│   ├── studio/       # React 19 + Tailwind CSS developer telemetry workbench
│   ├── demo-server/  # E-commerce and blog GraphQL API with intentional N+1 fixtures
│   └── cli/          # Command-line binary for proxy, lint, diff, and demo
├── docs/
│   ├── images/       # Authentic UI screenshots and animated demo GIF
│   ├── ARCHITECTURE.md
│   ├── BENCHMARKS.md
│   └── DATALOADER_GUIDE.md
└── package.json
```

---

## Documentation

- [Technical Architecture](docs/ARCHITECTURE.md)
- [Performance Benchmarks](docs/BENCHMARKS.md)
- [DataLoader Implementation Guide](docs/DATALOADER_GUIDE.md)

---

## License

This project is licensed under the [MIT License](LICENSE).
