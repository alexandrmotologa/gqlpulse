import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ResolverProfiler } from '../profiler/n-plus-one.js';
import { ResolverSpan } from '../types.js';

describe('ResolverProfiler & N+1 Cascade Detector', () => {
  it('detects unbatched N+1 cascade when child resolver is invoked repeatedly', () => {
    const profiler = new ResolverProfiler();

    // Simulate 5 posts each calling Post.author individually
    const spans: ResolverSpan[] = [
      {
        path: ['posts'],
        parentType: 'Query',
        fieldName: 'posts',
        returnType: '[Post!]!',
        startOffsetUs: 100,
        durationUs: 25000,
        selfTimeUs: 25000,
      },
      ...Array.from({ length: 8 }).map((_, idx) => ({
        path: ['posts', idx, 'author'],
        parentType: 'Post',
        fieldName: 'author',
        returnType: 'User!',
        startOffsetUs: 2000 + idx * 3000,
        durationUs: 3500,
        selfTimeUs: 3500,
      })),
    ];

    const result = profiler.analyzeSpans(spans);

    assert.strictEqual(result.alerts.length, 1);
    const alert = result.alerts[0];
    assert.strictEqual(alert.signature, 'Post.author');
    assert.strictEqual(alert.occurrences, 8);
    assert.strictEqual(alert.parentType, 'Post');
    assert.strictEqual(alert.fieldName, 'author');
    assert.ok(alert.dataLoaderSnippet.includes('DataLoader'));
    assert.ok(alert.resolverFixSnippet.includes('authorLoader'));
  });

  it('calculates self time correctly subtracting direct child durations', () => {
    const profiler = new ResolverProfiler();

    const spans: ResolverSpan[] = [
      {
        path: ['user'],
        parentType: 'Query',
        fieldName: 'user',
        returnType: 'User',
        startOffsetUs: 0,
        durationUs: 20000,
        selfTimeUs: 0,
      },
      {
        path: ['user', 'profile'],
        parentType: 'User',
        fieldName: 'profile',
        returnType: 'Profile',
        startOffsetUs: 2000,
        durationUs: 12000,
        selfTimeUs: 0,
      },
    ];

    const result = profiler.analyzeSpans(spans);
    const userSpan = result.spansWithSelfTime.find((s) => s.fieldName === 'user');
    assert.ok(userSpan);
    // User total 20000us - profile 12000us = 8000us self time
    assert.strictEqual(userSpan.selfTimeUs, 8000);
  });
});
