/**
 * Tests for Dashboard status synchronization - DASHBOARD-STATE-SYNC-001
 * Tests that Dashboard shows consistent workshop status with WorkshopList
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import Dashboard from '../Dashboard';

// Mock API services
jest.mock('../../services/api', () => ({
  workshopApi: {
    getWorkshops: jest.fn(),
  },
  attendeeApi: {
    getAttendees: jest.fn(),
  },
}));

const { workshopApi, attendeeApi } = require('../../services/api');

describe('Dashboard Status Synchronization', () => {
  let queryClient: QueryClient;

  const mockWorkshopWithAllAttendeesDeployed = {
    id: 'workshop-1',
    name: 'Test Workshop',
    description: 'Test Description',
    start_date: '2025-07-23T09:00:00Z',
    end_date: '2025-07-23T17:00:00Z',
    status: 'planning', // Database status is still planning
    template: 'Generic',
    timezone: 'UTC',
    created_at: '2025-07-23T08:00:00Z',
    updated_at: '2025-07-23T08:00:00Z',
    deletion_scheduled_at: null,
    attendee_count: 3,
    active_attendees: 3, // All attendees are deployed
    failed_attendees: 0,
  };

  const mockWorkshopPartiallyDeployed = {
    id: 'workshop-2',
    name: 'Partial Workshop',
    description: 'Partial Description',
    start_date: '2025-07-23T09:00:00Z',
    end_date: '2025-07-23T17:00:00Z',
    status: 'planning',
    template: 'Generic',
    timezone: 'UTC',
    created_at: '2025-07-23T08:00:00Z',
    updated_at: '2025-07-23T08:00:00Z',
    deletion_scheduled_at: null,
    attendee_count: 5,
    active_attendees: 2, // Only some attendees deployed
    failed_attendees: 1,
  };

  const mockWorkshopNotDeployed = {
    id: 'workshop-3',
    name: 'Not Deployed Workshop',
    description: 'Not Deployed Description',
    start_date: '2025-07-23T09:00:00Z',
    end_date: '2025-07-23T17:00:00Z',
    status: 'planning',
    template: 'Generic',
    timezone: 'UTC',
    created_at: '2025-07-23T08:00:00Z',
    updated_at: '2025-07-23T08:00:00Z',
    deletion_scheduled_at: null,
    attendee_count: 3,
    active_attendees: 0, // No attendees deployed
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
      mockWorkshopWithAllAttendeesDeployed,
      mockWorkshopPartiallyDeployed,
      mockWorkshopNotDeployed,
    ]);
    attendeeApi.getAttendees.mockResolvedValue([]);
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

  describe('Workshop Status Display', () => {
    it('should show "active" status when all attendees are deployed (even if database status is planning)', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Test Workshop')).toBeInTheDocument();
      });

      // Find the workshop card and check its status
      const workshopCard = screen.getByText('Test Workshop').closest('li');
      expect(workshopCard).toBeInTheDocument();

      // Should show "active" status, not "planning"
      expect(workshopCard).toHaveTextContent('active');
      expect(workshopCard).not.toHaveTextContent('planning');

      // Should have active status styling
      const statusElement = workshopCard?.querySelector('.status-active');
      expect(statusElement).toBeInTheDocument();
    });

    it('should show "deploying" status when some attendees are deployed', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Partial Workshop')).toBeInTheDocument();
      });

      const workshopCard = screen.getByText('Partial Workshop').closest('li');
      expect(workshopCard).toBeInTheDocument();

      // Should show "deploying" status
      expect(workshopCard).toHaveTextContent('deploying');
      expect(workshopCard).not.toHaveTextContent('planning');

      // Should have deploying status styling
      const statusElement = workshopCard?.querySelector('.status-deploying');
      expect(statusElement).toBeInTheDocument();
    });

    it('should show "planning" status when no attendees are deployed', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Not Deployed Workshop')).toBeInTheDocument();
      });

      const workshopCard = screen.getByText('Not Deployed Workshop').closest('li');
      expect(workshopCard).toBeInTheDocument();

      // Should show "planning" status
      expect(workshopCard).toHaveTextContent('planning');

      // Should have planning status styling
      const statusElement = workshopCard?.querySelector('.status-planning');
      expect(statusElement).toBeInTheDocument();
    });

    it('should use raw database status for non-planning workshops', async () => {
      const mockActiveWorkshop = {
        ...mockWorkshopWithAllAttendeesDeployed,
        status: 'active',
      };

      workshopApi.getWorkshops.mockResolvedValue([mockActiveWorkshop]);

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Test Workshop')).toBeInTheDocument();
      });

      const workshopCard = screen.getByText('Test Workshop').closest('li');
      expect(workshopCard).toBeInTheDocument();

      // Should show the database status directly for non-planning workshops
      expect(workshopCard).toHaveTextContent('active');
    });
  });

  describe('Status Consistency with WorkshopList Logic', () => {
    it('should use same effective status logic as WorkshopList component', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Test Workshop')).toBeInTheDocument();
      });

      // Test the same scenarios that WorkshopList handles:

      // 1. All attendees deployed (3/3) with planning status -> should show "active"
      const fullyDeployedCard = screen.getByText('Test Workshop').closest('li');
      expect(fullyDeployedCard).toHaveTextContent('active');

      // 2. Partially deployed (2/5) with planning status -> should show "deploying" 
      const partialCard = screen.getByText('Partial Workshop').closest('li');
      expect(partialCard).toHaveTextContent('deploying');

      // 3. No attendees deployed (0/3) with planning status -> should show "planning"
      const notDeployedCard = screen.getByText('Not Deployed Workshop').closest('li');
      expect(notDeployedCard).toHaveTextContent('planning');
    });
  });
});