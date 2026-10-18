# GQLPulse Technical Architecture

GQLPulse functions as a low-latency reverse proxy and developer observability suite designed specifically for GraphQL APIs. It sits in the network path between client applications and backend GraphQL execution engines (Apollo Server, GraphQL Yoga, NestJS, Mercurius, or custom HTTP handlers).

```
   [ Client / Frontend ]
             |
             v  HTTP POST /graphql
  +-----------------------------------------------------+
  | GQLPulse Reverse Proxy (:4000)                      |
  |                                                     |
  |  1. Pre-Execution Phase (<0.5ms)                   |
  |     - Tokenizer & AST Parser                        |
  |     - Max Nesting Depth Check                       |
  |     - Cumulative Complexity Scorer                  |
  |     - Cyclic Recursion Detector                     |
  |     - Per-Client Sliding Window Rate Limiter        |
  |     [ If limit exceeded: Returns HTTP 400 ]         |
  |                                                     |
  |  2. Upstream Network Dispatch                       |
  |     - Zero-copy streaming forward to backend        |
  |                                                     |
  |  3. Post-Execution Telemetry Phase                  |
  |     - Resolver Span Extraction                      |
  |     - N+1 Cascading Loop Detection                  |
  |     - DataLoader Remediation Generation             |
  |     - Deprecated Field Traffic Monitoring           |
  |     - SSE Event Broadcast to Web Studio             |
  +-----------------------------------------------------+
             |
             v  Forwarded HTTP Request
   [ Upstream GraphQL Backend (:4001) ]
```

## 1. Pre-Execution AST Linting Pipeline

When an incoming query arrives at the proxy, GQLPulse runs static analysis before any backend database or network resources are consumed.

### AST Traversal and Complexity Weights
The query document is parsed into an abstract syntax tree via `graphql/language`. An AST visitor traverses every field selection node while maintaining a multiplier stack:
- Leaf scalar fields increment the query score by `scalarCost` (default: 1) multiplied by the cumulative list multiplier.
- Composite object fields add `objectCost` (default: 2) multiplied by the active multiplier.
- Slicing arguments such as `first`, `limit`, `last`, or `take` update the multiplier stack for all descendant fields in that branch.
- When list fields lack pagination parameters, GQLPulse falls back to `defaultListMultiplier` (default: 10) to guard against unconstrained full-table scans.

### Cyclic Recursion Guard
Queries requesting self-referencing relationships (such as `User -> posts -> comments -> author -> posts`) can generate exponential execution graphs. GQLPulse tracks parent type signatures along every branch. If a type repeats within the active branch beyond the configured safety threshold, the query is marked as a cyclic denial-of-service hazard and rejected immediately.

## 2. Resolver Execution Profiler and N+1 Detector

GQLPulse parses execution metrics exposed in the `extensions.tracing` format (Apollo Tracing) or `extensions.gqlpulse` spans.

### Grouping and Waterfall Processing
Each resolver execution span contains:
- `path`: Key hierarchy within the response payload (for example, `['posts', 2, 'author']`).
- `parentType` and `fieldName`: Declared schema coordinates.
- `startOffsetUs`: Time offset relative to request inception.
- `durationUs`: Total wall-clock time spent inside the resolver.

GQLPulse computes resolver `selfTimeUs` by subtracting the execution duration of all direct child spans.

### N+1 Cascade Heuristics
A signature group is created for each `ParentType.fieldName` tuple. If a resolver is invoked more than 3 times for a single parent list, GQLPulse checks whether the executions occurred sequentially or concurrently without batching.

When flagged:
- The cascade is tagged as `CRITICAL` (>10 calls or >50ms total delay) or `WARNING` (>3 calls).
- GQLPulse generates ready-to-use TypeScript DataLoader definitions and refactored resolver code.

## 3. Schema Evolution and Breaking Change Engine

GQLPulse includes a schema diffing engine built upon GraphQL type system introspection:
- **Breaking Changes**: Type removals, field deletions, changes to field nullability, additions of non-null arguments without defaults, and enum value removals.
- **Dangerous Changes**: Additions of `@deprecated` directives on active fields and changes to default argument values.
- **Safe Changes**: Newly added types, optional fields, optional arguments, and new enum values.

### Live Deprecation Tracking
The proxy registers all fields marked `@deprecated` in the schema. When queries pass through the proxy, field nodes are matched against deprecation registries, tracking real-time hit counts and requesting client IP addresses.

## 4. Real-Time Telemetry Event Bus

The proxy maintains a circular ring buffer of the latest 300 queries and resolver execution traces. Active web studio instances connect to `/events` via Server-Sent Events (SSE). When queries complete or get rejected, structured telemetry packets are pushed over open HTTP connections without polling overhead.
