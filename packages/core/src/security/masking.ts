import { MaskingRule } from '../types.js';

export class ResponseDataMasker {
  private rules: MaskingRule[];

  constructor(rules: MaskingRule[] = []) {
    this.rules = rules;
  }

  public updateRules(rules: MaskingRule[]): void {
    this.rules = rules;
  }

  public mask(data: any): any {
    if (!data || this.rules.length === 0) return data;
    return this.traverseAndMask(data);
  }

  private traverseAndMask(node: any): any {
    if (Array.isArray(node)) {
      return node.map((item) => this.traverseAndMask(item));
    }

    if (node !== null && typeof node === 'object') {
      const copy: Record<string, any> = {};
      for (const [key, value] of Object.entries(node)) {
        const matchingRule = this.findMatchingRule(key);
        if (matchingRule && typeof value === 'string') {
          copy[key] = this.applyStrategy(value, matchingRule.strategy);
        } else if (matchingRule && matchingRule.strategy === 'NULL') {
          copy[key] = null;
        } else {
          copy[key] = this.traverseAndMask(value);
        }
      }
      return copy;
    }

    return node;
  }

  private findMatchingRule(key: string): MaskingRule | undefined {
    const lowerKey = key.toLowerCase();
    return this.rules.find((r) => {
      const target = r.fieldPattern.toLowerCase();
      return lowerKey === target || lowerKey.endsWith(`.${target}`) || lowerKey.includes(target);
    });
  }

  private applyStrategy(value: string, strategy: MaskingRule['strategy']): any {
    switch (strategy) {
      case 'REDACT':
        return '[REDACTED]';
      case 'NULL':
        return null;
      case 'PARTIAL_EMAIL':
        return this.maskEmail(value);
      case 'HASH':
        return this.simpleHash(value);
      default:
        return '[PROTECTED]';
    }
  }

  private maskEmail(email: string): string {
    const atIndex = email.indexOf('@');
    if (atIndex <= 1) return '***@' + (email.split('@')[1] || 'domain.com');
    const user = email.substring(0, atIndex);
    const domain = email.substring(atIndex);
    return `${user.charAt(0)}***${user.charAt(user.length - 1)}${domain}`;
  }

  private simpleHash(val: string): string {
    let hash = 0;
    for (let i = 0; i < val.length; i++) {
      hash = (hash << 5) - hash + val.charCodeAt(i);
      hash |= 0;
    }
    return `sha256_${Math.abs(hash).toString(16).padStart(8, '0')}`;
  }
}
