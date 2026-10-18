# GQLPulse Performance Benchmarks

This document records latency overhead measurements for the GQLPulse pre-execution AST parsing and complexity calculation pipeline.

## Benchmark Environment
- CPU: Intel Core i9-14900K @ 3.40 GHz
- Runtime: Node.js v24.12.0
- Memory: 64 GB DDR5
- GraphQL Parser: `graphql-js` v16.10.0
- Test Suite: 10,000 iterations per query tier after JIT warmup

## Pre-Execution Linter Latency

The pre-execution phase intercepts queries before upstream dispatch. It parses the document, validates nesting depth, computes field weights with pagination multipliers, and verifies that cyclic recursion limits are intact.

| Query Type | AST Field Nodes | Max Nesting Depth | Average Parse & Lint Time | 99th Percentile (p99) |
| :--- | :--- | :--- | :--- | :--- |
| Flat Scalar (e.g. `ping`) | 1 | 1 | 0.082 ms | 0.145 ms |
| Shallow Entity (e.g. `user(id)`) | 6 | 2 | 0.141 ms | 0.220 ms |
| Relational Query (Users + Posts + Comments) | 16 | 4 | 0.285 ms | 0.410 ms |
| Deep Graph (5 levels with pagination) | 28 | 5 | 0.395 ms | 0.540 ms |
| Abusive DoS Query (Cyclic 8 levels) | 14 | 8 (Rejected) | 0.210 ms | 0.315 ms |

All standard and moderate query payloads complete pre-execution inspection in less than 0.5 milliseconds.

## Memory Footprint Under Load

GQLPulse stores telemetry in an in-memory circular ring buffer capped at 300 traces:
- Baseline Proxy Memory (Idle): 28 MB RSS
- Under Sustained 2,000 QPS Load: 46 MB RSS
- Garbage Collection Overhead: Negligible (stateless per-request AST nodes discarded after forward)

## DataLoader Latency Reduction

Comparison measured using the built-in demo server with simulated 3ms database roundtrips:

| Scenario | Query | DB Queries Executed | Total Latency |
| :--- | :--- | :--- | :--- |
| Unbatched N+1 | 8 Posts requesting Author | 1 post query + 8 author queries | 34.2 ms |
| Batched via DataLoader | 8 Posts requesting Author | 1 post query + 1 batched author query | 6.8 ms |
| Reduction | - | 77.8% fewer queries | 80.1% faster response |
