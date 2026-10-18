import { SchemaDiffResult, WaterfallTrace, ClientTrafficImpact } from '../types.js';

export class SchemaImpactAnalyzer {
  /**
   * Correlates breaking changes detected in schema diffs with recent query history.
   * Pinpoints which clients and operations will break if the candidate schema is deployed.
   */
  public analyzeImpact(diff: SchemaDiffResult, queryHistory: WaterfallTrace[]): ClientTrafficImpact[] {
    const impacts: ClientTrafficImpact[] = [];

    // Filter breaking and dangerous changes
    const criticalChanges = diff.items.filter(
      (item) => item.category === 'BREAKING' || item.category === 'DANGEROUS'
    );

    for (const change of criticalChanges) {
      const fieldOrTypeName = change.path.includes('.') ? change.path.split('.')[1] : change.path;
      const clientsSet = new Set<string>();
      const operationsSet = new Set<string>();
      let hitCount = 0;

      for (const trace of queryHistory) {
        if (!trace.query) continue;

        // Check if query requested the impacted field or type
        const regex = new RegExp(`\\b${fieldOrTypeName}\\b`);
        if (regex.test(trace.query)) {
          hitCount++;
          if (trace.clientIp) clientsSet.add(trace.clientIp);
          if (trace.operationName) operationsSet.add(trace.operationName);
          else operationsSet.add('anonymous');
        }
      }

      let severity: ClientTrafficImpact['severity'] = 'NO_IMPACT';
      if (hitCount > 5 || clientsSet.size > 2) {
        severity = 'HIGH_IMPACT';
      } else if (hitCount > 0) {
        severity = 'LOW_IMPACT';
      }

      impacts.push({
        schemaPath: change.path,
        changeCode: change.code,
        totalHitsInSession: hitCount,
        distinctClientsCount: clientsSet.size,
        sampleClients: Array.from(clientsSet).slice(0, 5),
        sampleOperations: Array.from(operationsSet).slice(0, 5),
        severity,
      });
    }

    return impacts.sort((a, b) => b.totalHitsInSession - a.totalHitsInSession);
  }
}
