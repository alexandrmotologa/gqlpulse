export interface UserRecord {
  id: string;
  username: string;
  email: string;
  displayName: string;
  bio: string;
  profileBio?: string;
  role: string;
  legacyToken?: string;
}

export interface PostRecord {
  id: string;
  authorId: string;
  title: string;
  slug: string;
  content: string;
  publishedAt: string;
  tags: string[];
}

export interface CommentRecord {
  id: string;
  postId: string;
  authorId: string;
  text: string;
  createdAt: string;
}

export interface ProductRecord {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  sku: string;
  stock: number;
}

export interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
}

export interface ReviewRecord {
  id: string;
  userId: string;
  productId: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface OrderItemRecord {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface OrderRecord {
  id: string;
  userId: string;
  orderNumber: string;
  total: number;
  status: 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  createdAt: string;
}

export const USERS: UserRecord[] = [
  { id: 'u1', username: 'alex', email: 'alex@example.com', displayName: 'Alex Motologa', bio: 'Founder & Software Architect', profileBio: 'Founder & Software Architect specializing in distributed systems and devtools.', role: 'ADMIN', legacyToken: 'tok_01' },
  { id: 'u2', username: 'elena', email: 'elena@example.com', displayName: 'Elena Rostova', bio: 'Senior Frontend Engineer', profileBio: 'Senior Frontend Engineer with deep expertise in React 19 & WebGL.', role: 'USER', legacyToken: 'tok_02' },
  { id: 'u3', username: 'marcus', email: 'marcus@example.com', displayName: 'Marcus Vance', bio: 'Backend Core Tech Lead', profileBio: 'Backend Core Tech Lead building high-throughput GraphQL APIs.', role: 'USER', legacyToken: 'tok_03' },
  { id: 'u4', username: 'sophia', email: 'sophia@example.com', displayName: 'Sophia Chen', bio: 'Cloud & Kubernetes SRE', profileBio: 'Cloud & Kubernetes SRE optimizing cluster topologies.', role: 'USER', legacyToken: 'tok_04' },
  { id: 'u5', username: 'david', email: 'david@example.com', displayName: 'David Miller', bio: 'Database Systems Specialist', profileBio: 'Database Systems Specialist diving into PostgreSQL internals.', role: 'USER', legacyToken: 'tok_05' },
  { id: 'u6', username: 'maya', email: 'maya@example.com', displayName: 'Maya Patel', bio: 'Security Researcher', profileBio: 'Security Researcher focusing on API defense and pen testing.', role: 'USER', legacyToken: 'tok_06' },
  { id: 'u7', username: 'lucas', email: 'lucas@example.com', displayName: 'Lucas Silva', bio: 'Mobile App Developer', profileBio: 'Mobile App Developer crafting fluid iOS & Android experiences.', role: 'USER', legacyToken: 'tok_07' },
  { id: 'u8', username: 'chloe', email: 'chloe@example.com', displayName: 'Chloe Dubois', bio: 'UX/UI Designer', profileBio: 'Product Designer obsessed with crisp typography & micro-interactions.', role: 'USER', legacyToken: 'tok_08' },
];

export const POSTS: PostRecord[] = [
  { id: 'p1', authorId: 'u1', title: 'Eliminating N+1 Cascades in Modern GraphQL APIs', slug: 'eliminating-n1-graphql', content: 'GraphQL resolvers without DataLoader can silently degrade database throughput.', publishedAt: '2026-03-01T10:00:00Z', tags: ['graphql', 'performance', 'architecture'] },
  { id: 'p2', authorId: 'u2', title: 'React 19 Server Components and Data Fetching Paradigms', slug: 'react-19-server-components', content: 'Exploring asynchronous rendering pipelines and streaming hydration.', publishedAt: '2026-03-05T14:30:00Z', tags: ['react', 'frontend', 'javascript'] },
  { id: 'p3', authorId: 'u3', title: 'High-Throughput Node.js Reverse Proxy Architecture', slug: 'nodejs-reverse-proxy', content: 'Designing zero-copy streaming buffers and AST parsing caches.', publishedAt: '2026-03-10T09:15:00Z', tags: ['nodejs', 'proxy', 'systems'] },
  { id: 'p4', authorId: 'u1', title: 'Preventing GraphQL Denial of Service Attacks', slug: 'graphql-dos-prevention', content: 'How static query complexity analysis blocks deep recursive queries before DB hit.', publishedAt: '2026-03-12T16:00:00Z', tags: ['security', 'graphql', 'dos'] },
  { id: 'p5', authorId: 'u4', title: 'Kubernetes Pod Autoscaling for Ephemeral Bursts', slug: 'k8s-pod-autoscaling', content: 'Configuring KEDA metrics for GraphQL proxy traffic spikes.', publishedAt: '2026-03-15T11:45:00Z', tags: ['devops', 'kubernetes', 'cloud'] },
  { id: 'p6', authorId: 'u5', title: 'PostgreSQL Index Strategies for Joins and Filters', slug: 'postgres-index-strategies', content: 'Comparing B-tree, GiST, and partial indexes on relational data.', publishedAt: '2026-03-18T13:20:00Z', tags: ['database', 'postgres', 'sql'] },
  { id: 'p7', authorId: 'u2', title: 'Tailwind CSS v4 Engine and CSS Variable Theming', slug: 'tailwind-css-v4-theming', content: 'Deep dive into standard CSS cascade layers and lightningcss engine.', publishedAt: '2026-03-22T08:00:00Z', tags: ['css', 'tailwind', 'design'] },
  { id: 'p8', authorId: 'u6', title: 'Securing Introspection in Production Endpoints', slug: 'securing-introspection-endpoints', content: 'Why public schema introspection leaks internal models and defense patterns.', publishedAt: '2026-03-25T15:30:00Z', tags: ['security', 'graphql', 'auditing'] },
];

export const COMMENTS: CommentRecord[] = [
  { id: 'c1', postId: 'p1', authorId: 'u3', text: 'DataLoader truly changed how we batch SQL joins on parent records.', createdAt: '2026-03-01T12:00:00Z' },
  { id: 'c2', postId: 'p1', authorId: 'u5', text: 'The N+1 problem is easily overlooked until traffic surges 10x.', createdAt: '2026-03-01T13:22:00Z' },
  { id: 'c3', postId: 'p1', authorId: 'u2', text: 'Great writeup! Visual waterfall tools make debugging so much faster.', createdAt: '2026-03-01T14:45:00Z' },
  { id: 'c4', postId: 'p2', authorId: 'u1', text: 'Streaming SSR works wonderfully when resolvers are unblocked.', createdAt: '2026-03-05T16:10:00Z' },
  { id: 'c5', postId: 'p3', authorId: 'u4', text: 'Fastify proxy latency benchmarks are impressive here.', createdAt: '2026-03-10T11:00:00Z' },
  { id: 'c6', postId: 'p4', authorId: 'u6', text: 'Static AST complexity scoring stops cyclic graph queries cold.', createdAt: '2026-03-12T17:30:00Z' },
  { id: 'c7', postId: 'p5', authorId: 'u3', text: 'We scaled our ingress pods using custom QPS metrics.', createdAt: '2026-03-15T13:00:00Z' },
  { id: 'c8', postId: 'p6', authorId: 'u1', text: 'EXPLAIN ANALYZE combined with resolver profiler pinpoints the exact table.', createdAt: '2026-03-18T15:10:00Z' },
];

export const CATEGORIES: CategoryRecord[] = [
  { id: 'cat1', name: 'Developer Hardware', slug: 'hardware' },
  { id: 'cat2', name: 'Ergonomic Furniture', slug: 'ergonomics' },
  { id: 'cat3', name: 'Audio & Acoustics', slug: 'audio' },
];

export const PRODUCTS: ProductRecord[] = [
  { id: 'prd1', categoryId: 'cat1', name: 'PulseKey Split Mechanical Keyboard', description: 'Custom mechanical keyboard with QMK firmware and hot-swappable switches.', price: 289.0, sku: 'PK-SPLIT-01', stock: 42 },
  { id: 'prd2', categoryId: 'cat1', name: 'UltraSharp 40-inch 5K Curved Monitor', description: 'Curved Thunderbolt display for code and observability dashboards.', price: 1499.0, sku: 'MON-5K-40', stock: 15 },
  { id: 'prd3', categoryId: 'cat2', name: 'AeroMotion Motorized Standing Desk', description: 'Solid walnut top with dual electric motors and anti-collision sensor.', price: 799.0, sku: 'DESK-MOT-02', stock: 20 },
  { id: 'prd4', categoryId: 'cat3', name: 'Acoustic Studio Studio Monitor Headphones', description: 'Planar magnetic studio reference headphones for deep focus sessions.', price: 349.0, sku: 'AUD-REF-30', stock: 35 },
];

export const REVIEWS: ReviewRecord[] = [
  { id: 'rev1', userId: 'u1', productId: 'prd1', rating: 5, comment: 'Incredible tactile feedback. Boosted typing speed without wrist fatigue.', createdAt: '2026-02-10T09:00:00Z' },
  { id: 'rev2', userId: 'u2', productId: 'prd2', rating: 5, comment: 'Screen real estate is huge. Can view GraphQL schema and flamegraphs side-by-side.', createdAt: '2026-02-14T11:30:00Z' },
  { id: 'rev3', userId: 'u3', productId: 'prd1', rating: 4, comment: 'High quality build, took 2 days to adjust to the split layout.', createdAt: '2026-02-20T14:15:00Z' },
];

export const ORDERS: OrderRecord[] = [
  { id: 'ord1', userId: 'u1', orderNumber: 'ORD-2026-901', total: 1788.0, status: 'DELIVERED', createdAt: '2026-02-12T10:00:00Z' },
  { id: 'ord2', userId: 'u2', orderNumber: 'ORD-2026-902', total: 638.0, status: 'SHIPPED', createdAt: '2026-03-01T15:20:00Z' },
  { id: 'ord3', userId: 'u3', orderNumber: 'ORD-2026-903', total: 289.0, status: 'PROCESSING', createdAt: '2026-03-14T18:40:00Z' },
];

export const ORDER_ITEMS: OrderItemRecord[] = [
  { id: 'item1', orderId: 'ord1', productId: 'prd1', quantity: 1, unitPrice: 289.0 },
  { id: 'item2', orderId: 'ord1', productId: 'prd2', quantity: 1, unitPrice: 1499.0 },
  { id: 'item3', orderId: 'ord2', productId: 'prd4', quantity: 1, unitPrice: 349.0 },
  { id: 'item4', orderId: 'ord2', productId: 'prd1', quantity: 1, unitPrice: 289.0 },
  { id: 'item5', orderId: 'ord3', productId: 'prd1', quantity: 1, unitPrice: 289.0 },
];

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
