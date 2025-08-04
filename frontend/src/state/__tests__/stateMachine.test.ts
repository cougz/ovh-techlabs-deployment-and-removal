/**
 * Tests for State Machine Implementation
 * Validates STATE-MANAGEMENT-REVAMP-001 state transitions
 */

import {
  StateContext,
  StateAction,
  validateStateTransition,
  calculateWorkshopState,
  applyOptimisticUpdate,
  getNextPossibleStates,
  isTerminalState,
  getStateDescription,
} from '../stateMachine';
import { WorkshopStatus, AttendeeStatus } from '../../types';

describe('State Machine', () => {
  describe('validateStateTransition', () => {
    const workshopContext: StateContext = {
      id: 'workshop-1',
      entityType: 'workshop',
      metadata: {},
      timestamp: Date.now(),
    };

    const attendeeContext: StateContext = {
      id: 'attendee-1',
      entityType: 'attendee',
      metadata: {},
      timestamp: Date.now(),
    };

    describe('Workshop State Transitions', () => {
      it('should allow valid workshop transitions', () => {
        // planning -> deploying
        let result = validateStateTransition('planning', 'deploying', workshopContext);
        expect(result.valid).toBe(true);

        // deploying -> active
        result = validateStateTransition('deploying', 'active', workshopContext);
        expect(result.valid).toBe(true);

        // active -> deleting
        result = validateStateTransition('active', 'deleting', workshopContext);
        expect(result.valid).toBe(true);

        // deleting -> completed
        result = validateStateTransition('deleting', 'completed', workshopContext);
        expect(result.valid).toBe(true);
      });

      it('should reject invalid workshop transitions', () => {
        // planning -> active (must go through deploying)
        let result = validateStateTransition('planning', 'active', workshopContext);
        expect(result.valid).toBe(false);
        expect(result.error?.type).toBe('INVALID_TRANSITION');

        // completed -> active (cannot go backwards)
        result = validateStateTransition('completed', 'active', workshopContext);
        expect(result.valid).toBe(false);

        // completed -> any invalid state (completed is terminal except for deleting)
        result = validateStateTransition('completed', 'planning', workshopContext);
        expect(result.valid).toBe(false);
      });

      it('should allow retry transitions from failed state', () => {
        // failed -> deploying (retry)
        const result = validateStateTransition('failed', 'deploying', workshopContext);
        expect(result.valid).toBe(true);
      });
    });

    describe('Attendee State Transitions', () => {
      it('should allow valid attendee transitions', () => {
        // planning -> deploying
        let result = validateStateTransition('planning', 'deploying', attendeeContext);
        expect(result.valid).toBe(true);

        // deploying -> active
        result = validateStateTransition('deploying', 'active', attendeeContext);
        expect(result.valid).toBe(true);

        // active -> deleting
        result = validateStateTransition('active', 'deleting', attendeeContext);
        expect(result.valid).toBe(true);

        // deleting -> deleted
        result = validateStateTransition('deleting', 'deleted', attendeeContext);
        expect(result.valid).toBe(true);
      });

      it('should reject invalid attendee transitions', () => {
        // planning -> active (must go through deploying)
        let result = validateStateTransition('planning', 'active', attendeeContext);
        expect(result.valid).toBe(false);

        // deleted -> any state (terminal state)
        result = validateStateTransition('deleted', 'planning', attendeeContext);
        expect(result.valid).toBe(false);
      });

      it('should allow retry transitions from failed state', () => {
        // failed -> deploying (retry deployment)
        let result = validateStateTransition('failed', 'deploying', attendeeContext);
        expect(result.valid).toBe(true);

        // failed -> deleting (cleanup failed deployment)
        result = validateStateTransition('failed', 'deleting', attendeeContext);
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('calculateWorkshopState', () => {
    it('should return planning for empty attendee list', () => {
      expect(calculateWorkshopState([])).toBe('planning');
    });

    it('should return deploying when any attendee is deploying', () => {
      const attendeeStates: AttendeeStatus[] = ['active', 'deploying', 'planning'];
      expect(calculateWorkshopState(attendeeStates)).toBe('deploying');
    });

    it('should return active when all attendees are active', () => {
      const attendeeStates: AttendeeStatus[] = ['active', 'active', 'active'];
      expect(calculateWorkshopState(attendeeStates)).toBe('active');
    });

    it('should return failed when some attendees failed and none deploying', () => {
      const attendeeStates: AttendeeStatus[] = ['active', 'failed', 'active'];
      expect(calculateWorkshopState(attendeeStates)).toBe('failed');
    });

    it('should return deleting when any attendee is deleting', () => {
      const attendeeStates: AttendeeStatus[] = ['active', 'deleting', 'active'];
      expect(calculateWorkshopState(attendeeStates)).toBe('deleting');
    });

    it('should return completed when all attendees are deleted', () => {
      const attendeeStates: AttendeeStatus[] = ['deleted', 'deleted', 'deleted'];
      expect(calculateWorkshopState(attendeeStates)).toBe('completed');
    });

    it('should prioritize deploying over failed', () => {
      const attendeeStates: AttendeeStatus[] = ['failed', 'deploying', 'active'];
      expect(calculateWorkshopState(attendeeStates)).toBe('deploying');
    });

    it('should return planning for mixed states that dont match specific rules', () => {
      const attendeeStates: AttendeeStatus[] = ['planning', 'active', 'deleted'];
      expect(calculateWorkshopState(attendeeStates)).toBe('planning');
    });
  });

  describe('applyOptimisticUpdate', () => {
    const workshopContext: StateContext = {
      id: 'workshop-1',
      entityType: 'workshop',
      metadata: {},
      timestamp: Date.now(),
    };

    const attendeeContext: StateContext = {
      id: 'attendee-1',
      entityType: 'attendee',
      metadata: {},
      timestamp: Date.now(),
    };

    it('should apply optimistic deploy workshop update', () => {
      const action: StateAction = { type: 'DEPLOY_WORKSHOP' };
      const result = applyOptimisticUpdate(action, 'planning', workshopContext);
      expect(result).toBe('deploying');
    });

    it('should apply optimistic deploy attendee update', () => {
      const action: StateAction = { type: 'DEPLOY_ATTENDEE' };
      const result = applyOptimisticUpdate(action, 'planning', attendeeContext);
      expect(result).toBe('deploying');
    });

    it('should apply optimistic cleanup update', () => {
      const action: StateAction = { type: 'CLEANUP_RESOURCES' };
      let result = applyOptimisticUpdate(action, 'active', workshopContext);
      expect(result).toBe('deleting');

      result = applyOptimisticUpdate(action, 'failed', workshopContext);
      expect(result).toBe('deleting');
    });

    it('should apply optimistic delete update', () => {
      const action: StateAction = { type: 'DELETE_ENTITY' };
      const result = applyOptimisticUpdate(action, 'completed', workshopContext);
      expect(result).toBe('deleted');
    });

    it('should apply optimistic retry update', () => {
      const action: StateAction = { type: 'RETRY_OPERATION' };
      const result = applyOptimisticUpdate(action, 'failed', workshopContext);
      expect(result).toBe('deploying');
    });

    it('should not change state for invalid optimistic updates', () => {
      const action: StateAction = { type: 'DEPLOY_WORKSHOP' };
      const result = applyOptimisticUpdate(action, 'active', workshopContext);
      expect(result).toBe('active'); // No change
    });
  });

  describe('getNextPossibleStates', () => {
    it('should return correct next states for workshop', () => {
      expect(getNextPossibleStates('planning', 'workshop')).toEqual(['deploying', 'deleting']);
      expect(getNextPossibleStates('deploying', 'workshop')).toEqual(['active', 'failed', 'planning']);
      expect(getNextPossibleStates('active', 'workshop')).toEqual(['deleting', 'completed', 'failed']);
      expect(getNextPossibleStates('completed', 'workshop')).toEqual(['deleting']);
    });

    it('should return correct next states for attendee', () => {
      expect(getNextPossibleStates('planning', 'attendee')).toEqual(['deploying']);
      expect(getNextPossibleStates('deploying', 'attendee')).toEqual(['active', 'failed']);
      expect(getNextPossibleStates('active', 'attendee')).toEqual(['deleting', 'failed']);
      expect(getNextPossibleStates('deleted', 'attendee')).toEqual([]);
    });
  });

  describe('isTerminalState', () => {
    it('should identify terminal states', () => {
      // For workshops, there are no truly terminal states as per the state machine rules
      expect(isTerminalState('completed', 'workshop')).toBe(false); // can transition to deleting
      expect(isTerminalState('deleting', 'workshop')).toBe(false); // can transition to completed or failed
      expect(isTerminalState('planning', 'workshop')).toBe(false);
      
      // For attendees, 'deleted' is terminal
      expect(isTerminalState('deleted', 'attendee')).toBe(true);
      expect(isTerminalState('active', 'attendee')).toBe(false);
    });
  });

  describe('getStateDescription', () => {
    it('should return descriptive text for workshop states', () => {
      expect(getStateDescription('planning', 'workshop')).toBe(
        'Workshop created, ready to deploy attendees'
      );
      expect(getStateDescription('active', 'workshop')).toBe(
        'All attendees successfully deployed'
      );
      expect(getStateDescription('completed', 'workshop')).toBe(
        'Workshop completed, resources cleaned up'
      );
    });

    it('should return descriptive text for attendee states', () => {
      expect(getStateDescription('planning', 'attendee')).toBe(
        'Attendee created, not yet deployed'
      );
      expect(getStateDescription('active', 'attendee')).toBe(
        'Attendee environment ready for use'
      );
      expect(getStateDescription('deleted', 'attendee')).toBe(
        'Attendee resources successfully removed'
      );
    });

    it('should return fallback description for unknown states', () => {
      expect(getStateDescription('unknown' as any, 'workshop')).toBe(
        'workshop is unknown'
      );
    });
  });
});