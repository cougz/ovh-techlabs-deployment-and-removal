/**
 * React Query Integration with Centralized State Management
 * Bridges React Query server state with Zustand store
 */

import { useMutation, useQuery, useQueryClient } from 'react-query';
import { workshopApi, attendeeApi } from '../services/api';
import { useAppStore } from './store';
import { Workshop, WorkshopSummary, Attendee, WorkshopStatus, AttendeeStatus } from '../types';
import { StateAction } from './stateMachine';

// Custom hooks that integrate React Query with our state store

/**
 * Enhanced useWorkshops hook with state management integration
 */
export function useWorkshopsQuery() {
  const { 
    setWorkshopSummaries, 
    setLoading, 
    setError,
    workshopSummaries,
    isLoading,
    getError
  } = useAppStore();

  const query = useQuery<WorkshopSummary[]>(
    ['workshops'],
    () => workshopApi.getWorkshops(),
    {
      refetchInterval: 30000,
      onSuccess: (data) => {
        setWorkshopSummaries(data);
        setLoading('workshop-list', false);
        setError('workshop-list', null);
      },
      onError: (error: any) => {
        setLoading('workshop-list', false);
        setError('workshop-list', error.response?.data?.detail || 'Failed to load workshops');
      },
      onSettled: () => {
        setLoading('workshop-list', false);
      },
    }
  );

  // Use store state instead of query state for consistency
  return {
    workshops: Object.values(workshopSummaries), // Convert Record to array
    isLoading: isLoading('workshop-list') || query.isLoading,
    error: getError('workshop-list') || query.error,
    refetch: query.refetch,
  };
}

/**
 * Enhanced useWorkshop hook with state management integration
 */
export function useWorkshopQuery(workshopId: string) {
  const { 
    setWorkshop, 
    setLoading, 
    setError,
    getWorkshopWithAttendees,
    getEffectiveWorkshopState,
    isLoading,
    getError,
    addRealtimeSubscription,
    removeRealtimeSubscription
  } = useAppStore();

  const query = useQuery<Workshop>(
    ['workshop', workshopId],
    () => workshopApi.getWorkshop(workshopId),
    {
      enabled: !!workshopId,
      refetchInterval: 5000,
      onSuccess: (data) => {
        setWorkshop(data);
        setLoading(workshopId, false);
        setError(workshopId, null);
        addRealtimeSubscription(workshopId);
      },
      onError: (error: any) => {
        setLoading(workshopId, false);
        setError(workshopId, error.response?.data?.detail || 'Failed to load workshop');
        removeRealtimeSubscription(workshopId);
      },
    }
  );

  return {
    workshop: getWorkshopWithAttendees(workshopId),
    effectiveState: getEffectiveWorkshopState(workshopId),
    isLoading: isLoading(workshopId) || query.isLoading,
    error: getError(workshopId) || query.error,
    refetch: query.refetch,
  };
}

/**
 * Enhanced useAttendees hook with state management integration
 */
export function useAttendeesQuery(workshopId: string) {
  const { 
    setAttendees, 
    setLoading, 
    setError,
    getWorkshopAttendees,
    isLoading,
    getError
  } = useAppStore();

  const query = useQuery<Attendee[]>(
    ['attendees', workshopId],
    () => attendeeApi.getWorkshopAttendees(workshopId),
    {
      enabled: !!workshopId,
      refetchInterval: 3000,
      onSuccess: (data) => {
        setAttendees(workshopId, data);
        setLoading(`attendees-${workshopId}`, false);
        setError(`attendees-${workshopId}`, null);
      },
      onError: (error: any) => {
        setLoading(`attendees-${workshopId}`, false);
        setError(`attendees-${workshopId}`, error.response?.data?.detail || 'Failed to load attendees');
      },
    }
  );

  return {
    attendees: getWorkshopAttendees(workshopId),
    isLoading: isLoading(`attendees-${workshopId}`) || query.isLoading,
    error: getError(`attendees-${workshopId}`) || query.error,
    refetch: query.refetch,
  };
}

/**
 * Workshop deployment mutation with optimistic updates
 */
export function useDeployWorkshopMutation() {
  const queryClient = useQueryClient();
  const { 
    applyOptimisticStateUpdate, 
    clearOptimisticUpdate,
    transitionWorkshopState,
    setLoading,
    setError
  } = useAppStore();

  return useMutation(
    (workshopId: string) => workshopApi.deployWorkshop(workshopId),
    {
      onMutate: async (workshopId) => {
        // Apply optimistic update
        const action: StateAction = { type: 'DEPLOY_WORKSHOP' };
        applyOptimisticStateUpdate(workshopId, action);
        setLoading(workshopId, true);
        setError(workshopId, null);
      },
      onSuccess: async (_data, workshopId) => {
        // Clear optimistic update and apply real state
        clearOptimisticUpdate(workshopId);
        await transitionWorkshopState(workshopId, 'deploying');
        setLoading(workshopId, false);
        
        // Invalidate related queries
        queryClient.invalidateQueries(['workshop', workshopId]);
        queryClient.invalidateQueries(['attendees', workshopId]);
      },
      onError: async (error: any, workshopId) => {
        // Clear optimistic update and handle error
        clearOptimisticUpdate(workshopId);
        await transitionWorkshopState(workshopId, 'failed');
        setLoading(workshopId, false);
        setError(workshopId, error.response?.data?.detail || 'Deployment failed');
      },
    }
  );
}

/**
 * Workshop cleanup mutation with optimistic updates
 */
export function useCleanupWorkshopMutation() {
  const queryClient = useQueryClient();
  const { 
    applyOptimisticStateUpdate, 
    clearOptimisticUpdate,
    transitionWorkshopState,
    setLoading,
    setError
  } = useAppStore();

  return useMutation(
    (workshopId: string) => workshopApi.cleanupWorkshop(workshopId),
    {
      onMutate: async (workshopId) => {
        // Apply optimistic update
        const action: StateAction = { type: 'CLEANUP_RESOURCES' };
        applyOptimisticStateUpdate(workshopId, action);
        setLoading(workshopId, true);
        setError(workshopId, null);
      },
      onSuccess: async (_data, workshopId) => {
        // Clear optimistic update and apply real state
        clearOptimisticUpdate(workshopId);
        await transitionWorkshopState(workshopId, 'deleting');
        setLoading(workshopId, false);
        
        // Invalidate related queries
        queryClient.invalidateQueries(['workshop', workshopId]);
        queryClient.invalidateQueries(['attendees', workshopId]);
      },
      onError: async (error: any, workshopId) => {
        // Clear optimistic update and handle error
        clearOptimisticUpdate(workshopId);
        setLoading(workshopId, false);
        setError(workshopId, error.response?.data?.detail || 'Cleanup failed');
      },
    }
  );
}

/**
 * Attendee creation mutation
 */
export function useCreateAttendeeMutation() {
  const queryClient = useQueryClient();
  const { setAttendee, setLoading, setError } = useAppStore();

  return useMutation(
    ({ workshopId, attendeeData }: { workshopId: string; attendeeData: any }) =>
      attendeeApi.createAttendee(workshopId, attendeeData),
    {
      onMutate: ({ workshopId }) => {
        setLoading(`create-attendee-${workshopId}`, true);
        setError(`create-attendee-${workshopId}`, null);
      },
      onSuccess: (_data, { workshopId }) => {
        setAttendee(_data);
        setLoading(`create-attendee-${workshopId}`, false);
        
        // Invalidate related queries
        queryClient.invalidateQueries(['attendees', workshopId]);
        queryClient.invalidateQueries(['workshop', workshopId]);
      },
      onError: (error: any, { workshopId }) => {
        setLoading(`create-attendee-${workshopId}`, false);
        setError(`create-attendee-${workshopId}`, error.response?.data?.detail || 'Failed to create attendee');
      },
    }
  );
}

/**
 * WebSocket update handler - integrates real-time updates with store
 */
export function useWebSocketIntegration() {
  const { 
    transitionWorkshopState,
    transitionAttendeeState,
    setRealtimeConnected,
    realtime
  } = useAppStore();

  const handleStatusUpdate = async (
    entityType: 'workshop' | 'attendee',
    entityId: string,
    status: WorkshopStatus | AttendeeStatus
  ) => {
    if (entityType === 'workshop') {
      await transitionWorkshopState(entityId, status as WorkshopStatus);
    } else {
      await transitionAttendeeState(entityId, status as AttendeeStatus);
    }
  };

  const handleConnectionChange = (connected: boolean) => {
    setRealtimeConnected(connected);
  };

  return {
    handleStatusUpdate,
    handleConnectionChange,
    isConnected: realtime.connected,
    subscriptions: Array.from(realtime.subscriptions),
  };
}

/**
 * State synchronization effect - ensures React Query cache stays in sync
 */
export function useSyncStateWithQueries() {
  const queryClient = useQueryClient();
  
  // Subscribe to store changes and sync with React Query cache
  useAppStore.subscribe(
    (state) => state.workshops,
    (workshops, prevWorkshops) => {
      // Update React Query cache when store changes
      Object.entries(workshops).forEach(([id, workshop]) => {
        const prev = prevWorkshops[id];
        if (!prev || prev.status !== workshop.status) {
          queryClient.setQueryData(['workshop', id], workshop);
        }
      });
    }
  );

  useAppStore.subscribe(
    (state) => state.attendees,
    (attendees, prevAttendees) => {
      // Update React Query cache when attendees change
      Object.entries(attendees).forEach(([id, attendee]) => {
        const prev = prevAttendees[id];
        if (!prev || prev.status !== attendee.status) {
          // Update individual attendee queries if they exist
          queryClient.setQueryData(['attendee', id], attendee);
          
          // Invalidate workshop attendees query
          if (attendee.workshop_id) {
            queryClient.invalidateQueries(['attendees', attendee.workshop_id]);
          }
        }
      });
    }
  );
}