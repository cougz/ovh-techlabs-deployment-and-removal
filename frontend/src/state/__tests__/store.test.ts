/**
 * Tests for Centralized State Store
 * Validates STATE-MANAGEMENT-REVAMP-001 state management consistency
 */

import { renderHook, act } from '@testing-library/react';
import { useAppStore, useWorkshop, useAttendee, useWorkshopList } from '../store';
import { Workshop, WorkshopSummary, Attendee } from '../../types';

// Mock data
const mockWorkshop: Workshop = {
  id: 'workshop-1',
  name: 'Test Workshop',
  description: 'Test Description',
  start_date: '2025-07-23T09:00:00Z',
  end_date: '2025-07-23T17:00:00Z',
  status: 'planning',
  template: 'Generic',
  timezone: 'UTC',
  created_at: '2025-07-23T08:00:00Z',
  updated_at: '2025-07-23T08:00:00Z',
  deletion_scheduled_at: null,
};

const mockWorkshopSummary: WorkshopSummary = {
  id: 'workshop-1',
  name: 'Test Workshop',
  description: 'Test Description',
  start_date: '2025-07-23T09:00:00Z',
  end_date: '2025-07-23T17:00:00Z',
  status: 'planning',
  attendee_count: 2,
  active_attendees: 0,
  created_at: '2025-07-23T08:00:00Z',
  updated_at: '2025-07-23T08:00:00Z',
};

const mockAttendees: Attendee[] = [
  {
    id: 'attendee-1',
    username: 'user1',
    email: 'user1@example.com',
    status: 'planning',
    workshop_id: 'workshop-1',
    ovh_project_id: null,
    ovh_user_urn: null,
    created_at: '2025-07-23T08:00:00Z',
    updated_at: '2025-07-23T08:00:00Z',
    deletion_scheduled_at: null,
  },
  {
    id: 'attendee-2',
    username: 'user2',
    email: 'user2@example.com',
    status: 'planning',
    workshop_id: 'workshop-1',
    ovh_project_id: null,
    ovh_user_urn: null,
    created_at: '2025-07-23T08:00:00Z',
    updated_at: '2025-07-23T08:00:00Z',
    deletion_scheduled_at: null,
  },
];

describe('App Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAppStore.setState({
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
    }, true);
  });

  describe('Basic State Operations', () => {
    it('should set and get workshop data', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setWorkshop(mockWorkshop);
      });

      expect(result.current.getWorkshop('workshop-1')).toEqual(mockWorkshop);
    });

    it('should set and get workshop summaries', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setWorkshopSummaries([mockWorkshopSummary]);
      });

      expect(result.current.workshopSummaries['workshop-1']).toEqual(mockWorkshopSummary);
    });

    it('should set and get attendees with workshop relationship', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setAttendees('workshop-1', mockAttendees);
      });

      expect(result.current.getWorkshopAttendees('workshop-1')).toHaveLength(2);
      expect(result.current.getAttendee('attendee-1')).toEqual(mockAttendees[0]);
      expect(result.current.workshopAttendees['workshop-1']).toEqual(['attendee-1', 'attendee-2']);
    });
  });

  describe('State Transitions', () => {
    beforeEach(() => {
      const { result } = renderHook(() => useAppStore());
      act(() => {
        result.current.setWorkshop(mockWorkshop);
        result.current.setAttendees('workshop-1', mockAttendees);
      });
    });

    it('should transition workshop state with validation', async () => {
      const { result } = renderHook(() => useAppStore());

      await act(async () => {
        await result.current.transitionWorkshopState('workshop-1', 'deploying');
      });

      expect(result.current.getWorkshop('workshop-1')?.status).toBe('deploying');
      expect(result.current.getError('workshop-1')).toBeNull();
    });

    it('should reject invalid workshop state transitions', async () => {
      const { result } = renderHook(() => useAppStore());

      await act(async () => {
        await result.current.transitionWorkshopState('workshop-1', 'active'); // Invalid: planning -> active
      });

      // Should remain in planning state
      expect(result.current.getWorkshop('workshop-1')?.status).toBe('planning');
      expect(result.current.getError('workshop-1')).toContain('Cannot transition from planning to active');
    });

    it('should transition attendee state and update workshop state', async () => {
      const { result } = renderHook(() => useAppStore());

      // Transition both attendees to active
      await act(async () => {
        await result.current.transitionAttendeeState('attendee-1', 'deploying');
        await result.current.transitionAttendeeState('attendee-1', 'active');
        await result.current.transitionAttendeeState('attendee-2', 'deploying');
        await result.current.transitionAttendeeState('attendee-2', 'active');
      });

      expect(result.current.getAttendee('attendee-1')?.status).toBe('active');
      expect(result.current.getAttendee('attendee-2')?.status).toBe('active');
      // Workshop should automatically transition to active
      expect(result.current.getWorkshop('workshop-1')?.status).toBe('active');
    });

    it('should reject invalid attendee state transitions', async () => {
      const { result } = renderHook(() => useAppStore());

      await act(async () => {
        await result.current.transitionAttendeeState('attendee-1', 'active'); // Invalid: planning -> active
      });

      expect(result.current.getAttendee('attendee-1')?.status).toBe('planning');
      expect(result.current.getError('attendee-1')).toContain('Cannot transition from planning to active');
    });
  });

  describe('Optimistic Updates', () => {
    beforeEach(() => {
      const { result } = renderHook(() => useAppStore());
      act(() => {
        result.current.setWorkshop(mockWorkshop);
        result.current.setAttendees('workshop-1', mockAttendees);
      });
    });

    it('should apply optimistic workshop deployment update', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.applyOptimisticStateUpdate('workshop-1', { type: 'DEPLOY_WORKSHOP' });
      });

      expect(result.current.getEffectiveWorkshopState('workshop-1')).toBe('deploying');
      expect(result.current.ui.optimisticUpdates['workshop-1']).toBe('deploying');
    });

    it('should apply optimistic attendee deployment update', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.applyOptimisticStateUpdate('attendee-1', { type: 'DEPLOY_ATTENDEE' });
      });

      expect(result.current.getEffectiveAttendeeState('attendee-1')).toBe('deploying');
      expect(result.current.ui.optimisticUpdates['attendee-1']).toBe('deploying');
    });

    it('should clear optimistic updates', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.applyOptimisticStateUpdate('workshop-1', { type: 'DEPLOY_WORKSHOP' });
        result.current.clearOptimisticUpdate('workshop-1');
      });

      expect(result.current.getEffectiveWorkshopState('workshop-1')).toBe('planning');
      expect(result.current.ui.optimisticUpdates['workshop-1']).toBeUndefined();
    });
  });

  describe('Effective State Calculation', () => {
    beforeEach(() => {
      const { result } = renderHook(() => useAppStore());
      act(() => {
        result.current.setWorkshop(mockWorkshop);
        result.current.setAttendees('workshop-1', mockAttendees);
      });
    });

    it('should calculate effective workshop state based on attendees', () => {
      const { result } = renderHook(() => useAppStore());

      // Workshop is planning, but no attendees deployed
      expect(result.current.getEffectiveWorkshopState('workshop-1')).toBe('planning');

      act(() => {
        // Update one attendee to active
        result.current.attendees['attendee-1'].status = 'active';
      });

      // Should be deploying (partially deployed)
      expect(result.current.getEffectiveWorkshopState('workshop-1')).toBe('planning'); // Mixed states default to planning

      act(() => {
        // Update both attendees to active
        result.current.attendees['attendee-2'].status = 'active';
      });

      // Should be active (all deployed)
      expect(result.current.getEffectiveWorkshopState('workshop-1')).toBe('active');
    });

    it('should prioritize optimistic updates over calculated state', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.applyOptimisticStateUpdate('workshop-1', { type: 'CLEANUP_RESOURCES' });
      });

      expect(result.current.getEffectiveWorkshopState('workshop-1')).toBe('deleting');
    });
  });

  describe('UI State Management', () => {
    it('should manage loading states', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setLoading('workshop-1', true);
      });

      expect(result.current.isLoading('workshop-1')).toBe(true);

      act(() => {
        result.current.setLoading('workshop-1', false);
      });

      expect(result.current.isLoading('workshop-1')).toBe(false);
    });

    it('should manage error states', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setError('workshop-1', 'Test error');
      });

      expect(result.current.getError('workshop-1')).toBe('Test error');

      act(() => {
        result.current.setError('workshop-1', null);
      });

      expect(result.current.getError('workshop-1')).toBeNull();
    });
  });

  describe('Real-time State Management', () => {
    it('should manage WebSocket connection state', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setRealtimeConnected(true);
      });

      expect(result.current.realtime.connected).toBe(true);
      expect(result.current.realtime.lastUpdate).toBeGreaterThan(0);
    });

    it('should manage subscription state', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addRealtimeSubscription('workshop-1');
        result.current.addRealtimeSubscription('workshop-2');
      });

      expect(result.current.realtime.subscriptions.has('workshop-1')).toBe(true);
      expect(result.current.realtime.subscriptions.has('workshop-2')).toBe(true);

      act(() => {
        result.current.removeRealtimeSubscription('workshop-1');
      });

      expect(result.current.realtime.subscriptions.has('workshop-1')).toBe(false);
      expect(result.current.realtime.subscriptions.has('workshop-2')).toBe(true);
    });
  });
});

describe('Convenience Hooks', () => {
  beforeEach(() => {
    useAppStore.setState({
      workshops: { 'workshop-1': mockWorkshop },
      workshopSummaries: { 'workshop-1': mockWorkshopSummary },
      attendees: {
        'attendee-1': mockAttendees[0],
        'attendee-2': mockAttendees[1],
      },
      workshopAttendees: { 'workshop-1': ['attendee-1', 'attendee-2'] },
      ui: {
        loading: { 'workshop-1': false },
        errors: {},
        optimisticUpdates: {},
      },
      realtime: {
        connected: true,
        lastUpdate: Date.now(),
        subscriptions: new Set(['workshop-1']),
      },
    }, true);
  });

  describe('useWorkshop', () => {
    it('should return workshop with attendees and computed state', () => {
      const { result } = renderHook(() => useWorkshop('workshop-1'));

      expect(result.current.workshop).toEqual({
        ...mockWorkshop,
        attendees: mockAttendees,
      });
      expect(result.current.effectiveState).toBe('planning');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('useAttendee', () => {
    it('should return attendee with computed state', () => {
      const { result } = renderHook(() => useAttendee('attendee-1'));

      expect(result.current.attendee).toEqual(mockAttendees[0]);
      expect(result.current.effectiveState).toBe('planning');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('useWorkshopList', () => {
    it('should return workshop summaries', () => {
      const { result } = renderHook(() => useWorkshopList());

      expect(result.current.workshops).toEqual([mockWorkshopSummary]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });
});