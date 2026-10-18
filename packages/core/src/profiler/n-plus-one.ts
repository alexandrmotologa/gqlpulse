import { ResolverSpan, NPlusOneAlert } from '../types.js';
import { generateDataLoaderFix } from './dataloader-generator.js';

export interface ProfilerAnalysisResult {
  alerts: NPlusOneAlert[];
  spansWithSelfTime: ResolverSpan[];
  totalSpans: number;
  totalDurationUs: number;
  maxSpanDepth: number;
  slowestResolvers: ResolverSpan[];
}

export class ResolverProfiler {
  /**
   * Analyzes an array of raw resolver spans, calculates self time,
   * detects N+1 cascades, and generates DataLoader remediation code.
   */
  public analyzeSpans(rawSpans: ResolverSpan[]): ProfilerAnalysisResult {
    if (!rawSpans || rawSpans.length === 0) {
      return {
        alerts: [],
        spansWithSelfTime: [],
        totalSpans: 0,
        totalDurationUs: 0,
        maxSpanDepth: 0,
        slowestResolvers: [],
      };
    }

    // 1. Calculate self time and depths
    let maxDepth = 0;
    let totalDurationUs = 0;

    const spans: ResolverSpan[] = rawSpans.map((span) => {
      const depth = span.path.length;
      if (depth > maxDepth) maxDepth = depth;
      if (span.durationUs > totalDurationUs) totalDurationUs = span.durationUs;

      return {
        ...span,
        selfTimeUs: span.durationUs, // will adjust below
      };
    });

    // Adjust self time: span.selfTimeUs = span.durationUs - sum(direct children duration)
    for (let i = 0; i < spans.length; i++) {
      const current = spans[i];
      let childrenDuration = 0;

      for (let j = 0; j < spans.length; j++) {
        if (i === j) continue;
        const other = spans[j];
        if (this.isDirectChild(current.path, other.path)) {
          childrenDuration += other.durationUs;
        }
      }

      current.selfTimeUs = Math.max(0, current.durationUs - childrenDuration);
    }

    // 2. Group spans by signature: ParentType.fieldName
    const signatureGroups = new Map<string, ResolverSpan[]>();

    for (const span of spans) {
      if (!span.parentType || !span.fieldName) continue;
      // Skip top-level operations
      if (span.parentType === 'Query' || span.parentType === 'Mutation' || span.parentType === 'Subscription') {
        continue;
      }

      const sig = `${span.parentType}.${span.fieldName}`;
      const group = signatureGroups.get(sig) || [];
      group.push(span);
      signatureGroups.set(sig, group);
    }

    // 3. Detect N+1 cascade patterns
    const alerts: NPlusOneAlert[] = [];

    for (const [signature, group] of signatureGroups.entries()) {
      const occurrences = group.length;

      // If a child resolver is invoked repeatedly (> 2 times in the same query),
      // investigate if it represents an unbatched N+1 waterfall
      if (occurrences >= 3) {
        const first = group[0];
        const totalDuration = group.reduce((sum, s) => sum + s.durationUs, 0);
        const avgDuration = Math.round(totalDuration / occurrences);

        // Calculate severity
        let severity: 'CRITICAL' | 'WARNING' | 'INFO' = 'INFO';
        if (occurrences >= 10 || totalDuration > 50000) {
          severity = 'CRITICAL';
        } else if (occurrences >= 4 || totalDuration > 15000) {
          severity = 'WARNING';
        }

        const fix = generateDataLoaderFix(first.parentType, first.fieldName);

        alerts.push({
          id: `n1-${signature.replace('.', '-')}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          parentType: first.parentType,
          fieldName: first.fieldName,
          signature,
          occurrences,
          parentCount: occurrences,
          totalDurationUs: totalDuration,
          averageDurationUs: avgDuration,
          severity,
          message: `N+1 Cascade: ${signature} was executed ${occurrences} times sequentially, adding ${(totalDuration / 1000).toFixed(2)}ms latency.`,
          dataLoaderSnippet: fix.batchFunctionCode,
          resolverFixSnippet: fix.refactoredResolverCode,
        });
      }
    }

    // Sort slowest resolvers
    const slowestResolvers = [...spans].sort((a, b) => b.durationUs - a.durationUs).slice(0, 10);

    return {
      alerts: alerts.sort((a, b) => b.totalDurationUs - a.totalDurationUs),
      spansWithSelfTime: spans,
      totalSpans: spans.length,
      totalDurationUs,
      maxSpanDepth: maxDepth,
      slowestResolvers,
    };
  }

  private isDirectChild(parentPath: (string | number)[], childPath: (string | number)[]): boolean {
    if (childPath.length !== parentPath.length + 1 && childPath.length !== parentPath.length + 2) {
      return false;
    }
    for (let i = 0; i < parentPath.length; i++) {
      if (parentPath[i] !== childPath[i]) {
        return false;
      }
    }
    return true;
  }
}
