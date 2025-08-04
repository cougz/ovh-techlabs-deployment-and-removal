/**
 * Tests for WorkshopList cleanup button synchronization - CLEANUP-BUTTON-SYNC-001
 * Tests that WorkshopList cleanup button visibility matches WorkshopDetail logic
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import WorkshopList from '../WorkshopList';

// Mock API services
jest.mock('../../services/api', () => ({
  workshopApi: {
    getWorkshops: jest.fn(),
    cleanupWorkshop: jest.fn(),
    deleteWorkshop: jest.fn(),
  },
}));

const { workshopApi } = require('../../services/api');

describe('WorkshopList Cleanup Button Synchronization', () => {
  let queryClient: QueryClient;

  const mockWorkshopWithActiveAttendees = {
    id: 'workshop-1',
    name: 'Workshop With Active Resources',
    description: 'Test Description',
    start_date: '2025-07-23T09:00:00Z',
    end_date: '2025-07-23T17:00:00Z',
    status: 'active',
    template: 'Generic',
    timezone: 'UTC',
    created_at: '2025-07-23T08:00:00Z',
    updated_at: '2025-07-23T08:00:00Z',
    deletion_scheduled_at: null,
    attendee_count: 3,
    active_attendees: 2, // Has active attendees - should show cleanup button
    failed_attendees: 1,
  };

  const mockWorkshopWithoutActiveAttendees = {
    id: 'workshop-2',
    name: 'Workshop Without Active Resources',
    description: 'Test Description',
    start_date: '2025-07-23T09:00:00Z',
    end_date: '2025-07-23T17:00:00Z',
    status: 'active', // Workshop status is active
    template: 'Generic',
    timezone: 'UTC',
    created_at: '2025-07-23T08:00:00Z',
    updated_at: '2025-07-23T08:00:00Z',
    deletion_scheduled_at: null,
    attendee_count: 3,
    active_attendees: 0, // No active attendees - should NOT show cleanup button
    failed_attendees: 0,
  };

  const mockCompletedWorkshopWithActiveAttendees = {
    id: 'workshop-3',
    name: 'Completed Workshop With Active Resources',
    description: 'Test Description',
    start_date: '2025-07-23T09:00:00Z',
    end_date: '2025-07-23T17:00:00Z',
    status: 'completed',
    template: 'Generic',
    timezone: 'UTC',
    created_at: '2025-07-23T08:00:00Z',
    updated_at: '2025-07-23T08:00:00Z',
    deletion_scheduled_at: null,
    attendee_count: 2,
    active_attendees: 2, // Has active attendees - should show cleanup button
    failed_attendees: 0,
  };

  const mockCompletedWorkshopWithoutActiveAttendees = {
    id: 'workshop-4',
    name: 'Completed Workshop Without Active Resources',
    description: 'Test Description',
    start_date: '2025-07-23T09:00:00Z',
    end_date: '2025-07-23T17:00:00Z',
    status: 'completed',
    template: 'Generic',
    timezone: 'UTC',
    created_at: '2025-07-23T08:00:00Z',
    updated_at: '2025-07-23T08:00:00Z',
    deletion_scheduled_at: null,
    attendee_count: 2,
    active_attendees: 0, // No active attendees - should NOT show cleanup button
    failed_attendees: 0,
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    jest.clearAllMocks();

    // Setup default mock responses
    workshopApi.getWorkshops.mockResolvedValue([
      mockWorkshopWithActiveAttendees,
      mockWorkshopWithoutActiveAttendees,
      mockCompletedWorkshopWithActiveAttendees,
      mockCompletedWorkshopWithoutActiveAttendees,
    ]);
    workshopApi.cleanupWorkshop.mockResolvedValue({ message: 'Cleanup started' });
    workshopApi.deleteWorkshop.mockResolvedValue({ message: 'Workshop deleted' });
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          {ui}
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  const openWorkshopActionsMenu = async (workshopName: string) => {
    // Find and click the actions button (ellipsis) for the specific workshop
    const workshopCard = screen.getByText(workshopName).closest('.card');
    expect(workshopCard).toBeInTheDocument();
    
    // Look for the ellipsis button (EllipsisVerticalIcon)
    const actionsButton = workshopCard?.querySelector('button[aria-label="Actions"]') || 
                         workshopCard?.querySelector('svg[data-slot="icon"] + button') ||
                         workshopCard?.querySelector('button:last-child');
    expect(actionsButton).toBeInTheDocument();
    
    fireEvent.click(actionsButton!);
    
    // Wait for dropdown menu to appear
    await waitFor(() => {
      const menu = screen.getByTestId('dropdown-menu') || 
                   document.querySelector('[role="menu"]') ||
                   screen.getByText('Cleanup Resources').closest('div');
      expect(menu).toBeInTheDocument();
    });
  };

  describe('Active Workshop Cleanup Button Visibility', () => {
    it('should show cleanup button for active workshop with active attendees', async () => {
      renderWithProviders(<WorkshopList />);

      await waitFor(() => {
        expect(screen.getByText('Workshop With Active Resources')).toBeInTheDocument();
      });

      await openWorkshopActionsMenu('Workshop With Active Resources');

      // Should show cleanup button
      expect(screen.getByText('Cleanup Resources')).toBeInTheDocument();
    });

    it('should NOT show cleanup button for active workshop without active attendees', async () => {
      renderWithProviders(<WorkshopList />);

      await waitFor(() => {
        expect(screen.getByText('Workshop Without Active Resources')).toBeInTheDocument();
      });

      await openWorkshopActionsMenu('Workshop Without Active Resources');

      // Should NOT show cleanup button when no active attendees
      expect(screen.queryByText('Cleanup Resources')).not.toBeInTheDocument();
    });
  });

  describe('Completed Workshop Cleanup Button Visibility', () => {
    it('should show cleanup button for completed workshop with active attendees', async () => {
      renderWithProviders(<WorkshopList />);

      await waitFor(() => {
        expect(screen.getByText('Completed Workshop With Active Resources')).toBeInTheDocument();
      });

      await openWorkshopActionsMenu('Completed Workshop With Active Resources');

      // Should show cleanup button
      expect(screen.getByText('Cleanup Resources')).toBeInTheDocument();
    });

    it('should NOT show cleanup button for completed workshop without active attendees', async () => {
      renderWithProviders(<WorkshopList />);

      await waitFor(() => {
        expect(screen.getByText('Completed Workshop Without Active Resources')).toBeInTheDocument();
      });

      await openWorkshopActionsMenu('Completed Workshop Without Active Resources');

      // Should NOT show cleanup button when no active attendees
      expect(screen.queryByText('Cleanup Resources')).not.toBeInTheDocument();
    });
  });

  describe('Consistency with WorkshopDetail Logic', () => {
    it('should use same logic as WorkshopDetail needsCleanup check', async () => {
      renderWithProviders(<WorkshopList />);

      await waitFor(() => {
        expect(screen.getByText('Workshop With Active Resources')).toBeInTheDocument();
      });

      // Test that cleanup button visibility matches WorkshopDetail logic:
      // WorkshopDetail shows cleanup when: needsCleanup && (status === 'active' || status === 'completed' || hasDeployedAttendees)
      // needsCleanup = attendees.some(a => ['active', 'failed'].includes(a.status))
      // This translates to: workshop has active_attendees > 0 for the list view

      // Workshop with active attendees (2) should show cleanup button
      await openWorkshopActionsMenu('Workshop With Active Resources');
      expect(screen.getByText('Cleanup Resources')).toBeInTheDocument();
      
      // Close menu
      fireEvent.click(document.body);
      
      // Workshop without active attendees (0) should NOT show cleanup button
      await openWorkshopActionsMenu('Workshop Without Active Resources');
      expect(screen.queryByText('Cleanup Resources')).not.toBeInTheDocument();
    });

    it('should handle edge case of failed attendees correctly', async () => {
      // Test with a workshop that has failed attendees but no active attendees
      const mockWorkshopWithFailedOnly = {
        ...mockWorkshopWithoutActiveAttendees,
        name: 'Workshop With Failed Only',
        active_attendees: 0,
        failed_attendees: 2, // Has failed attendees but no active ones
      };

      workshopApi.getWorkshops.mockResolvedValue([mockWorkshopWithFailedOnly]);

      renderWithProviders(<WorkshopList />);

      await waitFor(() => {
        expect(screen.getByText('Workshop With Failed Only')).toBeInTheDocument();
      });

      await openWorkshopActionsMenu('Workshop With Failed Only');

      // Should NOT show cleanup button when only failed attendees exist
      // (since active_attendees = 0, there are no active resources to clean)
      expect(screen.queryByText('Cleanup Resources')).not.toBeInTheDocument();
    });
  });
});