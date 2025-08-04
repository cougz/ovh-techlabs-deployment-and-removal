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
  global?: boolean;
}

interface UseGlobalWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onStatusUpdate?: (workshopId: string, entityType: string, entityId: string, status: string, details?: any) => void;
  onDeploymentLog?: (workshopId: string, attendeeId: string, logEntry: any) => void;
  onDeploymentProgress?: (workshopId: string, attendeeId: string, progress: number, currentStep: string) => void;
}

export const useGlobalWebSocket = ({
  onMessage,
  onStatusUpdate,
  onDeploymentLog,
  onDeploymentProgress
}: UseGlobalWebSocketOptions = {}) => {
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
    const wsUrl = `${wsProtocol}://${wsHost}/ws/global${token ? `?token=${token}` : ''}`;

    console.log('Connecting to Global WebSocket:', wsUrl);

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Global WebSocket connected');
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
              console.log('Global WebSocket connection confirmed');
              break;

            case 'status_update':
              if (message.workshop_id && message.entity_type && message.entity_id && message.status) {
                // Force immediate refetch of React Query cache
                queryClient.refetchQueries(['attendees', message.workshop_id]);
                queryClient.refetchQueries(['workshop', message.workshop_id]);
                
                // Force immediate refetch of the workshops list query for Dashboard and WorkshopList
                queryClient.refetchQueries('workshops');
                queryClient.refetchQueries(['workshops']);

                // Call callback with workshop_id
                onStatusUpdate?.(message.workshop_id, message.entity_type, message.entity_id, message.status, message.details);
              }
              break;

            case 'deployment_log':
              if (message.workshop_id && message.attendee_id && message.log_entry) {
                onDeploymentLog?.(message.workshop_id, message.attendee_id, message.log_entry);
              }
              break;

            case 'deployment_progress':
              if (message.workshop_id && message.attendee_id && message.progress !== undefined && message.current_step) {
                onDeploymentProgress?.(message.workshop_id, message.attendee_id, message.progress, message.current_step);
              }
              break;

            case 'pong':
              // Heartbeat response
              break;
          }

          // Call general message handler
          onMessage?.(message);
        } catch (error) {
          console.error('Error parsing Global WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('Global WebSocket error:', error);
        setConnectionError('Global WebSocket connection error');
      };

      ws.onclose = (event) => {
        console.log('Global WebSocket disconnected:', event.code, event.reason);
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
          
          console.log(`Global WebSocket reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          setConnectionError('Failed to connect to Global WebSocket after multiple attempts');
        }
      };
    } catch (error) {
      console.error('Error creating Global WebSocket:', error);
      setConnectionError('Failed to create Global WebSocket connection');
    }
  }, [queryClient, onMessage, onStatusUpdate, onDeploymentLog, onDeploymentProgress]);

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