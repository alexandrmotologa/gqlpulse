import DataLoader from 'dataloader';
import {
  USERS,
  POSTS,
  COMMENTS,
  PRODUCTS,
  CATEGORIES,
  REVIEWS,
  ORDERS,
  ORDER_ITEMS,
  UserRecord,
  PostRecord,
  CommentRecord,
  ProductRecord,
  CategoryRecord,
  sleep,
} from './db.js';
import { ResolverSpan } from '@gqlpulse/core';

export interface GraphQLContext {
  isDataLoaderMode: boolean;
  startTimeUs: number;
  spans: ResolverSpan[];
  loaders: {
    userLoader: DataLoader<string, UserRecord | undefined>;
    categoryLoader: DataLoader<string, CategoryRecord | undefined>;
    productLoader: DataLoader<string, ProductRecord | undefined>;
  };
}

export function createDataLoaders(): GraphQLContext['loaders'] {
  const userLoader = new DataLoader<string, UserRecord | undefined>(async (keys: readonly string[]) => {
    // Single simulated batch SQL query: SELECT * FROM users WHERE id IN (...)
    await sleep(4);
    const map = new Map(USERS.map((u) => [u.id, u]));
    return keys.map((k: string) => map.get(k));
  });

  const categoryLoader = new DataLoader<string, CategoryRecord | undefined>(async (keys: readonly string[]) => {
    await sleep(3);
    const map = new Map(CATEGORIES.map((c) => [c.id, c]));
    return keys.map((k: string) => map.get(k));
  });

  const productLoader = new DataLoader<string, ProductRecord | undefined>(async (keys: readonly string[]) => {
    await sleep(3);
    const map = new Map(PRODUCTS.map((p) => [p.id, p]));
    return keys.map((k: string) => map.get(k));
  });

  return {
    userLoader,
    categoryLoader,
    productLoader,
  };
}

export function traceResolver<TResult>(
  parentType: string,
  fieldName: string,
  returnType: string,
  fn: (parent: any, args: any, context: GraphQLContext, info: any) => Promise<TResult> | TResult
) {
  return async (parent: any, args: any, context: GraphQLContext, info: any): Promise<TResult> => {
    const startUs = Math.round(performance.now() * 1000);
    const offsetUs = context.startTimeUs ? startUs - context.startTimeUs : 0;

    try {
      const result = await fn(parent, args, context, info);
      const endUs = Math.round(performance.now() * 1000);
      const durationUs = Math.max(1, endUs - startUs);

      const pathArray = info.path ? pathToArray(info.path) : [fieldName];

      if (context.spans) {
        context.spans.push({
          path: pathArray,
          parentType,
          fieldName,
          returnType,
          startOffsetUs: offsetUs,
          durationUs,
          selfTimeUs: durationUs,
        });
      }

      return result;
    } catch (err) {
      throw err;
    }
  };
}

function pathToArray(pathObj: any): (string | number)[] {
  const arr: (string | number)[] = [];
  let curr = pathObj;
  while (curr) {
    arr.unshift(curr.key);
    curr = curr.prev;
  }
  return arr;
}

export function bindResolversToSchema(schema: any, resolversMap: Record<string, Record<string, any>>): void {
  for (const [typeName, fields] of Object.entries(resolversMap)) {
    const type = schema.getType(typeName);
    if (type && typeof type.getFields === 'function') {
      const typeFields = type.getFields();
      for (const [fieldName, resolverFn] of Object.entries(fields)) {
        if (typeFields[fieldName]) {
          typeFields[fieldName].resolve = resolverFn;
        }
      }
    }
  }
}

export const resolvers = {
  Query: {
    users: traceResolver('Query', 'users', '[User!]!', async (_, { first }) => {
      await sleep(5);
      return first ? USERS.slice(0, first) : USERS;
    }),
    user: traceResolver('Query', 'user', 'User', async (_, { id }) => {
      await sleep(3);
      return USERS.find((u) => u.id === id) || null;
    }),
    posts: traceResolver('Query', 'posts', '[Post!]!', async (_, { first, search }) => {
      await sleep(6);
      let list = POSTS;
      if (search) {
        list = list.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()));
      }
      return first ? list.slice(0, first) : list;
    }),
    post: traceResolver('Query', 'post', 'Post', async (_, { id }) => {
      await sleep(3);
      return POSTS.find((p) => p.id === id) || null;
    }),
    products: traceResolver('Query', 'products', '[Product!]!', async (_, { first }) => {
      await sleep(4);
      return first ? PRODUCTS.slice(0, first) : PRODUCTS;
    }),
    product: traceResolver('Query', 'product', 'Product', async (_, { id }) => {
      await sleep(3);
      return PRODUCTS.find((p) => p.id === id) || null;
    }),
    categories: traceResolver('Query', 'categories', '[Category!]!', async () => {
      await sleep(3);
      return CATEGORIES;
    }),
    orders: traceResolver('Query', 'orders', '[Order!]!', async () => {
      await sleep(5);
      return ORDERS;
    }),
    searchOrders: traceResolver('Query', 'searchOrders', '[Order!]!', async (_, { status }) => {
      await sleep(5);
      return ORDERS.filter((o) => o.status === status);
    }),
    serverHealth: traceResolver('Query', 'serverHealth', 'String!', () => 'GQLPulse Demo Backend OK'),
  },

  User: {
    posts: traceResolver('User', 'posts', '[Post!]!', async (user: UserRecord, { limit }) => {
      await sleep(2);
      const list = POSTS.filter((p) => p.authorId === user.id);
      return limit ? list.slice(0, limit) : list;
    }),
    orders: traceResolver('User', 'orders', '[Order!]!', async (user: UserRecord) => {
      await sleep(3);
      return ORDERS.filter((o) => o.userId === user.id);
    }),
    reviews: traceResolver('User', 'reviews', '[Review!]!', async (user: UserRecord) => {
      await sleep(2);
      return REVIEWS.filter((r) => r.userId === user.id);
    }),
  },

  Post: {
    author: traceResolver('Post', 'author', 'User!', async (post: PostRecord, _, context) => {
      if (context.isDataLoaderMode) {
        return context.loaders.userLoader.load(post.authorId);
      }
      // Intentional N+1 unbatched cascade
      await sleep(4);
      return USERS.find((u) => u.id === post.authorId);
    }),
    comments: traceResolver('Post', 'comments', '[Comment!]!', async (post: PostRecord, { limit }) => {
      await sleep(2);
      const list = COMMENTS.filter((c) => c.postId === post.id);
      return limit ? list.slice(0, limit) : list;
    }),
  },

  Comment: {
    author: traceResolver('Comment', 'author', 'User!', async (comment: CommentRecord, _, context) => {
      if (context.isDataLoaderMode) {
        return context.loaders.userLoader.load(comment.authorId);
      }
      // Intentional N+1 unbatched cascade
      await sleep(3);
      return USERS.find((u) => u.id === comment.authorId);
    }),
    post: traceResolver('Comment', 'post', 'Post!', async (comment: CommentRecord) => {
      await sleep(2);
      return POSTS.find((p) => p.id === comment.postId);
    }),
  },

  Product: {
    category: traceResolver('Product', 'category', 'Category!', async (product: ProductRecord, _, context) => {
      if (context.isDataLoaderMode) {
        return context.loaders.categoryLoader.load(product.categoryId);
      }
      await sleep(3);
      return CATEGORIES.find((c) => c.id === product.categoryId);
    }),
    reviews: traceResolver('Product', 'reviews', '[Review!]!', async (product: ProductRecord) => {
      await sleep(2);
      return REVIEWS.filter((r) => r.productId === product.id);
    }),
  },

  Category: {
    products: traceResolver('Category', 'products', '[Product!]!', async (category: CategoryRecord, { limit }) => {
      await sleep(3);
      const list = PRODUCTS.filter((p) => p.categoryId === category.id);
      return limit ? list.slice(0, limit) : list;
    }),
  },

  Review: {
    user: traceResolver('Review', 'user', 'User!', async (review, _, context) => {
      if (context.isDataLoaderMode) {
        return context.loaders.userLoader.load(review.userId);
      }
      await sleep(3);
      return USERS.find((u) => u.id === review.userId);
    }),
    product: traceResolver('Review', 'product', 'Product!', async (review, _, context) => {
      if (context.isDataLoaderMode) {
        return context.loaders.productLoader.load(review.productId);
      }
      await sleep(3);
      return PRODUCTS.find((p) => p.id === review.productId);
    }),
  },

  Order: {
    user: traceResolver('Order', 'user', 'User!', async (order, _, context) => {
      if (context.isDataLoaderMode) {
        return context.loaders.userLoader.load(order.userId);
      }
      await sleep(3);
      return USERS.find((u) => u.id === order.userId);
    }),
    items: traceResolver('Order', 'items', '[OrderItem!]!', async (order) => {
      await sleep(2);
      return ORDER_ITEMS.filter((item) => item.orderId === order.id);
    }),
  },

  OrderItem: {
    product: traceResolver('OrderItem', 'product', 'Product!', async (item, _, context) => {
      if (context.isDataLoaderMode) {
        return context.loaders.productLoader.load(item.productId);
      }
      await sleep(3);
      return PRODUCTS.find((p) => p.id === item.productId);
    }),
  },

  Mutation: {
    createPost: async (_: any, { input }: any) => {
      const newPost: PostRecord = {
        id: `p${POSTS.length + 1}`,
        authorId: input.authorId,
        title: input.title,
        slug: input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        content: input.content,
        publishedAt: new Date().toISOString(),
        tags: input.tags || [],
      };
      POSTS.push(newPost);
      return newPost;
    },
    addComment: async (_: any, { postId, authorId, text }: any) => {
      const newComment: CommentRecord = {
        id: `c${COMMENTS.length + 1}`,
        postId,
        authorId,
        text,
        createdAt: new Date().toISOString(),
      };
      COMMENTS.push(newComment);
      return newComment;
    },
  },
};
