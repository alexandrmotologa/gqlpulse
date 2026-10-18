import {
  buildSchema,
  GraphQLSchema,
  isObjectType,
  isInterfaceType,
  isUnionType,
  isEnumType,
  isInputObjectType,
  isScalarType,
  GraphQLNamedType,
  GraphQLField,
  GraphQLInputField,
  GraphQLArgument,
  isNonNullType,
  isListType,
  getNamedType,
} from 'graphql';
import { SchemaDiffItem, SchemaDiffResult } from '../types.js';

export class SchemaDiffEngine {
  /**
   * Compares two GraphQL schemas (as schema strings or GraphQLSchema instances)
   * and returns a detailed report of BREAKING, DANGEROUS, and SAFE changes.
   */
  public diff(oldSchemaOrStr: string | GraphQLSchema, newSchemaOrStr: string | GraphQLSchema): SchemaDiffResult {
    const oldSchema = typeof oldSchemaOrStr === 'string' ? buildSchema(oldSchemaOrStr) : oldSchemaOrStr;
    const newSchema = typeof newSchemaOrStr === 'string' ? buildSchema(newSchemaOrStr) : newSchemaOrStr;

    const items: SchemaDiffItem[] = [];

    const oldTypeMap = oldSchema.getTypeMap();
    const newTypeMap = newSchema.getTypeMap();

    // Check for removed or modified types
    for (const [typeName, oldType] of Object.entries(oldTypeMap)) {
      if (typeName.startsWith('__')) continue; // Skip built-in introspection types

      const newType = newTypeMap[typeName];

      if (!newType) {
        items.push({
          category: 'BREAKING',
          code: 'TYPE_REMOVED',
          path: typeName,
          description: `Type '${typeName}' was removed from the schema.`,
          oldValue: oldType.astNode ? 'defined' : undefined,
        });
        continue;
      }

      // Check if kind of type changed
      if (this.getTypeKind(oldType) !== this.getTypeKind(newType)) {
        items.push({
          category: 'BREAKING',
          code: 'TYPE_KIND_CHANGED',
          path: typeName,
          description: `Type '${typeName}' changed from ${this.getTypeKind(oldType)} to ${this.getTypeKind(newType)}.`,
          oldValue: this.getTypeKind(oldType),
          newValue: this.getTypeKind(newType),
        });
        continue;
      }

      // Compare Object and Interface types
      if (isObjectType(oldType) && isObjectType(newType)) {
        this.diffFields(typeName, oldType.getFields(), newType.getFields(), items);
      } else if (isInterfaceType(oldType) && isInterfaceType(newType)) {
        this.diffFields(typeName, oldType.getFields(), newType.getFields(), items);
      } else if (isEnumType(oldType) && isEnumType(newType)) {
        this.diffEnumValues(typeName, oldType.getValues(), newType.getValues(), items);
      } else if (isInputObjectType(oldType) && isInputObjectType(newType)) {
        this.diffInputFields(typeName, oldType.getFields(), newType.getFields(), items);
      } else if (isUnionType(oldType) && isUnionType(newType)) {
        this.diffUnionTypes(typeName, oldType.getTypes(), newType.getTypes(), items);
      }
    }

    // Check for newly added types
    for (const [typeName, newType] of Object.entries(newTypeMap)) {
      if (typeName.startsWith('__')) continue;
      if (!oldTypeMap[typeName]) {
        items.push({
          category: 'SAFE',
          code: 'TYPE_ADDED',
          path: typeName,
          description: `New type '${typeName}' (${this.getTypeKind(newType)}) was added to the schema.`,
          newValue: this.getTypeKind(newType),
        });
      }
    }

    let breakingCount = 0;
    let dangerousCount = 0;
    let safeCount = 0;

    for (const item of items) {
      if (item.category === 'BREAKING') breakingCount++;
      else if (item.category === 'DANGEROUS') dangerousCount++;
      else safeCount++;
    }

    return {
      items,
      breakingCount,
      dangerousCount,
      safeCount,
      hasBreakingChanges: breakingCount > 0,
      timestamp: Date.now(),
    };
  }

  private getTypeKind(type: GraphQLNamedType): string {
    if (isObjectType(type)) return 'Object';
    if (isInterfaceType(type)) return 'Interface';
    if (isUnionType(type)) return 'Union';
    if (isEnumType(type)) return 'Enum';
    if (isInputObjectType(type)) return 'InputObject';
    if (isScalarType(type)) return 'Scalar';
    return 'Unknown';
  }

  private diffFields(
    parentName: string,
    oldFields: Record<string, GraphQLField<any, any>>,
    newFields: Record<string, GraphQLField<any, any>>,
    items: SchemaDiffItem[]
  ) {
    for (const [fieldName, oldField] of Object.entries(oldFields)) {
      const newField = newFields[fieldName];
      const fieldPath = `${parentName}.${fieldName}`;

      if (!newField) {
        items.push({
          category: 'BREAKING',
          code: 'FIELD_REMOVED',
          path: fieldPath,
          description: `Field '${fieldName}' was removed from '${parentName}'.`,
          oldValue: oldField.type.toString(),
        });
        continue;
      }

      // Check field return type compatibility
      if (oldField.type.toString() !== newField.type.toString()) {
        const isBreaking = this.isFieldTypeChangeBreaking(oldField.type, newField.type);
        items.push({
          category: isBreaking ? 'BREAKING' : 'DANGEROUS',
          code: 'FIELD_TYPE_CHANGED',
          path: fieldPath,
          description: `Field '${fieldPath}' changed return type from '${oldField.type.toString()}' to '${newField.type.toString()}'.`,
          oldValue: oldField.type.toString(),
          newValue: newField.type.toString(),
        });
      }

      // Check deprecation
      if (!oldField.deprecationReason && newField.deprecationReason) {
        items.push({
          category: 'DANGEROUS',
          code: 'FIELD_DEPRECATED',
          path: fieldPath,
          description: `Field '${fieldPath}' was marked @deprecated: "${newField.deprecationReason}".`,
          newValue: newField.deprecationReason,
        });
      }

      // Check field arguments
      this.diffArguments(fieldPath, oldField.args, newField.args, items);
    }

    // Check newly added fields
    for (const [fieldName, newField] of Object.entries(newFields)) {
      if (!oldFields[fieldName]) {
        items.push({
          category: 'SAFE',
          code: 'FIELD_ADDED',
          path: `${parentName}.${fieldName}`,
          description: `New field '${fieldName}: ${newField.type.toString()}' added to '${parentName}'.`,
          newValue: newField.type.toString(),
        });
      }
    }
  }

  private diffArguments(
    fieldPath: string,
    oldArgs: readonly GraphQLArgument[],
    newArgs: readonly GraphQLArgument[],
    items: SchemaDiffItem[]
  ) {
    const oldArgsMap = new Map(oldArgs.map((a) => [a.name, a]));
    const newArgsMap = new Map(newArgs.map((a) => [a.name, a]));

    for (const [argName, oldArg] of oldArgsMap.entries()) {
      const newArg = newArgsMap.get(argName);
      const argPath = `${fieldPath}(${argName})`;

      if (!newArg) {
        items.push({
          category: 'BREAKING',
          code: 'ARG_REMOVED',
          path: argPath,
          description: `Argument '${argName}' was removed from field '${fieldPath}'.`,
          oldValue: oldArg.type.toString(),
        });
        continue;
      }

      if (oldArg.type.toString() !== newArg.type.toString()) {
        items.push({
          category: 'BREAKING',
          code: 'ARG_TYPE_CHANGED',
          path: argPath,
          description: `Argument '${argName}' on '${fieldPath}' changed type from '${oldArg.type.toString()}' to '${newArg.type.toString()}'.`,
          oldValue: oldArg.type.toString(),
          newValue: newArg.type.toString(),
        });
      }
    }

    // Check for newly added arguments
    for (const [argName, newArg] of newArgsMap.entries()) {
      if (!oldArgsMap.has(argName)) {
        const argPath = `${fieldPath}(${argName})`;
        const isRequired = isNonNullType(newArg.type) && newArg.defaultValue === undefined;

        if (isRequired) {
          items.push({
            category: 'BREAKING',
            code: 'REQUIRED_ARG_ADDED',
            path: argPath,
            description: `Required argument '${argName}: ${newArg.type.toString()}' without default was added to '${fieldPath}'.`,
            newValue: newArg.type.toString(),
          });
        } else {
          items.push({
            category: 'SAFE',
            code: 'OPTIONAL_ARG_ADDED',
            path: argPath,
            description: `Optional argument '${argName}: ${newArg.type.toString()}' was added to '${fieldPath}'.`,
            newValue: newArg.type.toString(),
          });
        }
      }
    }
  }

  private diffEnumValues(typeName: string, oldValues: readonly any[], newValues: readonly any[], items: SchemaDiffItem[]) {
    const oldValMap = new Map(oldValues.map((v) => [v.name, v]));
    const newValMap = new Map(newValues.map((v) => [v.name, v]));

    for (const [valName] of oldValMap.entries()) {
      if (!newValMap.has(valName)) {
        items.push({
          category: 'BREAKING',
          code: 'ENUM_VALUE_REMOVED',
          path: `${typeName}.${valName}`,
          description: `Enum value '${valName}' was removed from '${typeName}'.`,
        });
      }
    }

    for (const [valName] of newValMap.entries()) {
      if (!oldValMap.has(valName)) {
        items.push({
          category: 'SAFE',
          code: 'ENUM_VALUE_ADDED',
          path: `${typeName}.${valName}`,
          description: `New enum value '${valName}' was added to '${typeName}'.`,
        });
      }
    }
  }

  private diffInputFields(
    typeName: string,
    oldFields: Record<string, GraphQLInputField>,
    newFields: Record<string, GraphQLInputField>,
    items: SchemaDiffItem[]
  ) {
    for (const [fieldName, oldField] of Object.entries(oldFields)) {
      const newField = newFields[fieldName];
      const fieldPath = `${typeName}.${fieldName}`;

      if (!newField) {
        items.push({
          category: 'BREAKING',
          code: 'INPUT_FIELD_REMOVED',
          path: fieldPath,
          description: `Input field '${fieldName}' was removed from input object '${typeName}'.`,
        });
        continue;
      }

      if (oldField.type.toString() !== newField.type.toString()) {
        items.push({
          category: 'BREAKING',
          code: 'INPUT_FIELD_TYPE_CHANGED',
          path: fieldPath,
          description: `Input field '${fieldPath}' changed type from '${oldField.type.toString()}' to '${newField.type.toString()}'.`,
          oldValue: oldField.type.toString(),
          newValue: newField.type.toString(),
        });
      }
    }

    for (const [fieldName, newField] of Object.entries(newFields)) {
      if (!oldFields[fieldName]) {
        const isRequired = isNonNullType(newField.type) && newField.defaultValue === undefined;
        items.push({
          category: isRequired ? 'BREAKING' : 'SAFE',
          code: isRequired ? 'REQUIRED_INPUT_FIELD_ADDED' : 'OPTIONAL_INPUT_FIELD_ADDED',
          path: `${typeName}.${fieldName}`,
          description: `${isRequired ? 'Required' : 'Optional'} input field '${fieldName}: ${newField.type.toString()}' was added to '${typeName}'.`,
          newValue: newField.type.toString(),
        });
      }
    }
  }

  private diffUnionTypes(typeName: string, oldTypes: readonly any[], newTypes: readonly any[], items: SchemaDiffItem[]) {
    const oldTypeNames = new Set(oldTypes.map((t) => t.name));
    const newTypeNames = new Set(newTypes.map((t) => t.name));

    for (const name of oldTypeNames) {
      if (!newTypeNames.has(name)) {
        items.push({
          category: 'BREAKING',
          code: 'UNION_MEMBER_REMOVED',
          path: `${typeName} | ${name}`,
          description: `Type '${name}' was removed from union '${typeName}'.`,
        });
      }
    }

    for (const name of newTypeNames) {
      if (!oldTypeNames.has(name)) {
        items.push({
          category: 'SAFE',
          code: 'UNION_MEMBER_ADDED',
          path: `${typeName} | ${name}`,
          description: `New member type '${name}' was added to union '${typeName}'.`,
        });
      }
    }
  }

  private isFieldTypeChangeBreaking(oldType: any, newType: any): boolean {
    const oldStr = oldType.toString();
    const newStr = newType.toString();
    if (oldStr === newStr) return false;

    // Output types: changing from NonNull to Nullable (e.g. String! -> String) can break clients expecting a guaranteed value!
    if (isNonNullType(oldType) && !isNonNullType(newType)) {
      return true;
    }

    // If underlying named type changed
    const oldNamed = (getNamedType(oldType) as any)?.name;
    const newNamed = (getNamedType(newType) as any)?.name;
    if (oldNamed && newNamed && oldNamed !== newNamed) {
      return true;
    }

    // Changing list structure
    if (isListType(oldType) !== isListType(newType)) {
      return true;
    }

    return false;
  }
}
