export interface RateLimitEntry {
  timestamps: { time: number; cost: number }[];
}

export class ComplexityRateLimiter {
  private windowMs: number;
  private maxBudget: number;
  private clients = new Map<string, RateLimitEntry>();

  constructor(windowMs = 60000, maxBudget = 5000) {
    this.windowMs = windowMs;
    this.maxBudget = maxBudget;

    // Periodic cleanup of stale clients every 30 seconds
    setInterval(() => {
      this.cleanup();
    }, 30000).unref();
  }

  public updateLimits(windowMs: number, maxBudget: number): void {
    this.windowMs = windowMs;
    this.maxBudget = maxBudget;
  }

  public checkAndRecord(clientId: string, complexityCost: number): { allowed: boolean; currentTotal: number; maxBudget: number; resetInMs: number } {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let entry = this.clients.get(clientId);
    if (!entry) {
      entry = { timestamps: [] };
      this.clients.set(clientId, entry);
    }

    // Prune entries older than current window
    entry.timestamps = entry.timestamps.filter((t) => t.time > windowStart);

    const currentTotal = entry.timestamps.reduce((sum, t) => sum + t.cost, 0);

    if (currentTotal + complexityCost > this.maxBudget) {
      const oldest = entry.timestamps[0]?.time || now;
      const resetInMs = Math.max(0, oldest + this.windowMs - now);
      return {
        allowed: false,
        currentTotal,
        maxBudget: this.maxBudget,
        resetInMs,
      };
    }

    entry.timestamps.push({ time: now, cost: complexityCost });
    return {
      allowed: true,
      currentTotal: currentTotal + complexityCost,
      maxBudget: this.maxBudget,
      resetInMs: this.windowMs,
    };
  }

  private cleanup(): void {
    const windowStart = Date.now() - this.windowMs;
    for (const [clientId, entry] of this.clients.entries()) {
      entry.timestamps = entry.timestamps.filter((t) => t.time > windowStart);
      if (entry.timestamps.length === 0) {
        this.clients.delete(clientId);
      }
    }
  }
}
