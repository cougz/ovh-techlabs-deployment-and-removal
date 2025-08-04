import { useEffect, useRef, useState, useCallback } from 'react';
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

interface UseWebSocketOptions {
  workshopId: string;
  onMessage?: (message: WebSocketMessage) => void;
  onStatusUpdate?: (entityType: string, entityId: string, status: string, details?: any) => void;
  onDeploymentLog?: (attendeeId: string, logEntry: any) => void;
  onDeploymentProgress?: (attendeeId: string, progress: number, currentStep: string) => void;
}

export const useWebSocket = ({
  workshopId,
  onMessage,
  onStatusUpdate,
  onDeploymentLog,
  onDeploymentProgress
}: UseWebSocketOptions) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  
  const queryClient = useQueryClient();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const token = localStorage.getItem('token');
    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsHost = window.location.host;
    const wsUrl = `${wsProtocol}://${wsHost}/ws/${workshopId}${token ? `?token=${token}` : ''}`;

    console.log('Connecting to WebSocket:', wsUrl);

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttemptsRef.current = 0;

        // Start ping interval
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000); // Ping every 30 seconds
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          // Handle different message types
          switch (message.type) {
            case 'connection':
              console.log('WebSocket connection confirmed');
              break;

            case 'status_update':
              if (message.entity_type && message.entity_id && message.status) {
                // Invalidate React Query cache to trigger re-fetch
                queryClient.invalidateQueries(['attendees', workshopId]);
                queryClient.invalidateQueries(['workshop', workshopId]);
                
                // IMPORTANT: Also invalidate the workshops list query
                // This ensures Dashboard and WorkshopList pages get real-time updates
                queryClient.invalidateQueries('workshops');
                queryClient.invalidateQueries(['workshops']);

                // Call callback
                onStatusUpdate?.(message.entity_type, message.entity_id, message.status, message.details);
              }
              break;

            case 'deployment_log':
              if (message.attendee_id && message.log_entry) {
                onDeploymentLog?.(message.attendee_id, message.log_entry);
              }
              break;

            case 'deployment_progress':
              if (message.attendee_id && message.progress !== undefined && message.current_step) {
                onDeploymentProgress?.(message.attendee_id, message.progress, message.current_step);
              }
              break;

            case 'pong':
              // Heartbeat response
              break;
          }

          // Call general message handler
          onMessage?.(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionError('WebSocket connection error');
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        wsRef.current = null;

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Attempt reconnection with exponential backoff
        if (reconnectAttemptsRef.current < 5) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectAttemptsRef.current++;
          
          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          setConnectionError('Failed to connect after multiple attempts');
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      setConnectionError('Failed to create WebSocket connection');
    }
  }, [workshopId, queryClient, onMessage, onStatusUpdate, onDeploymentLog, onDeploymentProgress]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setConnectionError(null);
    reconnectAttemptsRef.current = 0;
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  // Connect on mount and disconnect on unmount
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    connectionError,
    sendMessage,
    reconnect: connect,
    disconnect
  };
};