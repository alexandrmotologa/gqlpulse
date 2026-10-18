import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SchemaDiffEngine } from '../schema/diff.js';

describe('SchemaDiffEngine', () => {
  const diffEngine = new SchemaDiffEngine();

  it('detects breaking changes when fields and types are removed', () => {
    const v1 = `
      type User {
        id: ID!
        email: String!
        legacyToken: String
      }

      type Post {
        id: ID!
        title: String!
      }

      type Query {
        user(id: ID!): User
        post(id: ID!): Post
      }
    `;

    const v2 = `
      type User {
        id: ID!
        email: String!
      }

      type Query {
        user(id: ID!): User
      }
    `;

    const result = diffEngine.diff(v1, v2);

    assert.strictEqual(result.hasBreakingChanges, true);
    assert.ok(result.breakingCount >= 2);

    // Removed field User.legacyToken
    const fieldRemoved = result.items.find((i) => i.code === 'FIELD_REMOVED' && i.path === 'User.legacyToken');
    assert.ok(fieldRemoved);
    assert.strictEqual(fieldRemoved.category, 'BREAKING');

    // Removed type Post
    const typeRemoved = result.items.find((i) => i.code === 'TYPE_REMOVED' && i.path === 'Post');
    assert.ok(typeRemoved);
    assert.strictEqual(typeRemoved.category, 'BREAKING');
  });

  it('detects safe additions', () => {
    const v1 = `
      type User {
        id: ID!
      }

      type Query {
        user(id: ID!): User
      }
    `;

    const v2 = `
      type User {
        id: ID!
        displayName: String
      }

      type Query {
        user(id: ID!): User
        searchUsers(query: String): [User!]!
      }
    `;

    const result = diffEngine.diff(v1, v2);

    assert.strictEqual(result.hasBreakingChanges, false);
    assert.strictEqual(result.breakingCount, 0);
    assert.ok(result.safeCount >= 2);
  });

  it('detects breaking required arguments added to existing fields', () => {
    const v1 = `
      type Query {
        posts: [String!]!
      }
    `;

    const v2 = `
      type Query {
        posts(mandatoryFilter: String!): [String!]!
      }
    `;

    const result = diffEngine.diff(v1, v2);

    assert.strictEqual(result.hasBreakingChanges, true);
    const reqArgAdded = result.items.find((i) => i.code === 'REQUIRED_ARG_ADDED');
    assert.ok(reqArgAdded);
    assert.strictEqual(reqArgAdded.category, 'BREAKING');
  });

  it('flags deprecated fields as dangerous notices', () => {
    const v1 = `
      type User {
        id: ID!
        bio: String
      }
      type Query {
        user: User
      }
    `;

    const v2 = `
      type User {
        id: ID!
        bio: String @deprecated(reason: "Use profileBio instead")
      }
      type Query {
        user: User
      }
    `;

    const result = diffEngine.diff(v1, v2);

    const dep = result.items.find((i) => i.code === 'FIELD_DEPRECATED');
    assert.ok(dep);
    assert.strictEqual(dep.category, 'DANGEROUS');
  });
});
