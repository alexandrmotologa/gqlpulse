# GQLPulse Technical Architecture

GQLPulse operates as a high-performance reverse proxy and developer observability suite designed specifically for GraphQL APIs. It sits in the network path between client applications and backend GraphQL execution engines (Apollo Server, GraphQL Yoga, NestJS, Mercurius, or custom HTTP handlers).

```
   [ Client / Frontend / CI/CD ]
                 |
                 v  HTTP POST /graphql
   +-------------------------------------------------------------+
   | GQLPulse Reverse Proxy (:4000)                              |
   |                                                             |
   |  1. Pre-Execution Phase (<0.5ms)                            |
   |     - Apollo APQ Handler (SHA-256 Lookup & Safelisting)     |
   |     - Tokenizer & AST Parser                                |
   |     - Max Nesting Depth Check                               |
   |     - Cumulative Complexity Scorer                          |
   |     - Cyclic Recursion Detector                             |
   |     - Per-Client Sliding Window Rate Limiter                |
   |     [ If limit exceeded: Returns HTTP 400 ]                 |
   |                                                             |
   |  2. Upstream Network Dispatch                               |
   |     - Content-length managed payload forward to backend     |
   |                                                             |
   |  3. Post-Execution Telemetry & Security Phase               |
   |     - Resolver Span Extraction & Self-Time Calculation      |
   |     - N+1 Cascading Loop Detection & DataLoader Generation  |
   |     - Deprecated Field Traffic Monitoring                   |
   |     - Sensitive Field Response Masking (PII / Tokens)       |
   |     - Prometheus /metrics Metric Exposition                 |
   |     - SSE Event Broadcast to Web Studio                     |
   +-------------------------------------------------------------+
                 |
                 v  Forwarded HTTP Request
      [ Upstream GraphQL Backend (:4001) ]
```

## 1. Pre-Execution AST Linting & APQ Pipeline

When an incoming query arrives at the proxy, GQLPulse runs static analysis before any backend database or network resources are consumed.

### Automated Persisted Queries (APQ)
Clients can submit an Apollo-compliant `extensions.persistedQuery.sha256Hash` parameter instead of a full query string:
- **Cache Lookup**: If the SHA-256 hash is cached in memory, the stored query AST is reconstructed and executed directly without payload parsing overhead.
- **Cache Miss**: Returns a `PersistedQueryNotFound` error code, prompting the client to transmit the full query text alongside the hash for registration.
- **Strict Safelist Mode**: When strict mode is activated, ad-hoc unregistered query texts are blocked completely, restricting production APIs to pre-approved frontend operations.

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

### Dual-Run DataLoader Simulator
The studio features an interactive benchmarking engine that executes unbatched and batched query variations side by side against sample schemas. It reports calculated database queries saved and latency reductions to prove DataLoader ROI before refactoring production code.

## 3. Security, Masking & Metrics

### Sensitive Response Field Masking
The proxy includes an integrated `ResponseDataMasker` that scans outbound GraphQL response dictionaries and masks sensitive fields before transmission:
- `REDACT`: Replaces content with `"[REDACTED]"`.
- `PARTIAL_EMAIL`: Masks usernames while retaining the domain (for example, `a***@example.com`).
- `HASH`: Produces a deterministic SHA-256 cryptographic digest.
- `NULL`: Sets the target field to `null`.

### Prometheus Metrics Exposition
The proxy exposes an OpenMetrics / Prometheus endpoint at `GET /metrics` containing:
- `gqlpulse_queries_total`: Intercepted request counter.
- `gqlpulse_blocked_queries_total`: Queries rejected by complexity or rate limits.
- `gqlpulse_n_plus_one_cascades_total`: Total detected unbatched resolver cascades.
- `gqlpulse_avg_latency_ms`: Rolling query duration in milliseconds.
- `gqlpulse_avg_complexity_score`: Rolling average query complexity.
- `gqlpulse_active_sse_clients`: Real-time studio subscribers.
- `gqlpulse_uptime_seconds`: Proxy uptime.

## 4. Schema Evolution & Client Traffic Correlation

GQLPulse includes a schema diffing engine built upon GraphQL type system introspection:
- **Breaking Changes**: Type removals, field deletions, changes to field nullability, additions of non-null arguments without defaults, and enum value removals.
- **Dangerous Changes**: Additions of `@deprecated` directives on active fields and changes to default argument values.
- **Safe Changes**: Newly added types, optional fields, optional arguments, and new enum values.

### Real-World Client Traffic Impact Correlation
In addition to static AST diffing, GQLPulse cross-references proposed breaking schema changes against in-memory query history. It computes:
- Total hits to deprecated or removed fields during the active session.
- Distinct client applications and IP addresses affected.
- Affected GraphQL operation names.
- Impact classifications (`HIGH_IMPACT`, `LOW_IMPACT`, `NO_IMPACT`) to prevent accidental breakages of mobile and partner clients.

### CI/CD PR Bot
The CLI `gqlpulse check` command integrates directly into GitHub Actions workflows. When run with `--github-comment`, it generates GitHub-flavored markdown tables alerting engineers to breaking modifications directly inside pull requests.
