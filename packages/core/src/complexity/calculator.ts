import {
  parse,
  DocumentNode,
  GraphQLSchema,
  TypeInfo,
  visit,
  visitWithTypeInfo,
  FieldNode,
  FragmentDefinitionNode,
  InlineFragmentNode,
  isListType,
  isNonNullType,
  isObjectType,
  isScalarType,
  isEnumType,
  getNamedType,
  IntValueNode,
  DirectiveNode,
} from 'graphql';
import {
  QueryComplexityConfig,
  ComplexityAnalysisResult,
  FieldCostNode,
  ComplexityViolation,
} from '../types.js';

export const DEFAULT_COMPLEXITY_CONFIG: QueryComplexityConfig = {
  scalarCost: 1,
  objectCost: 2,
  defaultListMultiplier: 10,
  listArgumentNames: ['first', 'limit', 'count', 'last', 'take', 'pageSize'],
  maxDepth: 10,
  maxComplexity: 250,
  fieldCosts: {},
  fieldMultipliers: {},
  directiveName: 'complexity',
  blockIntrospection: false,
  dryRun: false,
};

export class QueryComplexityCalculator {
  private config: QueryComplexityConfig;
  private schema?: GraphQLSchema;

  constructor(config: Partial<QueryComplexityConfig> = {}, schema?: GraphQLSchema) {
    this.config = { ...DEFAULT_COMPLEXITY_CONFIG, ...config };
    this.schema = schema;
  }

  public updateConfig(newConfig: Partial<QueryComplexityConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public setSchema(schema: GraphQLSchema): void {
    this.schema = schema;
  }

  public analyze(queryOrDoc: string | DocumentNode, variables?: Record<string, unknown>): ComplexityAnalysisResult {
    const startTime = performance.now();
    let doc: DocumentNode;

    if (typeof queryOrDoc === 'string') {
      try {
        doc = parse(queryOrDoc);
      } catch (err: any) {
        return {
          complexity: 0,
          depth: 0,
          nodeCount: 0,
          fieldBreakdown: [],
          cyclicPaths: [],
          isIntrospection: false,
          isBlocked: true,
          violations: [
            {
              type: 'MAX_COMPLEXITY',
              message: `GraphQL syntax error: ${err.message}`,
              value: 0,
              limit: 0,
            },
          ],
          durationMs: performance.now() - startTime,
        };
      }
    } else {
      doc = queryOrDoc;
    }

    // Collect named fragments
    const fragments: Record<string, FragmentDefinitionNode> = {};
    for (const def of doc.definitions) {
      if (def.kind === 'FragmentDefinition') {
        fragments[def.name.value] = def;
      }
    }

    // Detect introspection queries
    let isIntrospection = false;
    let nodeCount = 0;
    const fieldBreakdown: FieldCostNode[] = [];
    const cyclicPaths: string[] = [];
    let totalComplexity = 0;
    let maxCalculatedDepth = 0;

    if (this.schema) {
      const typeInfo = new TypeInfo(this.schema);
      const ancestorTypes: string[] = [];
      const currentPath: string[] = [];
      const multiplierStack: number[] = [1];
      const visitedFragments = new Set<string>();

      visit(
        doc,
        visitWithTypeInfo(typeInfo, {
          Field: {
            enter: (node: FieldNode) => {
              nodeCount++;
              const fieldName = node.name.value;
              if (fieldName === '__schema' || fieldName === '__type') {
                isIntrospection = true;
              }

              const parentType = typeInfo.getParentType();
              const parentTypeName = parentType ? parentType.name : 'Unknown';
              const fieldDef = typeInfo.getFieldDef();
              const fieldType = fieldDef ? fieldDef.type : undefined;

              currentPath.push(fieldName);
              const pathStr = currentPath.join('.');

              // Depth measurement
              const currentDepth = currentPath.length;
              if (currentDepth > maxCalculatedDepth) {
                maxCalculatedDepth = currentDepth;
              }

              // Check for recursion / cyclic pattern
              if (ancestorTypes.includes(parentTypeName) && parentTypeName !== 'Query' && parentTypeName !== 'Mutation') {
                const cycleCount = ancestorTypes.filter((t) => t === parentTypeName).length;
                if (cycleCount >= 2) {
                  cyclicPaths.push(pathStr);
                }
              }
              ancestorTypes.push(parentTypeName);

              // Determine list nature & multiplier
              let isList = false;
              let fieldMultiplier = 1;

              if (fieldType) {
                const named = getNamedType(fieldType);
                let unwrapped = fieldType;
                if (isNonNullType(unwrapped)) unwrapped = unwrapped.ofType;
                if (isListType(unwrapped)) {
                  isList = true;
                }
              }

              if (isList) {
                fieldMultiplier = this.extractListMultiplier(node, variables);
              }

              // Base cost
              let baseCost = 0;
              const qualifiedName = `${parentTypeName}.${fieldName}`;

              // 1. Check custom overrides
              if (this.config.fieldCosts[qualifiedName] !== undefined) {
                baseCost = this.config.fieldCosts[qualifiedName];
              } else if (this.config.fieldCosts[fieldName] !== undefined) {
                baseCost = this.config.fieldCosts[fieldName];
              } else {
                // 2. Check directive @complexity
                const directiveCost = this.extractDirectiveCost(node);
                if (directiveCost !== null) {
                  baseCost = directiveCost;
                } else if (node.selectionSet && node.selectionSet.selections.length > 0) {
                  baseCost = this.config.objectCost;
                } else {
                  baseCost = this.config.scalarCost;
                }
              }

              const currentCumulativeMultiplier = multiplierStack[multiplierStack.length - 1];
              const effectiveCost = baseCost * currentCumulativeMultiplier;
              totalComplexity += effectiveCost;

              fieldBreakdown.push({
                path: pathStr,
                fieldName,
                parentType: parentTypeName,
                cost: baseCost,
                multiplier: currentCumulativeMultiplier,
                effectiveCost,
                depth: currentDepth,
                isList,
              });

              // Push new cumulative multiplier for nested selections
              multiplierStack.push(currentCumulativeMultiplier * fieldMultiplier);
            },
            leave: () => {
              currentPath.pop();
              ancestorTypes.pop();
              multiplierStack.pop();
            },
          },
        })
      );
    } else {
      // Schema-less analysis (fast structural AST traversal)
      const state = {
        currentPath: [] as string[],
        multiplierStack: [1],
        ancestorNames: [] as string[],
      };

      for (const def of doc.definitions) {
        if (def.kind === 'OperationDefinition') {
          this.traverseSelectionSet(def.selectionSet, state, fragments, variables, (node, path, depth, isList, multiplier) => {
            nodeCount++;
            const fieldName = node.name.value;
            if (fieldName === '__schema' || fieldName === '__type') {
              isIntrospection = true;
            }

            if (depth > maxCalculatedDepth) {
              maxCalculatedDepth = depth;
            }

            const pathStr = path.join('.');
            const hasChildren = node.selectionSet && node.selectionSet.selections.length > 0;
            const baseCost = hasChildren ? this.config.objectCost : this.config.scalarCost;
            const effectiveCost = baseCost * multiplier;
            totalComplexity += effectiveCost;

            fieldBreakdown.push({
              path: pathStr,
              fieldName,
              parentType: 'SchemaFree',
              cost: baseCost,
              multiplier,
              effectiveCost,
              depth,
              isList,
            });
          });
        }
      }
    }

    // Evaluate violations
    const violations: ComplexityViolation[] = [];
    let isBlocked = false;

    if (this.config.blockIntrospection && isIntrospection) {
      violations.push({
        type: 'INTROSPECTION_BLOCKED',
        message: 'GraphQL introspection queries are blocked in this environment',
        value: 1,
        limit: 0,
      });
      isBlocked = true;
    }

    if (totalComplexity > this.config.maxComplexity) {
      violations.push({
        type: 'MAX_COMPLEXITY',
        message: `Query complexity of ${totalComplexity} exceeds the maximum limit of ${this.config.maxComplexity}`,
        value: totalComplexity,
        limit: this.config.maxComplexity,
      });
      isBlocked = true;
    }

    if (maxCalculatedDepth > this.config.maxDepth) {
      violations.push({
        type: 'MAX_DEPTH',
        message: `Query depth of ${maxCalculatedDepth} exceeds the maximum depth limit of ${this.config.maxDepth}`,
        value: maxCalculatedDepth,
        limit: this.config.maxDepth,
      });
      isBlocked = true;
    }

    if (cyclicPaths.length > 0) {
      violations.push({
        type: 'CYCLIC_QUERY',
        message: `Detected ${cyclicPaths.length} cyclic recursion paths that may cause server denial of service`,
        value: cyclicPaths.length,
        limit: 0,
      });
      isBlocked = true;
    }

    if (this.config.dryRun) {
      isBlocked = false;
    }

    return {
      complexity: totalComplexity,
      depth: maxCalculatedDepth,
      nodeCount,
      fieldBreakdown,
      cyclicPaths,
      isIntrospection,
      isBlocked,
      violations,
      durationMs: performance.now() - startTime,
    };
  }

  private extractListMultiplier(node: FieldNode, variables?: Record<string, unknown>): number {
    if (!node.arguments || node.arguments.length === 0) {
      return this.config.defaultListMultiplier;
    }

    for (const arg of node.arguments) {
      if (this.config.listArgumentNames.includes(arg.name.value)) {
        if (arg.value.kind === 'IntValue') {
          const val = parseInt(arg.value.value, 10);
          if (!isNaN(val) && val > 0) {
            return val;
          }
        } else if (arg.value.kind === 'Variable' && variables) {
          const varVal = variables[arg.value.name.value];
          if (typeof varVal === 'number' && varVal > 0) {
            return varVal;
          }
        }
      }
    }

    return this.config.defaultListMultiplier;
  }

  private extractDirectiveCost(node: FieldNode): number | null {
    if (!node.directives) return null;
    const dir = node.directives.find((d) => d.name.value === this.config.directiveName);
    if (!dir || !dir.arguments) return null;
    const valueArg = dir.arguments.find((a) => a.name.value === 'value');
    if (valueArg && valueArg.value.kind === 'IntValue') {
      return parseInt(valueArg.value.value, 10);
    }
    return null;
  }

  private traverseSelectionSet(
    selectionSet: any,
    state: { currentPath: string[]; multiplierStack: number[]; ancestorNames: string[] },
    fragments: Record<string, FragmentDefinitionNode>,
    variables: Record<string, unknown> | undefined,
    callback: (node: FieldNode, path: string[], depth: number, isList: boolean, multiplier: number) => void
  ) {
    if (!selectionSet || !selectionSet.selections) return;

    for (const selection of selectionSet.selections) {
      if (selection.kind === 'Field') {
        const fieldName = selection.name.value;
        state.currentPath.push(fieldName);
        const depth = state.currentPath.length;

        // Guess list nature from arguments
        let isList = false;
        let fieldMultiplier = 1;
        if (selection.arguments) {
          for (const arg of selection.arguments) {
            if (this.config.listArgumentNames.includes(arg.name.value)) {
              isList = true;
              if (arg.value.kind === 'IntValue') {
                fieldMultiplier = parseInt(arg.value.value, 10) || this.config.defaultListMultiplier;
              }
            }
          }
        }

        const currentMultiplier = state.multiplierStack[state.multiplierStack.length - 1];
        callback(selection, [...state.currentPath], depth, isList, currentMultiplier);

        if (selection.selectionSet) {
          state.multiplierStack.push(currentMultiplier * (isList ? fieldMultiplier : 1));
          this.traverseSelectionSet(selection.selectionSet, state, fragments, variables, callback);
          state.multiplierStack.pop();
        }

        state.currentPath.pop();
      } else if (selection.kind === 'InlineFragment') {
        this.traverseSelectionSet(selection.selectionSet, state, fragments, variables, callback);
      } else if (selection.kind === 'FragmentSpread') {
        const frag = fragments[selection.name.value];
        if (frag) {
          this.traverseSelectionSet(frag.selectionSet, state, fragments, variables, callback);
        }
      }
    }
  }
}
