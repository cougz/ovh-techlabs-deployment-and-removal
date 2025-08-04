/**
 * Centralized State Management Store
 * Implements proper state management for STATE-MANAGEMENT-REVAMP-001
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
// Immer middleware might not be available in this version - removing for now
// import { immer } from 'zustand/middleware/immer';
import { Workshop, WorkshopSummary, Attendee, WorkshopStatus, AttendeeStatus } from '../types';
import { 
  calculateWorkshopState, 
  validateStateTransition, 
  StateContext, 
  StateAction,
  applyOptimisticUpdate,
  StateError
} from './stateMachine';

// Normalized state structure for better performance
interface NormalizedState {
  workshops: Record<string, Workshop>;
  workshopSummaries: Record<string, WorkshopSummary>;
  attendees: Record<string, Attendee>;
  workshopAttendees: Record<string, string[]>; // workshopId -> attendeeIds
}

// UI state
interface UIState {
  loading: Record<string, boolean>; // entityId -> loading state
  errors: Record<string, string>; // entityId -> error message
  optimisticUpdates: Record<string, WorkshopStatus | AttendeeStatus>; // entityId -> optimistic state
}

// Real-time connection state
interface RealtimeState {
  connected: boolean;
  lastUpdate: number;
  subscriptions: Set<string>; // workshopIds we're subscribed to
}

// Complete app state
interface AppState extends NormalizedState {
  ui: UIState;
  realtime: RealtimeState;
  
  // Actions
  setWorkshop: (workshop: Workshop) => void;
  setWorkshopSummary: (workshop: WorkshopSummary) => void;
  setWorkshops: (workshops: Workshop[]) => void;
  setWorkshopSummaries: (workshops: WorkshopSummary[]) => void;
  setAttendees: (workshopId: string, attendees: Attendee[]) => void;
  setAttendee: (attendee: Attendee) => void;
  
  // State transitions
  transitionWorkshopState: (workshopId: string, newState: WorkshopStatus, context?: Partial<StateContext>) => Promise<void>;
  transitionAttendeeState: (attendeeId: string, newState: AttendeeStatus, context?: Partial<StateContext>) => Promise<void>;
  
  // Optimistic updates
  applyOptimisticStateUpdate: (entityId: string, action: StateAction) => void;
  clearOptimisticUpdate: (entityId: string) => void;
  
  // UI actions
  setLoading: (entityId: string, loading: boolean) => void;
  setError: (entityId: string, error: string | null) => void;
  
  // Real-time actions
  setRealtimeConnected: (connected: boolean) => void;
  addRealtimeSubscription: (workshopId: string) => void;
  removeRealtimeSubscription: (workshopId: string) => void;
  
  // Selectors
  getWorkshop: (workshopId: string) => Workshop | undefined;
  getWorkshopWithAttendees: (workshopId: string) => (Workshop & { attendees: Attendee[] }) | undefined;
  getAttendee: (attendeeId: string) => Attendee | undefined;
  getWorkshopAttendees: (workshopId: string) => Attendee[];
  getEffectiveWorkshopState: (workshopId: string) => WorkshopStatus;
  getEffectiveAttendeeState: (attendeeId: string) => AttendeeStatus;
  isLoading: (entityId: string) => boolean;
  getError: (entityId: string) => string | null;
}

// State validation and logging
const stateLogger = {
  logStateTransition: (entityId: string, fromState: string, toState: string, success: boolean, error?: StateError) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`State transition [${entityId}]: ${fromState} -> ${toState}`, { success, error });
    }
  },
  
  logOptimisticUpdate: (entityId: string, action: StateAction, newState: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`Optimistic update [${entityId}]: ${action.type} -> ${newState}`);
    }
  }
};

export const useAppStore = create<AppState>()(
  subscribeWithSelector((set, get) => ({
        // Initial state
        workshops: {},
        workshopSummaries: {},
        attendees: {},
        workshopAttendees: {},
        ui: {
          loading: {},
          errors: {},
          optimisticUpdates: {},
        },
        realtime: {
          connected: false,
          lastUpdate: 0,
          subscriptions: new Set(),
        },

        // Workshop actions
        setWorkshop: (workshop) => set((state) => ({
          ...state,
          workshops: {
            ...state.workshops,
            [workshop.id]: workshop,
          },
        })),

        setWorkshopSummary: (workshop) => set((state) => ({
          ...state,
          workshopSummaries: {
            ...state.workshopSummaries,
            [workshop.id]: workshop,
          },
        })),

        setWorkshops: (workshops) => {
          const workshopsMap: Record<string, Workshop> = {};
          workshops.forEach(workshop => {
            workshopsMap[workshop.id] = workshop;
          });
          set((state) => ({
            ...state,
            workshops: workshopsMap,
          }));
        },

        setWorkshopSummaries: (workshops) => {
          const workshopsMap: Record<string, WorkshopSummary> = {};
          workshops.forEach(workshop => {
            workshopsMap[workshop.id] = workshop;
          });
          set((state) => ({
            ...state,
            workshopSummaries: workshopsMap,
          }));
        },

        setAttendees: (workshopId, attendees) => {
          const attendeesMap: Record<string, Attendee> = {};
          const attendeeIds: string[] = [];
          attendees.forEach(attendee => {
            attendeesMap[attendee.id] = attendee;
            attendeeIds.push(attendee.id);
          });
          set((state) => ({
            ...state,
            attendees: {
              ...state.attendees,
              ...attendeesMap,
            },
            workshopAttendees: {
              ...state.workshopAttendees,
              [workshopId]: attendeeIds,
            },
          }));
        },

        setAttendee: (attendee) => set((state) => {
          const newWorkshopAttendees = { ...state.workshopAttendees };
          
          // Update workshop-attendee relationship if needed
          if (attendee.workshop_id) {
            if (!newWorkshopAttendees[attendee.workshop_id]) {
              newWorkshopAttendees[attendee.workshop_id] = [];
            }
            if (!newWorkshopAttendees[attendee.workshop_id].includes(attendee.id)) {
              newWorkshopAttendees[attendee.workshop_id] = [
                ...newWorkshopAttendees[attendee.workshop_id],
                attendee.id,
              ];
            }
          }
          
          return {
            ...state,
            attendees: {
              ...state.attendees,
              [attendee.id]: attendee,
            },
            workshopAttendees: newWorkshopAttendees,
          };
        }),

        // State transitions with validation
        transitionWorkshopState: async (workshopId, newState, contextData = {}) => {
          const state = get();
          const workshop = state.workshops[workshopId];
          if (!workshop) return;

          const context: StateContext = {
            id: workshopId,
            entityType: 'workshop',
            metadata: contextData,
            timestamp: Date.now(),
          };

          const validation = validateStateTransition(workshop.status, newState, context);
          
          if (!validation.valid) {
            stateLogger.logStateTransition(workshopId, workshop.status, newState, false, validation.error);
            set((state) => ({
              ...state,
              ui: {
                ...state.ui,
                errors: {
                  ...state.ui.errors,
                  [workshopId]: validation.error!.message,
                },
              },
            }));
            return;
          }

          // Apply state transition
          set((state) => {
            const updatedWorkshops = { ...state.workshops };
            if (updatedWorkshops[workshopId]) {
              updatedWorkshops[workshopId] = {
                ...updatedWorkshops[workshopId],
                status: newState,
              };
            }
            
            const updatedOptimistic = { ...state.ui.optimisticUpdates };
            const updatedErrors = { ...state.ui.errors };
            delete updatedOptimistic[workshopId];
            delete updatedErrors[workshopId];
            
            return {
              ...state,
              workshops: updatedWorkshops,
              ui: {
                ...state.ui,
                optimisticUpdates: updatedOptimistic,
                errors: updatedErrors,
              },
            };
          });

          stateLogger.logStateTransition(workshopId, workshop.status, newState, true);
        },

        transitionAttendeeState: async (attendeeId, newState, contextData = {}) => {
          const state = get();
          const attendee = state.attendees[attendeeId];
          if (!attendee) return;

          const context: StateContext = {
            id: attendeeId,
            entityType: 'attendee',
            metadata: contextData,
            timestamp: Date.now(),
          };

          const validation = validateStateTransition(attendee.status, newState, context);
          
          if (!validation.valid) {
            stateLogger.logStateTransition(attendeeId, attendee.status, newState, false, validation.error);
            set((state) => ({
              ...state,
              ui: {
                ...state.ui,
                errors: {
                  ...state.ui.errors,
                  [attendeeId]: validation.error!.message,
                },
              },
            }));
            return;
          }

          // Apply state transition
          set((state) => {
            const updatedAttendees = { ...state.attendees };
            if (updatedAttendees[attendeeId]) {
              updatedAttendees[attendeeId] = {
                ...updatedAttendees[attendeeId],
                status: newState,
              };
            }
            
            const updatedOptimistic = { ...state.ui.optimisticUpdates };
            const updatedErrors = { ...state.ui.errors };
            delete updatedOptimistic[attendeeId];
            delete updatedErrors[attendeeId];
            
            return {
              ...state,
              attendees: updatedAttendees,
              ui: {
                ...state.ui,
                optimisticUpdates: updatedOptimistic,
                errors: updatedErrors,
              },
            };
          });

          // Update workshop state based on attendee states
          if (attendee.workshop_id) {
            const workshopAttendees = state.getWorkshopAttendees(attendee.workshop_id);
            const calculatedWorkshopState = calculateWorkshopState(workshopAttendees.map(a => a.status));
            await state.transitionWorkshopState(attendee.workshop_id, calculatedWorkshopState);
          }

          stateLogger.logStateTransition(attendeeId, attendee.status, newState, true);
        },

        // Optimistic updates
        applyOptimisticStateUpdate: (entityId, action) => {
          const state = get();
          const entity = state.workshops[entityId] || state.attendees[entityId];
          if (!entity) return;

          const context: StateContext = {
            id: entityId,
            entityType: state.workshops[entityId] ? 'workshop' : 'attendee',
            metadata: {},
            timestamp: Date.now(),
          };

          const optimisticState = applyOptimisticUpdate(action, entity.status as any, context);
          
          set((state) => ({
            ...state,
            ui: {
              ...state.ui,
              optimisticUpdates: {
                ...state.ui.optimisticUpdates,
                [entityId]: optimisticState,
              },
            },
          }));

          stateLogger.logOptimisticUpdate(entityId, action, optimisticState);
        },

        clearOptimisticUpdate: (entityId) => set((state) => {
          const updatedOptimistic = { ...state.ui.optimisticUpdates };
          delete updatedOptimistic[entityId];
          return {
            ...state,
            ui: {
              ...state.ui,
              optimisticUpdates: updatedOptimistic,
            },
          };
        }),

        // UI actions
        setLoading: (entityId, loading) => set((state) => {
          const updatedLoading = { ...state.ui.loading };
          if (loading) {
            updatedLoading[entityId] = true;
          } else {
            delete updatedLoading[entityId];
          }
          return {
            ...state,
            ui: {
              ...state.ui,
              loading: updatedLoading,
            },
          };
        }),

        setError: (entityId, error) => set((state) => {
          const updatedErrors = { ...state.ui.errors };
          if (error) {
            updatedErrors[entityId] = error;
          } else {
            delete updatedErrors[entityId];
          }
          return {
            ...state,
            ui: {
              ...state.ui,
              errors: updatedErrors,
            },
          };
        }),

        // Real-time actions
        setRealtimeConnected: (connected) => set((state) => ({
          ...state,
          realtime: {
            ...state.realtime,
            connected,
            lastUpdate: Date.now(),
          },
        })),

        addRealtimeSubscription: (workshopId) => set((state) => {
          const newSubscriptions = new Set(state.realtime.subscriptions);
          newSubscriptions.add(workshopId);
          return {
            ...state,
            realtime: {
              ...state.realtime,
              subscriptions: newSubscriptions,
            },
          };
        }),

        removeRealtimeSubscription: (workshopId) => set((state) => {
          const newSubscriptions = new Set(state.realtime.subscriptions);
          newSubscriptions.delete(workshopId);
          return {
            ...state,
            realtime: {
              ...state.realtime,
              subscriptions: newSubscriptions,
            },
          };
        }),

        // Selectors
        getWorkshop: (workshopId) => {
          const state = get();
          return state.workshops[workshopId];
        },

        getWorkshopWithAttendees: (workshopId) => {
          const state = get();
          const workshop = state.workshops[workshopId];
          if (!workshop) return undefined;

          const attendees = state.getWorkshopAttendees(workshopId);
          return { ...workshop, attendees };
        },

        getAttendee: (attendeeId) => {
          const state = get();
          return state.attendees[attendeeId];
        },

        getWorkshopAttendees: (workshopId) => {
          const state = get();
          const attendeeIds = state.workshopAttendees[workshopId] || [];
          return attendeeIds.map(id => state.attendees[id]).filter(Boolean);
        },

        getEffectiveWorkshopState: (workshopId) => {
          const state = get();
          
          // Check for optimistic update first
          const optimistic = state.ui.optimisticUpdates[workshopId] as WorkshopStatus;
          if (optimistic) return optimistic;
          
          // Calculate based on attendee states
          const attendees = state.getWorkshopAttendees(workshopId);
          if (attendees.length > 0) {
            return calculateWorkshopState(attendees.map(a => state.getEffectiveAttendeeState(a.id)));
          }
          
          // Fallback to stored state
          return state.workshops[workshopId]?.status || 'planning';
        },

        getEffectiveAttendeeState: (attendeeId) => {
          const state = get();
          
          // Check for optimistic update first
          const optimistic = state.ui.optimisticUpdates[attendeeId] as AttendeeStatus;
          if (optimistic) return optimistic;
          
          // Fallback to stored state
          return state.attendees[attendeeId]?.status || 'planning';
        },

        isLoading: (entityId) => {
          const state = get();
          return state.ui.loading[entityId] || false;
        },

        getError: (entityId) => {
          const state = get();
          return state.ui.errors[entityId] || null;
        },
      }))
);

// Convenience hooks for common patterns
export const useWorkshop = (workshopId: string) => {
  return useAppStore((state) => ({
    workshop: state.getWorkshopWithAttendees(workshopId),
    effectiveState: state.getEffectiveWorkshopState(workshopId),
    isLoading: state.isLoading(workshopId),
    error: state.getError(workshopId),
  }));
};

export const useAttendee = (attendeeId: string) => {
  return useAppStore((state) => ({
    attendee: state.getAttendee(attendeeId),
    effectiveState: state.getEffectiveAttendeeState(attendeeId),
    isLoading: state.isLoading(attendeeId),
    error: state.getError(attendeeId),
  }));
};

export const useWorkshopList = () => {
  return useAppStore((state) => ({
    workshops: Object.values(state.workshopSummaries),
    isLoading: state.isLoading('workshop-list'),
    error: state.getError('workshop-list'),
  }));
};