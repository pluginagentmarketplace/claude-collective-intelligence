import { useEffect, useState, useCallback, useRef } from 'react';
import type { WsMessage } from '../types';

interface UseWebSocketOptions {
  url: string;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  maxRetries?: number;
  silentMode?: boolean;
}

interface UseWebSocketReturn {
  lastMessage: WsMessage | null;
  isConnected: boolean;
  error: string | null;
  reconnecting: boolean;
  sendMessage: (message: unknown) => void;
  retryCount: number;
}

export function useWebSocket({
  url,
  reconnectInterval = 5000,
  heartbeatInterval = 5000,
  maxRetries = 3,
  silentMode = true,
}: UseWebSocketOptions): UseWebSocketReturn {
  const [lastMessage, setLastMessage] = useState<WsMessage | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const isMountedRef = useRef(true); // React Strict Mode fix

  const connect = useCallback(() => {
    // React Strict Mode: Don't connect if component unmounted
    if (!isMountedRef.current) {
      return;
    }

    // Stop reconnecting after max retries - switch to silent REST fallback
    if (retryCountRef.current >= maxRetries) {
      if (!silentMode) {
        console.info('[WS] Max retries reached, using REST fallback (silent mode)');
      }
      setReconnecting(false);
      setError(null); // Clear error - REST fallback is working
      return;
    }

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        // React Strict Mode: Don't update state if unmounted
        if (!isMountedRef.current) return;

        if (!silentMode) {
          console.info('[WS] Connected to', url);
        }
        setIsConnected(true);
        setError(null);
        setReconnecting(false);
        retryCountRef.current = 0;
        setRetryCount(0);

        // Start heartbeat
        heartbeatTimeoutRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() }));
          }
        }, heartbeatInterval);
      };

      ws.onmessage = (event) => {
        // React Strict Mode: Don't update state if unmounted
        if (!isMountedRef.current) return;

        try {
          const data: WsMessage = JSON.parse(event.data);

          // Respond to server ping with pong
          if (data.type === 'ping') {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
            }
            return;
          }

          setLastMessage(data);
        } catch {
          // Silent fail - don't spam console for parse errors
        }
      };

      // SILENT error handling - no console.error spam!
      ws.onerror = () => {
        // React Strict Mode: Don't update state if unmounted
        if (!isMountedRef.current) return;

        // Don't log errors - this is expected when WS server unavailable
        // Just set state for UI to show reconnecting status
        setError('WebSocket unavailable');
      };

      ws.onclose = () => {
        // React Strict Mode: Don't update state if unmounted
        if (!isMountedRef.current) return;

        setIsConnected(false);

        // Clear heartbeat
        if (heartbeatTimeoutRef.current) {
          clearInterval(heartbeatTimeoutRef.current);
        }

        // Increment retry count
        retryCountRef.current += 1;
        setRetryCount(retryCountRef.current);

        // Only reconnect if under max retries
        if (retryCountRef.current < maxRetries) {
          setReconnecting(true);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        } else {
          // Max retries reached - silent fallback to REST
          setReconnecting(false);
          setError(null);
        }
      };
    } catch {
      // Silent fail - REST fallback will handle data fetching
      retryCountRef.current += 1;
      setRetryCount(retryCountRef.current);

      if (retryCountRef.current < maxRetries) {
        setReconnecting(true);
        reconnectTimeoutRef.current = setTimeout(connect, reconnectInterval);
      } else {
        setReconnecting(false);
        setError(null);
      }
    }
  }, [url, reconnectInterval, heartbeatInterval, maxRetries, silentMode]);

  const sendMessage = useCallback((message: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  useEffect(() => {
    // Reset mounted state on each effect run (React Strict Mode safe)
    isMountedRef.current = true;
    connect();

    return () => {
      // Mark as unmounted FIRST to prevent state updates during cleanup
      isMountedRef.current = false;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (heartbeatTimeoutRef.current) {
        clearInterval(heartbeatTimeoutRef.current);
      }
      if (wsRef.current) {
        // Only close if connection is OPEN or CONNECTING
        if (wsRef.current.readyState === WebSocket.OPEN ||
            wsRef.current.readyState === WebSocket.CONNECTING) {
          wsRef.current.close();
        }
        wsRef.current = null;
      }
    };
  }, [connect]);

  return { lastMessage, isConnected, error, reconnecting, sendMessage, retryCount };
}
