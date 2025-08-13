import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from 'react-query';

// Connection pool to prevent duplicate connections to same workshop
const connectionPool = new Map<string, WebSocket>();

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
  maxReconnectAttempts?: number;
  baseReconnectDelay?: number;
  maxReconnectDelay?: number;
}

export const useWebSocket = ({
  workshopId,
  onMessage,
  onStatusUpdate,
  onDeploymentLog,
  onDeploymentProgress,
  maxReconnectAttempts = 5,
  baseReconnectDelay = 1000,
  maxReconnectDelay = 30000
}: UseWebSocketOptions) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  
  const queryClient = useQueryClient();

  const connect = useCallback(() => {
    // Check if there's already a connection for this workshop
    const existingConnection = connectionPool.get(workshopId);
    if (existingConnection?.readyState === WebSocket.OPEN || existingConnection?.readyState === WebSocket.CONNECTING) {
      console.log(`Using existing WebSocket connection for workshop ${workshopId}`);
      wsRef.current = existingConnection;
      setIsConnected(existingConnection.readyState === WebSocket.OPEN);
      return;
    }

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
      connectionPool.set(workshopId, ws); // Store in connection pool

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttemptsRef.current = 0;

        // Start health check interval with more robust ping/pong
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
            
            // Set a timeout to detect if pong is not received
            const pongTimeout = setTimeout(() => {
              console.warn('Ping timeout - connection may be unhealthy');
              // Force reconnection on ping timeout
              ws.close(1000, 'Ping timeout');
            }, 5000); // 5 second timeout for pong response
            
            // Store timeout to clear it when pong is received
            (ws as any)._pongTimeout = pongTimeout;
          } else if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
            // Clear interval if connection is dead
            if (pingIntervalRef.current) {
              clearInterval(pingIntervalRef.current);
              pingIntervalRef.current = null;
            }
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
              // Clear the pong timeout when we receive a response
              if ((wsRef.current as any)?._pongTimeout) {
                clearTimeout((wsRef.current as any)._pongTimeout);
                delete (wsRef.current as any)._pongTimeout;
              }
              console.log('Received pong - connection healthy');
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
        console.log(`WebSocket disconnected: code=${event.code}, reason="${event.reason}"`);
        setIsConnected(false);
        wsRef.current = null;
        
        // Remove from connection pool
        if (connectionPool.get(workshopId) === ws) {
          connectionPool.delete(workshopId);
        }

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Only reconnect on unexpected closures, not intentional ones
        const shouldReconnect = event.code !== 1000 && // Normal closure
                               event.code !== 1001 && // Going away
                               event.code !== 1005 && // No status received
                               event.code !== 3000;   // Custom app close codes

        if (shouldReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
          // Enhanced exponential backoff with jitter
          const baseDelay = baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current);
          const jitter = Math.random() * 1000; // Add jitter to prevent thundering herd
          const delay = Math.min(baseDelay + jitter, maxReconnectDelay);
          
          reconnectAttemptsRef.current++;
          
          console.log(`Reconnecting in ${Math.round(delay)}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts}) due to unexpected close`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else if (shouldReconnect) {
          console.log(`WebSocket: Max reconnection attempts (${maxReconnectAttempts}) reached`);
          setConnectionError(`Failed to connect after ${maxReconnectAttempts} attempts`);
        } else {
          console.log('WebSocket: Intentional close, not reconnecting');
          reconnectAttemptsRef.current = 0; // Reset on intentional close
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      setConnectionError('Failed to create WebSocket connection');
    }
  }, [workshopId, queryClient, onMessage, onStatusUpdate, onDeploymentLog, onDeploymentProgress, maxReconnectAttempts, baseReconnectDelay, maxReconnectDelay]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    // Clean up pong timeout if it exists
    if (wsRef.current && (wsRef.current as any)._pongTimeout) {
      clearTimeout((wsRef.current as any)._pongTimeout);
      delete (wsRef.current as any)._pongTimeout;
    }

    if (wsRef.current) {
      // Clean close with proper code
      wsRef.current.close(1000, 'Client disconnect');
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
  }, [workshopId]); // Only reconnect if workshop ID changes

  return {
    isConnected,
    connectionError,
    sendMessage,
    reconnect: connect,
    disconnect
  };
};