import { describe, it } from 'node:test';
import assert from 'node:assert';
import { buildSchema } from 'graphql';
import { QueryComplexityCalculator } from '../complexity/calculator.js';

describe('QueryComplexityCalculator', () => {
  const schema = buildSchema(`
    type User {
      id: ID!
      name: String!
      posts(first: Int): [Post!]!
    }

    type Post {
      id: ID!
      title: String!
      author: User!
      comments(limit: Int): [Comment!]!
    }

    type Comment {
      id: ID!
      text: String!
      author: User!
    }

    type Query {
      users(first: Int): [User!]!
      post(id: ID!): Post
      ping: String!
    }
  `);

  it('calculates flat scalar query complexity correctly', () => {
    const calc = new QueryComplexityCalculator({}, schema);
    const result = calc.analyze(`
      query {
        ping
      }
    `);

    assert.strictEqual(result.depth, 1);
    assert.strictEqual(result.complexity, 1); // 1 scalar
    assert.strictEqual(result.isBlocked, false);
    assert.strictEqual(result.violations.length, 0);
  });

  it('calculates nested object complexity with default list multipliers', () => {
    const calc = new QueryComplexityCalculator({
      scalarCost: 1,
      objectCost: 2,
      defaultListMultiplier: 10,
    }, schema);

    const result = calc.analyze(`
      query {
        users {
          id
          name
        }
      }
    `);

    // users is object (2), returns list -> children have multiplier 10
    // id (1 * 10) + name (1 * 10) = 20
    // total = 2 + 20 = 22
    assert.strictEqual(result.complexity, 22);
    assert.strictEqual(result.depth, 2);
  });

  it('respects explicit list arguments (e.g. first: 5)', () => {
    const calc = new QueryComplexityCalculator({
      scalarCost: 1,
      objectCost: 2,
    }, schema);

    const result = calc.analyze(`
      query {
        users(first: 5) {
          id
          name
        }
      }
    `);

    // users object (2), multiplier 5 -> id (5) + name (5) = 12
    assert.strictEqual(result.complexity, 12);
  });

  it('detects and blocks queries exceeding maxComplexity', () => {
    const calc = new QueryComplexityCalculator({
      maxComplexity: 50,
      defaultListMultiplier: 10,
    }, schema);

    const result = calc.analyze(`
      query {
        users(first: 10) {
          posts(first: 10) {
            id
            title
            comments(limit: 5) {
              id
              text
            }
          }
        }
      }
    `);

    assert.strictEqual(result.isBlocked, true);
    assert.ok(result.complexity > 50);
    assert.ok(result.violations.some((v) => v.type === 'MAX_COMPLEXITY'));
  });

  it('detects and blocks queries exceeding maxDepth', () => {
    const calc = new QueryComplexityCalculator({
      maxDepth: 3,
    }, schema);

    const result = calc.analyze(`
      query {
        users {
          posts {
            comments {
              author {
                name
              }
            }
          }
        }
      }
    `);

    assert.strictEqual(result.isBlocked, true);
    assert.ok(result.depth >= 4);
    assert.ok(result.violations.some((v) => v.type === 'MAX_DEPTH'));
  });

  it('detects cyclic recursion patterns', () => {
    const calc = new QueryComplexityCalculator({}, schema);

    const result = calc.analyze(`
      query {
        users {
          posts {
            author {
              posts {
                author {
                  posts {
                    id
                  }
                }
              }
            }
          }
        }
      }
    `);

    assert.ok(result.cyclicPaths.length > 0);
    assert.strictEqual(result.isBlocked, true);
    assert.ok(result.violations.some((v) => v.type === 'CYCLIC_QUERY'));
  });

  it('detects introspection queries', () => {
    const calc = new QueryComplexityCalculator({ blockIntrospection: true }, schema);

    const result = calc.analyze(`
      query {
        __schema {
          types {
            name
          }
        }
      }
    `);

    assert.strictEqual(result.isIntrospection, true);
    assert.strictEqual(result.isBlocked, true);
    assert.ok(result.violations.some((v) => v.type === 'INTROSPECTION_BLOCKED'));
  });
});
