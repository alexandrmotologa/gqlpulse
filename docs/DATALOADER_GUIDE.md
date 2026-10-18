# Resolving GraphQL N+1 Cascades with DataLoader

The N+1 problem occurs when a parent GraphQL resolver returns a collection of items, and child resolvers trigger separate database queries for each child record.

## Example Scenario

Consider this query:
```graphql
query {
  posts(first: 10) {
    id
    title
    author {
      id
      name
    }
  }
}
```

Without batching, execution proceeds as follows:
1. `Query.posts` executes once, fetching 10 posts.
2. For each post, the `Post.author` resolver triggers an individual query:
   ```sql
   SELECT * FROM users WHERE id = 'u1';
   SELECT * FROM users WHERE id = 'u2';
   ...
   SELECT * FROM users WHERE id = 'u10';
   ```
Total: 1 query for posts + 10 queries for authors = 11 queries.

## The DataLoader Solution

DataLoader batches multiple individual requests made within a single tick of the Node.js event loop into a single consolidated request.

### 1. Defining the Batch Loader

Create a loader function per entity or relationship:

```typescript
import DataLoader from 'dataloader';
import { DatabaseClient, User } from './db';

export function createUserLoader(db: DatabaseClient) {
  return new DataLoader<string, User>(async (userIds: readonly string[]) => {
    // Single consolidated SQL query
    const users = await db.user.findMany({
      where: {
        id: { in: [...userIds] },
      },
    });

    // Map rows back to the order of requested keys
    const userMap = new Map(users.map((u) => [u.id, u]));
    return userIds.map((id) => userMap.get(id) || null);
  }, {
    cache: true,
    maxBatchSize: 100,
  });
}
```

### 2. Attaching Loaders to Request Context

Instantiate fresh DataLoader instances for every incoming HTTP request. Sharing DataLoader instances across multiple user requests can cause security cross-talk or stale cached data:

```typescript
export interface AppContext {
  loaders: {
    userLoader: ReturnType<typeof createUserLoader>;
  };
}

// In your HTTP server handler (e.g. Yoga, Apollo, or Fastify):
const context = ({ req }) => ({
  loaders: {
    userLoader: createUserLoader(db),
  },
});
```

### 3. Updating Child Resolvers

Replace individual database calls with `loaders.userLoader.load`:

```typescript
export const resolvers = {
  Post: {
    author: async (post, _, context: AppContext) => {
      if (!post.authorId) return null;
      return context.loaders.userLoader.load(post.authorId);
    },
  },
};
```

## Key Invariants

1. **Array Length Consistency**: The batch function must resolve an array of identical length to the input keys array.
2. **Order Preservation**: The items in the returned array must correspond exactly to the indices of the input keys.
3. **Instance Lifecycle**: Always create new DataLoader instances per request context to isolate caching between users.
