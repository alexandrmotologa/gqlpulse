import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ResponseDataMasker } from '../security/masking.js';
import { SchemaImpactAnalyzer } from '../schema/impact.js';
import { SchemaDiffResult, WaterfallTrace } from '../types.js';

describe('ResponseDataMasker', () => {
  it('masks emails and sensitive tokens according to configured strategies', () => {
    const masker = new ResponseDataMasker([
      { fieldPattern: 'email', strategy: 'PARTIAL_EMAIL' },
      { fieldPattern: 'legacyToken', strategy: 'REDACT' },
      { fieldPattern: 'password', strategy: 'NULL' },
    ]);

    const payload = {
      users: [
        {
          id: 'u1',
          displayName: 'Alex Motologa',
          email: 'alex@example.com',
          legacyToken: 'super_secret_token_123',
          password: 'plain_password',
        },
      ],
    };

    const sanitized = masker.mask(payload);

    assert.strictEqual(sanitized.users[0].displayName, 'Alex Motologa');
    assert.strictEqual(sanitized.users[0].email, 'a***x@example.com');
    assert.strictEqual(sanitized.users[0].legacyToken, '[REDACTED]');
    assert.strictEqual(sanitized.users[0].password, null);
  });
});

describe('SchemaImpactAnalyzer', () => {
  it('correlates removed schema fields with queries in history', () => {
    const analyzer = new SchemaImpactAnalyzer();

    const mockDiff: SchemaDiffResult = {
      items: [
        {
          category: 'BREAKING',
          code: 'FIELD_REMOVED',
          path: 'User.legacyToken',
          description: "Field 'legacyToken' was removed from 'User'.",
        },
      ],
      breakingCount: 1,
      dangerousCount: 0,
      safeCount: 0,
      hasBreakingChanges: true,
      timestamp: Date.now(),
    };

    const mockTraces: WaterfallTrace[] = [
      {
        id: 't1',
        query: 'query { user { id email legacyToken } }',
        operationName: 'FetchToken',
        clientIp: '192.168.1.50',
        timestamp: Date.now(),
        totalDurationMs: 12,
        spans: [],
        nPlusOneAlerts: [],
        complexity: 5,
        depth: 2,
        status: 'SUCCESS',
      },
      {
        id: 't2',
        query: 'query { posts { id title } }',
        operationName: 'FetchPosts',
        clientIp: '192.168.1.99',
        timestamp: Date.now(),
        totalDurationMs: 8,
        spans: [],
        nPlusOneAlerts: [],
        complexity: 3,
        depth: 2,
        status: 'SUCCESS',
      },
    ];

    const impacts = analyzer.analyzeImpact(mockDiff, mockTraces);

    assert.strictEqual(impacts.length, 1);
    assert.strictEqual(impacts[0].schemaPath, 'User.legacyToken');
    assert.strictEqual(impacts[0].totalHitsInSession, 1);
    assert.ok(impacts[0].sampleClients.includes('192.168.1.50'));
    assert.ok(impacts[0].sampleOperations.includes('FetchToken'));
  });
});
