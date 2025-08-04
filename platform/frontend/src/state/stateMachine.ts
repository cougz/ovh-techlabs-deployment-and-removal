/**
 * State Machine Implementation for Workshop and Attendee States
 * Addresses STATE-MANAGEMENT-REVAMP-001 inconsistent state management
 */

import { WorkshopStatus, AttendeeStatus } from '../types';

// State machine context
export interface StateContext {
  id: string;
  entityType: 'workshop' | 'attendee';
  metadata: Record<string, any>;
  timestamp: number;
}

// State machine actions
export type StateAction = 
  | { type: 'DEPLOY_WORKSHOP' }
  | { type: 'DEPLOY_ATTENDEE' }
  | { type: 'DEPLOYMENT_SUCCESS' }
  | { type: 'DEPLOYMENT_FAILED'; error: string }
  | { type: 'CLEANUP_RESOURCES' }
  | { type: 'CLEANUP_SUCCESS' }
  | { type: 'CLEANUP_FAILED'; error: string }
  | { type: 'DELETE_ENTITY' }
  | { type: 'RETRY_OPERATION' };

// Workshop state transition rules
const WORKSHOP_STATE_RULES: Record<WorkshopStatus, {
  canTransitionTo: readonly WorkshopStatus[];
  conditions: (context: StateContext) => boolean;
}> = {
  planning: {
    canTransitionTo: ['deploying', 'deleting'],
    conditions: (_context) => true, // Always can transition from planning
  },
  deploying: {
    canTransitionTo: ['active', 'failed', 'planning'],
    conditions: (_context) => true,
  },
  active: {
    canTransitionTo: ['deleting', 'completed', 'failed'],
    conditions: (_context) => true,
  },
  failed: {
    canTransitionTo: ['deploying', 'deleting'],
    conditions: (_context) => true,
  },
  deleting: {
    canTransitionTo: ['completed', 'failed'],
    conditions: (_context) => true,
  },
  completed: {
    canTransitionTo: ['deleting'],
    conditions: (_context) => true,
  },
} as const;

// Attendee state transition rules
const ATTENDEE_STATE_RULES: Record<AttendeeStatus, {
  canTransitionTo: readonly AttendeeStatus[];
  conditions: (context: StateContext) => boolean;
}> = {
  planning: {
    canTransitionTo: ['deploying'],
    conditions: (_context) => true,
  },
  deploying: {
    canTransitionTo: ['active', 'failed'],
    conditions: (_context) => true,
  },
  active: {
    canTransitionTo: ['deleting', 'failed'],
    conditions: (_context) => true,
  },
  failed: {
    canTransitionTo: ['deploying', 'deleting'],
    conditions: (_context) => true,
  },
  deleting: {
    canTransitionTo: ['deleted', 'failed'],
    conditions: (_context) => true,
  },
  deleted: {
    canTransitionTo: [],
    conditions: (_context) => false,
  },
} as const;

// State validation error
export interface StateError {
  type: 'INVALID_TRANSITION' | 'CONDITION_NOT_MET' | 'SYNC_CONFLICT';
  message: string;
  currentState: string;
  attemptedState: string;
  context: StateContext;
}

/**
 * Validates if a state transition is allowed
 */
export function validateStateTransition(
  fromState: WorkshopStatus | AttendeeStatus,
  toState: WorkshopStatus | AttendeeStatus,
  context: StateContext
): { valid: boolean; error?: StateError } {
  const rules = context.entityType === 'workshop' 
    ? WORKSHOP_STATE_RULES[fromState as WorkshopStatus]
    : ATTENDEE_STATE_RULES[fromState as AttendeeStatus];

  if (!rules) {
    return {
      valid: false,
      error: {
        type: 'INVALID_TRANSITION',
        message: `Unknown state: ${fromState}`,
        currentState: fromState,
        attemptedState: toState,
        context,
      },
    };
  }

  if (!rules.canTransitionTo.includes(toState as any)) {
    return {
      valid: false,
      error: {
        type: 'INVALID_TRANSITION',
        message: `Cannot transition from ${fromState} to ${toState}`,
        currentState: fromState,
        attemptedState: toState,
        context,
      },
    };
  }

  if (!rules.conditions(context)) {
    return {
      valid: false,
      error: {
        type: 'CONDITION_NOT_MET',
        message: `Conditions not met for transition from ${fromState} to ${toState}`,
        currentState: fromState,
        attemptedState: toState,
        context,
      },
    };
  }

  return { valid: true };
}

/**
 * Calculates workshop state based on attendee states
 */
export function calculateWorkshopState(attendeeStates: AttendeeStatus[]): WorkshopStatus {
  if (attendeeStates.length === 0) return 'planning';
  
  // If any attendee is deploying, workshop is deploying
  if (attendeeStates.some(s => s === 'deploying')) {
    return 'deploying';
  }
  
  // If all attendees are active, workshop is active
  if (attendeeStates.every(s => s === 'active')) {
    return 'active';
  }
  
  // If any attendee failed and no deployments active, workshop failed
  if (attendeeStates.some(s => s === 'failed') && !attendeeStates.some(s => s === 'deploying')) {
    return 'failed';
  }
  
  // If any attendee is deleting, workshop is deleting
  if (attendeeStates.some(s => s === 'deleting')) {
    return 'deleting';
  }
  
  // If all attendees are deleted, workshop is completed
  if (attendeeStates.every(s => s === 'deleted')) {
    return 'completed';
  }
  
  // Default to planning for mixed states
  return 'planning';
}

/**
 * Applies optimistic state updates for better UX
 */
export function applyOptimisticUpdate(
  action: StateAction,
  currentState: WorkshopStatus | AttendeeStatus,
  context: StateContext
): WorkshopStatus | AttendeeStatus {
  switch (action.type) {
    case 'DEPLOY_WORKSHOP':
      return currentState === 'planning' ? 'deploying' : currentState;
    
    case 'DEPLOY_ATTENDEE':
      return currentState === 'planning' ? 'deploying' : currentState;
    
    case 'CLEANUP_RESOURCES':
      return ['active', 'failed'].includes(currentState) ? 'deleting' : currentState;
    
    case 'DELETE_ENTITY':
      return 'deleted' as any;
    
    case 'RETRY_OPERATION':
      if (currentState === 'failed') {
        return context.entityType === 'workshop' ? 'deploying' : 'deploying';
      }
      return currentState;
    
    default:
      return currentState;
  }
}

/**
 * Gets the next possible states for a given current state
 */
export function getNextPossibleStates(
  currentState: WorkshopStatus | AttendeeStatus,
  entityType: 'workshop' | 'attendee'
): readonly (WorkshopStatus | AttendeeStatus)[] {
  const rules = entityType === 'workshop' 
    ? WORKSHOP_STATE_RULES[currentState as WorkshopStatus]
    : ATTENDEE_STATE_RULES[currentState as AttendeeStatus];
  
  return rules?.canTransitionTo || [];
}

/**
 * Checks if a state is terminal (no further transitions possible)
 */
export function isTerminalState(
  state: WorkshopStatus | AttendeeStatus,
  entityType: 'workshop' | 'attendee'
): boolean {
  return getNextPossibleStates(state, entityType).length === 0;
}

/**
 * Gets user-friendly state description
 */
export function getStateDescription(
  state: WorkshopStatus | AttendeeStatus,
  entityType: 'workshop' | 'attendee'
): string {
  const descriptions: Record<string, string> = {
    // Workshop descriptions
    'workshop.planning': 'Workshop created, ready to deploy attendees',
    'workshop.deploying': 'Deploying attendee environments',
    'workshop.active': 'All attendees successfully deployed',
    'workshop.failed': 'Deployment failed for one or more attendees',
    'workshop.deleting': 'Cleaning up workshop resources',
    'workshop.completed': 'Workshop completed, resources cleaned up',
    'workshop.deleted': 'Workshop permanently removed',
    
    // Attendee descriptions
    'attendee.planning': 'Attendee created, not yet deployed',
    'attendee.deploying': 'Creating OVH resources for attendee',
    'attendee.active': 'Attendee environment ready for use',
    'attendee.failed': 'Failed to create attendee environment',
    'attendee.deleting': 'Removing attendee resources',
    'attendee.deleted': 'Attendee resources successfully removed',
  };
  
  return descriptions[`${entityType}.${state}`] || `${entityType} is ${state}`;
}