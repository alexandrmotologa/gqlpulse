/**
 * DataLoader Code Generator for GQLPulse
 * Generates ready-to-paste TypeScript DataLoader implementations and resolver refactors.
 */

export interface DataLoaderSuggestion {
  loaderName: string;
  keyType: string;
  returnType: string;
  batchFunctionCode: string;
  refactoredResolverCode: string;
  explanation: string;
}

export function generateDataLoaderFix(parentType: string, fieldName: string): DataLoaderSuggestion {
  const returnTypeName = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
  const parentParam = parentType.toLowerCase();
  const loaderName = `${fieldName}Loader`;

  const batchFunctionCode = `import DataLoader from 'dataloader';

// 1. Define the batch loading function
export const create${loaderName.charAt(0).toUpperCase() + loaderName.slice(1)} = (db: DatabaseClient) => {
  return new DataLoader<string, ${returnTypeName}>(async (keys: readonly string[]) => {
    // Single batched SQL/ORM query replacing N individual queries:
    // SELECT * FROM ${fieldName}s WHERE id IN (...)
    const rows = await db.${fieldName}.findMany({
      where: {
        id: { in: [...keys] },
      },
    });

    // Map results back to the requested keys preserving exact order
    const map = new Map(rows.map(item => [item.id, item]));
    return keys.map(key => map.get(key) || null);
  }, {
    // Optional caching & batch scheduling configuration
    cache: true,
    maxBatchSize: 100,
  });
};`;

  const refactoredResolverCode = `// 2. Refactored ${parentType}.${fieldName} resolver:
export const resolvers = {
  ${parentType}: {
    // BEFORE (N+1 cascade: individual fetch per item):
    // ${fieldName}: async (${parentParam}, _, { db }) => {
    //   return db.${fieldName}.findUnique({ where: { id: ${parentParam}.${fieldName}Id } });
    // },

    // AFTER (Batched via DataLoader in 1 single roundtrip):
    ${fieldName}: async (${parentParam}, _, { loaders }) => {
      if (!${parentParam}.${fieldName}Id) return null;
      return loaders.${loaderName}.load(${parentParam}.${fieldName}Id);
    },
  },
};`;

  const explanation = `Replace individual database queries in ${parentType}.${fieldName} with a batched DataLoader call. This collapses N queries into a single query using 'IN (...)' or batch fetch, reducing latency by up to 90%.`;

  return {
    loaderName,
    keyType: 'string',
    returnType: returnTypeName,
    batchFunctionCode,
    refactoredResolverCode,
    explanation,
  };
}
