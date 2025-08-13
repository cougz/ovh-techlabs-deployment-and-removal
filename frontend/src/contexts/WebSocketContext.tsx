import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useQueryClient } from 'react-query';

interface WebSocketMessage {
  type: 'connection' | 'status_update' | 'deployment_log' | 'deployment_progress' | 'pong';
  timestamp: string;
  workshop_id?: string;
  entity_type?: 'workshop' | 'attendee';
  entity_id?: string;
  status?: string;
  details?: any;
  attendee_id?: string;
  log_entry?: any;
  progress?: number;
  current_step?: string;
}

interface WebSocketContextType {
  isConnected: boolean;
  connectionError: string | null;
  sendMessage: (message: any) => boolean;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

interface WebSocketProviderProps {
  children: ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const queryClient = useQueryClient();

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    const token = localStorage.getItem('token');
    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsHost = window.location.host;
    const wsUrl = `${wsProtocol}://${wsHost}/ws/global${token ? `?token=${token}` : ''}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttemptsRef.current = 0;

        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          switch (message.type) {
            case 'status_update':
              if (message.workshop_id && message.entity_type && message.entity_id && message.status) {
                // Invalidate relevant queries
                queryClient.invalidateQueries(['attendees', message.workshop_id]);
                queryClient.invalidateQueries(['workshop', message.workshop_id]);
                queryClient.invalidateQueries('workshops');
                queryClient.invalidateQueries(['workshops']);
              }
              break;
            case 'pong':
              // Heartbeat response
              break;
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionError('WebSocket connection error');
      };

      ws.onclose = (event) => {
        console.log(`WebSocket disconnected: code=${event.code}`);
        setIsConnected(false);
        wsRef.current = null;

        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        const shouldReconnect = event.code !== 1000 &&
                               event.code !== 1001 &&
                               event.code !== 1005 &&
                               event.code !== 3000;

        if (shouldReconnect && reconnectAttemptsRef.current < 5) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectAttemptsRef.current++;

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      setConnectionError('Failed to create WebSocket connection');
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000); // Normal closure
      wsRef.current = null;
    }

    setIsConnected(false);
    setConnectionError(null);
    reconnectAttemptsRef.current = 0;
  };

  const sendMessage = (message: any): boolean => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  };

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{
      isConnected,
      connectionError,
      sendMessage
    }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = (): WebSocketContextType => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};