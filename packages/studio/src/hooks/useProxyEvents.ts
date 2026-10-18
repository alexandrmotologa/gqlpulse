import { useState, useEffect, useCallback } from 'react';
import { WaterfallTrace, ProxyMetrics } from '../types.js';

export function useProxyEvents() {
  const [traces, setTraces] = useState<WaterfallTrace[]>([]);
  const [metrics, setMetrics] = useState<ProxyMetrics | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  const fetchInitialTraces = useCallback(async () => {
    try {
      const res = await fetch('/api/traces?limit=50');
      if (res.ok) {
        const data = await res.json();
        setTraces(data);
      }
    } catch {
      // Proxy may still be initializing
    }
  }, []);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch('/api/metrics');
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    fetchInitialTraces();
    fetchMetrics();

    const interval = setInterval(fetchMetrics, 2000);

    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;

    function connectSSE() {
      try {
        eventSource = new EventSource('/events');

        eventSource.onopen = () => {
          setIsConnected(true);
        };

        eventSource.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.type === 'QUERY_EXECUTED' || parsed.type === 'QUERY_BLOCKED') {
              setTraces((prev) => [parsed.payload, ...prev.slice(0, 99)]);
            }
          } catch {
            // ignore malformed message
          }
        };

        eventSource.onerror = () => {
          setIsConnected(false);
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          reconnectTimeout = setTimeout(connectSSE, 3000);
        };
      } catch {
        setIsConnected(false);
        reconnectTimeout = setTimeout(connectSSE, 3000);
      }
    }

    connectSSE();

    return () => {
      clearInterval(interval);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) eventSource.close();
    };
  }, [fetchInitialTraces, fetchMetrics]);

  return {
    traces,
    metrics,
    isConnected,
    refreshTraces: fetchInitialTraces,
  };
}
