/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import WorkshopList from '../WorkshopList';
import workshopSlice from '../../store/slices/workshopSlice';
import { WorkshopSummary } from '../../types/schemas';

// Mock the WebSocket hook
jest.mock('../../hooks/useWebSocket', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    isConnected: false,
    error: null,
    connect: jest.fn(),
    disconnect: jest.fn(),
  })),
}));

// Mock the API calls
jest.mock('../../store/slices/workshopSlice', () => ({
  ...jest.requireActual('../../store/slices/workshopSlice'),
  fetchWorkshops: jest.fn(() => ({ type: 'workshops/fetch/fulfilled', payload: [] })),
}));

describe('WorkshopList State Consistency', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        workshops: workshopSlice.reducer,
      },
      preloadedState: {
        workshops: {
          workshops: [],
          loading: false,
          error: null,
        },
      },
    });

    // Clear all mocks
    jest.clearAllMocks();
  });

  const renderWorkshopList = () => {
    return render(
      <Provider store={store}>
        <BrowserRouter>
          <WorkshopList />
        </BrowserRouter>
      </Provider>
    );
  };

  describe('Improved State Consistency During Cleanup', () => {
    it('should show consistent deleting state during cleanup process', () => {
      // Workshop that would previously show confusing state transitions
      const workshopInCleanup: WorkshopSummary = {
        id: 'workshop-cleanup-test',
        name: 'Workshop Being Cleaned Up',
        description: 'A workshop that expired and is being cleaned up',
        status: 'deleting', // Key: Backend now preserves this state
        start_date: '2024-01-15T10:00:00Z',
        end_date: '2024-01-15T18:00:00Z',
        timezone: 'UTC',
        template: 'Generic',
        attendee_count: 2,
        active_attendees: 2, // Attendees still active (cleanup not finished)
        created_at: '2024-01-14T09:00:00Z',
        updated_at: '2024-01-16T10:30:00Z',
        deletion_scheduled_at: '2024-01-16T10:00:00Z'
      };

      // Set workshop data in store
      store.dispatch({
        type: 'workshops/setWorkshops',
        payload: [workshopInCleanup]
      });

      renderWorkshopList();

      // Should show 'Deleting' status consistently
      expect(screen.getByText('Deleting')).toBeInTheDocument();
      
      // Should NOT show 'Active' (the old problematic behavior)
      expect(screen.queryByText('Active')).not.toBeInTheDocument();
      
      // Should show appropriate visual indicators for deleting state
      const statusIndicator = screen.getByText('Deleting').closest('[class*="bg-orange"]');
      expect(statusIndicator).toBeInTheDocument();
    });

    it('should handle transition from deleting to completed correctly', async () => {
      // Initial state: workshop being deleted
      const initialWorkshop: WorkshopSummary = {
        id: 'workshop-transition-test',
        name: 'Workshop Transitioning',
        description: 'A workshop transitioning from deleting to completed',
        status: 'deleting',
        start_date: '2024-01-15T10:00:00Z',
        end_date: '2024-01-15T18:00:00Z',
        timezone: 'UTC',
        template: 'Generic',
        attendee_count: 2,
        active_attendees: 2, // Still being cleaned up
        created_at: '2024-01-14T09:00:00Z',
        updated_at: '2024-01-16T10:30:00Z',
        deletion_scheduled_at: '2024-01-16T10:00:00Z'
      };

      store.dispatch({
        type: 'workshops/setWorkshops',
        payload: [initialWorkshop]
      });

      renderWorkshopList();

      // Initially shows deleting
      expect(screen.getByText('Deleting')).toBeInTheDocument();

      // Simulate cleanup completion via WebSocket update
      const completedWorkshop: WorkshopSummary = {
        ...initialWorkshop,
        status: 'completed',
        active_attendees: 0, // All attendees cleaned up
        updated_at: '2024-01-16T10:35:00Z'
      };

      // Update the workshop in store
      store.dispatch({
        type: 'workshops/setWorkshops',
        payload: [completedWorkshop]
      });

      // Should now show completed
      await waitFor(() => {
        expect(screen.getByText('Completed')).toBeInTheDocument();
      });

      // Should no longer show deleting
      expect(screen.queryByText('Deleting')).not.toBeInTheDocument();
    });

    it('should show deploying state consistently during deployment', () => {
      // Workshop in deployment (another lifecycle state)
      const deployingWorkshop: WorkshopSummary = {
        id: 'workshop-deploying-test',
        name: 'Workshop Being Deployed',
        description: 'A workshop currently being deployed',
        status: 'deploying', // Backend preserves this lifecycle state
        start_date: '2024-01-20T10:00:00Z',
        end_date: '2024-01-20T18:00:00Z',
        timezone: 'UTC',
        template: 'Generic',
        attendee_count: 3,
        active_attendees: 1, // Partial deployment
        created_at: '2024-01-19T09:00:00Z',
        updated_at: '2024-01-20T09:30:00Z'
      };

      store.dispatch({
        type: 'workshops/setWorkshops',
        payload: [deployingWorkshop]
      });

      renderWorkshopList();

      // Should show 'Deploying' status consistently
      expect(screen.getByText('Deploying')).toBeInTheDocument();
      
      // Should show deploying visual indicators (spinner, warning colors)
      const statusIndicator = screen.getByText('Deploying').closest('[class*="bg-warning"]');
      expect(statusIndicator).toBeInTheDocument();
    });

    it('should not show confusing state sequence anymore', () => {
      // This test verifies that the old problematic sequence doesn't happen
      // Old sequence: active -> deleting -> active -> completed
      // Fixed sequence: active -> deleting -> deleting -> completed

      const workshops: WorkshopSummary[] = [
        {
          id: 'workshop-consistent-1',
          name: 'Consistent Workshop 1',
          description: 'Workshop with consistent state',
          status: 'deleting', // Should stay deleting during cleanup
          start_date: '2024-01-15T10:00:00Z',
          end_date: '2024-01-15T18:00:00Z',
          timezone: 'UTC',
          template: 'Generic',
          attendee_count: 2,
          active_attendees: 2, // Cleanup in progress
          created_at: '2024-01-14T09:00:00Z',
          updated_at: '2024-01-16T10:30:00Z'
        },
        {
          id: 'workshop-consistent-2',
          name: 'Consistent Workshop 2',
          description: 'Another workshop with consistent state',
          status: 'deploying', // Should stay deploying during deployment
          start_date: '2024-01-20T10:00:00Z',
          end_date: '2024-01-20T18:00:00Z',
          timezone: 'UTC',
          template: 'Generic',
          attendee_count: 3,
          active_attendees: 1, // Deployment in progress
          created_at: '2024-01-19T09:00:00Z',
          updated_at: '2024-01-20T09:30:00Z'
        }
      ];

      store.dispatch({
        type: 'workshops/setWorkshops',
        payload: workshops
      });

      renderWorkshopList();

      // Verify consistent states are shown
      expect(screen.getByText('Deleting')).toBeInTheDocument();
      expect(screen.getByText('Deploying')).toBeInTheDocument();
      
      // Verify we don't have conflicting states for the same workshops
      const deletingElements = screen.getAllByText('Deleting');
      const deployingElements = screen.getAllByText('Deploying');
      
      expect(deletingElements).toHaveLength(1);
      expect(deployingElements).toHaveLength(1);
      
      // Should not show active for workshops that are in lifecycle states
      // (This would be the old problematic behavior)
      const activeElements = screen.queryAllByText('Active');
      expect(activeElements).toHaveLength(0);
    });
  });

  describe('Status Utils Integration', () => {
    it('should use getEffectiveStatus consistently with backend state preservation', () => {
      // Test that frontend status utils work with the backend fix
      const workshopWithPreservedState: WorkshopSummary = {
        id: 'workshop-preserved-state',
        name: 'Workshop with Preserved State',
        description: 'Workshop where backend preserves lifecycle state',
        status: 'deleting', // Backend preserves this
        start_date: '2024-01-15T10:00:00Z',
        end_date: '2024-01-15T18:00:00Z',
        timezone: 'UTC',
        template: 'Generic',
        attendee_count: 2,
        active_attendees: 2, // Would normally suggest 'active', but backend preserves 'deleting'
        created_at: '2024-01-14T09:00:00Z',
        updated_at: '2024-01-16T10:30:00Z'
      };

      store.dispatch({
        type: 'workshops/setWorkshops',
        payload: [workshopWithPreservedState]
      });

      renderWorkshopList();

      // Frontend should respect the backend's preserved state
      expect(screen.getByText('Deleting')).toBeInTheDocument();
      
      // Should show deleting-specific styling
      const deletingBadge = screen.getByText('Deleting').closest('span');
      expect(deletingBadge).toHaveClass('bg-orange-100', 'text-orange-800');
    });

    it('should handle normal status calculation for non-lifecycle states', () => {
      // Non-lifecycle states should still use normal status calculation
      const workshopNormalState: WorkshopSummary = {
        id: 'workshop-normal-state',
        name: 'Workshop Normal State',
        description: 'Workshop with normal state calculation',
        status: 'planning', // Non-lifecycle state
        start_date: '2024-01-25T10:00:00Z',
        end_date: '2024-01-25T18:00:00Z',
        timezone: 'UTC',
        template: 'Generic',
        attendee_count: 3,
        active_attendees: 3, // All deployed - should show as active
        created_at: '2024-01-24T09:00:00Z',
        updated_at: '2024-01-25T09:30:00Z'
      };

      store.dispatch({
        type: 'workshops/setWorkshops',
        payload: [workshopNormalState]
      });

      renderWorkshopList();

      // For non-lifecycle states, should calculate effective status
      // Since all attendees are active, should show Active
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });

  describe('Real-time Updates Integration', () => {
    it('should handle WebSocket updates for state transitions correctly', async () => {
      // Test that WebSocket updates work with the improved state consistency
      const initialWorkshop: WorkshopSummary = {
        id: 'workshop-websocket-test',
        name: 'Workshop WebSocket Test',
        description: 'Testing WebSocket state updates',
        status: 'active',
        start_date: '2024-01-15T10:00:00Z',
        end_date: '2024-01-15T18:00:00Z',
        timezone: 'UTC',
        template: 'Generic',
        attendee_count: 2,
        active_attendees: 2,
        created_at: '2024-01-14T09:00:00Z',
        updated_at: '2024-01-16T10:30:00Z'
      };

      store.dispatch({
        type: 'workshops/setWorkshops',
        payload: [initialWorkshop]
      });

      renderWorkshopList();

      // Initially active
      expect(screen.getByText('Active')).toBeInTheDocument();

      // Simulate WebSocket update: workshop starts cleanup
      const updatedWorkshop: WorkshopSummary = {
        ...initialWorkshop,
        status: 'deleting', // Backend sets to deleting
        updated_at: '2024-01-16T10:35:00Z'
      };

      store.dispatch({
        type: 'workshops/updateWorkshop',
        payload: updatedWorkshop
      });

      // Should update to deleting
      await waitFor(() => {
        expect(screen.getByText('Deleting')).toBeInTheDocument();
      });

      // Should no longer show active
      expect(screen.queryByText('Active')).not.toBeInTheDocument();
    });
  });
});