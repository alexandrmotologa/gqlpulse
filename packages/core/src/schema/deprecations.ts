import { GraphQLSchema, isObjectType, isInterfaceType, DocumentNode, visit, TypeInfo, visitWithTypeInfo, FieldNode } from 'graphql';
import { DeprecatedFieldUsage } from '../types.js';

export class DeprecationTracker {
  private schema?: GraphQLSchema;
  private deprecatedDefinitions = new Map<string, string>(); // path -> reason
  private usageStats = new Map<string, DeprecatedFieldUsage>();

  constructor(schema?: GraphQLSchema) {
    if (schema) {
      this.setSchema(schema);
    }
  }

  public setSchema(schema: GraphQLSchema): void {
    this.schema = schema;
    this.deprecatedDefinitions.clear();

    const typeMap = schema.getTypeMap();
    for (const [typeName, type] of Object.entries(typeMap)) {
      if (typeName.startsWith('__')) continue;

      if (isObjectType(type) || isInterfaceType(type)) {
        const fields = type.getFields();
        for (const [fieldName, field] of Object.entries(fields)) {
          if (field.deprecationReason) {
            const key = `${typeName}.${fieldName}`;
            this.deprecatedDefinitions.set(key, field.deprecationReason);
          }
        }
      }
    }
  }

  public inspectQuery(queryDoc: DocumentNode, clientIp = 'unknown'): string[] {
    if (!this.schema || this.deprecatedDefinitions.size === 0) return [];

    const typeInfo = new TypeInfo(this.schema);
    const hitFields: string[] = [];
    const now = Date.now();

    visit(
      queryDoc,
      visitWithTypeInfo(typeInfo, {
        Field: (node: FieldNode) => {
          const parentType = typeInfo.getParentType();
          if (!parentType) return;

          const key = `${parentType.name}.${node.name.value}`;
          const reason = this.deprecatedDefinitions.get(key);

          if (reason !== undefined) {
            hitFields.push(key);

            let usage = this.usageStats.get(key);
            if (!usage) {
              usage = {
                fieldPath: key,
                reason,
                hitCount: 0,
                lastSeenTimestamp: now,
                clients: [],
              };
              this.usageStats.set(key, usage);
            }

            usage.hitCount++;
            usage.lastSeenTimestamp = now;
            if (!usage.clients.includes(clientIp)) {
              usage.clients.push(clientIp);
              if (usage.clients.length > 20) usage.clients.shift(); // keep last 20 clients
            }
          }
        },
      })
    );

    return hitFields;
  }

  public getStats(): DeprecatedFieldUsage[] {
    return Array.from(this.usageStats.values()).sort((a, b) => b.hitCount - a.hitCount);
  }

  public getKnownDeprecatedFields(): Array<{ fieldPath: string; reason: string }> {
    return Array.from(this.deprecatedDefinitions.entries()).map(([fieldPath, reason]) => ({
      fieldPath,
      reason,
    }));
  }
}
