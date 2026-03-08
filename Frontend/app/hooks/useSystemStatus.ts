import { useState, useEffect } from 'react';

export type ServiceStatus = 'online' | 'offline' | 'maintenance' | 'unknown';

interface StatusEvent {
  service: string;
  status: ServiceStatus;
  timestamp: number;
}

export function useSystemStatus(serviceName: string) {
  const [status, setStatus] = useState<ServiceStatus>('unknown');

  useEffect(() => {
    // Only connect on client-side
    if (typeof window === 'undefined') return;

    // We pass proxy path down to our backend's SSE endpoint
    const eventSource = new EventSource('/api/proxy/status/stream');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as StatusEvent;
        if (data.service === serviceName) {
          setStatus(data.status);
        }
      } catch (err) {
        console.error('Error parsing SSE message', err);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE Error:', error);
      // EventSource automatically reconnects on error
    };

    return () => {
      eventSource.close();
    };
  }, [serviceName]);

  return status;
}
