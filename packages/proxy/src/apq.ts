import crypto from 'node:crypto';

export interface APQProcessingResult {
  status: 'FOUND' | 'REGISTERED' | 'NOT_FOUND' | 'NOT_ALLOWED' | 'INVALID_HASH';
  query?: string;
  errorMessage?: string;
}

export class PersistedQueryManager {
  private cache = new Map<string, string>(); // sha256 -> query
  private allowlist = new Set<string>(); // pre-approved sha256 hashes
  private strictSafelist: boolean;
  private enabled: boolean;

  constructor(enabled = true, strictSafelist = false, initialAllowlist: string[] = []) {
    this.enabled = enabled;
    this.strictSafelist = strictSafelist;
    for (const hash of initialAllowlist) {
      this.allowlist.add(hash.toLowerCase());
    }
  }

  public updateConfig(enabled: boolean, strictSafelist: boolean, allowlist?: string[]): void {
    this.enabled = enabled;
    this.strictSafelist = strictSafelist;
    if (allowlist) {
      this.allowlist.clear();
      for (const hash of allowlist) {
        this.allowlist.add(hash.toLowerCase());
      }
    }
  }

  public registerQuery(query: string): string {
    const hash = crypto.createHash('sha256').update(query.trim()).digest('hex');
    this.cache.set(hash, query);
    this.allowlist.add(hash);
    return hash;
  }

  public processAPQ(
    sha256Hash: string,
    providedQuery?: string
  ): APQProcessingResult {
    if (!this.enabled) {
      return { status: 'FOUND', query: providedQuery };
    }

    const normalizedHash = sha256Hash.toLowerCase();

    // If query is provided, verify and cache it
    if (providedQuery) {
      const computedHash = crypto.createHash('sha256').update(providedQuery.trim()).digest('hex');
      if (computedHash !== normalizedHash) {
        return {
          status: 'INVALID_HASH',
          errorMessage: 'Provided query does not match the sha256Hash extension parameter',
        };
      }

      if (this.strictSafelist && !this.allowlist.has(normalizedHash)) {
        return {
          status: 'NOT_ALLOWED',
          errorMessage: 'Strict safelisting is enabled: this query hash is not registered in the pre-approved allowlist',
        };
      }

      this.cache.set(normalizedHash, providedQuery);
      return { status: 'REGISTERED', query: providedQuery };
    }

    // Only hash was provided: lookup in cache
    const cachedQuery = this.cache.get(normalizedHash);
    if (!cachedQuery) {
      return {
        status: 'NOT_FOUND',
        errorMessage: 'PersistedQueryNotFound',
      };
    }

    if (this.strictSafelist && !this.allowlist.has(normalizedHash)) {
      return {
        status: 'NOT_ALLOWED',
        errorMessage: 'Query not permitted under active strict safelist policy',
      };
    }

    return { status: 'FOUND', query: cachedQuery };
  }

  public getStats(): { totalCached: number; totalAllowlisted: number; strictMode: boolean; enabled: boolean } {
    return {
      totalCached: this.cache.size,
      totalAllowlisted: this.allowlist.size,
      strictMode: this.strictSafelist,
      enabled: this.enabled,
    };
  }
}
