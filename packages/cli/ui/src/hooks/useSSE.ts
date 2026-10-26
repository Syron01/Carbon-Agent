import { useEffect, useRef, useCallback } from 'react';

type EventMap = Record<string, (data: any) => void>;

const MAX_BACKOFF_MS = 30000;

export function useSSE(url: string, handlers: EventMap) {
  const ref = useRef<EventSource | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoff = useRef(1000);

  const connect = useCallback(() => {
    const es = new EventSource(url);
    ref.current = es;

    es.onopen = () => {
      backoff.current = 1000;
      handlersRef.current['open']?.({ connected: true });
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type && handlersRef.current[data.type]) {
          handlersRef.current[data.type](data);
        }
        handlersRef.current['message']?.(data);
      } catch {
        handlersRef.current['raw']?.(event.data);
      }
    };

    es.onerror = () => {
      es.close();
      handlersRef.current['error']?.({});
      // Reconnect with exponential backoff (capped at ~30s)
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      reconnectTimer.current = setTimeout(() => {
        reconnectTimer.current = null;
        connect();
      }, backoff.current);
      backoff.current = Math.min(backoff.current * 2, MAX_BACKOFF_MS);
    };
  }, [url]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      ref.current?.close();
    };
  }, [connect]);

  return ref;
}
