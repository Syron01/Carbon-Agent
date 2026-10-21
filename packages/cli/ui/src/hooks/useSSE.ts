import { useEffect, useRef, useCallback } from 'react';

type EventMap = Record<string, (data: any) => void>;

export function useSSE(url: string, handlers: EventMap) {
  const ref = useRef<EventSource | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const connect = useCallback(() => {
    const es = new EventSource(url);
    ref.current = es;

    es.onopen = () => handlersRef.current['open']?.({ connected: true });

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
    };
  }, [url]);

  useEffect(() => {
    connect();
    return () => ref.current?.close();
  }, [connect]);

  return ref;
}
