/**
 * Tests for WorkshopDetail ConfirmDialog integration
 * Validates replacement of window.confirm with custom ConfirmDialog
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import WorkshopDetail from '../WorkshopDetail';

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ id: 'test-workshop-id' }),
}));

// Mock API services
jest.mock('../../services/api', () => ({
  workshopApi: {
    getWorkshop: jest.fn(),
    deployWorkshop: jest.fn(),
    cleanupWorkshop: jest.fn(),
    deleteWorkshop: jest.fn(),
  },
  attendeeApi: {
    getWorkshopAttendees: jest.fn(),
    deleteAttendee: jest.fn(),
  },
}));

const { workshopApi, attendeeApi } = require('../../services/api');

describe('WorkshopDetail ConfirmDialog Integration', () => {
  let queryClient: QueryClient;

  const mockWorkshop = {
    id: 'test-workshop-id',
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

  const mockAttendees = [
    {
      id: 'attendee-1',
      username: 'user1',
      email: 'user1@example.com',
      status: 'planning',
      workshop_id: 'test-workshop-id',
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
      workshop_id: 'test-workshop-id',
      ovh_project_id: null,
      ovh_user_urn: null,
      created_at: '2025-07-23T08:00:00Z',
      updated_at: '2025-07-23T08:00:00Z',
      deletion_scheduled_at: null,
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Reset mocks
    jest.clearAllMocks();

    // Setup default mock responses
    workshopApi.getWorkshop.mockResolvedValue(mockWorkshop);
    attendeeApi.getWorkshopAttendees.mockResolvedValue(mockAttendees);
    workshopApi.deployWorkshop.mockResolvedValue({ message: 'Deployment started' });
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

  describe('Deploy Workshop Confirmation', () => {
    it('should show custom confirmation dialog instead of window.confirm', async () => {
      renderWithProviders(<WorkshopDetail />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText('Test Workshop')).toBeInTheDocument();
      });

      // Find and click Deploy Workshop button
      const deployButton = screen.getByRole('button', { name: /deploy workshop/i });
      fireEvent.click(deployButton);

      // Should show custom dialog instead of browser confirm
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      expect(screen.getByRole('dialog')).toHaveTextContent('Deploy Workshop');
      expect(screen.getByText('Deploy workshop resources for 2 attendees?')).toBeInTheDocument();
    });

    it('should call deployWorkshop when confirmed', async () => {
      renderWithProviders(<WorkshopDetail />);

      await waitFor(() => {
        expect(screen.getByText('Test Workshop')).toBeInTheDocument();
      });

      // Click Deploy Workshop button
      const deployButton = screen.getByRole('button', { name: /deploy workshop/i });
      fireEvent.click(deployButton);

      // Wait for dialog and confirm
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: 'Deploy' });
      fireEvent.click(confirmButton);

      // Should call the API
      expect(workshopApi.deployWorkshop).toHaveBeenCalledWith('test-workshop-id');
    });

    it('should not call deployWorkshop when cancelled', async () => {
      renderWithProviders(<WorkshopDetail />);

      await waitFor(() => {
        expect(screen.getByText('Test Workshop')).toBeInTheDocument();
      });

      // Click Deploy Workshop button
      const deployButton = screen.getByRole('button', { name: /deploy workshop/i });
      fireEvent.click(deployButton);

      // Wait for dialog and cancel
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      // Should not call the API
      expect(workshopApi.deployWorkshop).not.toHaveBeenCalled();
    });

    it('should close dialog after cancelling', async () => {
      renderWithProviders(<WorkshopDetail />);

      await waitFor(() => {
        expect(screen.getByText('Test Workshop')).toBeInTheDocument();
      });

      // Click Deploy Workshop button
      const deployButton = screen.getByRole('button', { name: /deploy workshop/i });
      fireEvent.click(deployButton);

      // Wait for dialog
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Cancel
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      // Dialog should be closed
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should handle workshop with no attendees correctly', async () => {
      attendeeApi.getWorkshopAttendees.mockResolvedValue([]);
      
      renderWithProviders(<WorkshopDetail />);

      await waitFor(() => {
        expect(screen.getByText('Test Workshop')).toBeInTheDocument();
      });

      // Click Deploy Workshop button
      const deployButton = screen.getByRole('button', { name: /deploy workshop/i });
      fireEvent.click(deployButton);

      // Should show notification dialog about no attendees instead of confirmation dialog
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
      
      expect(screen.getByText('Validation Error')).toBeInTheDocument();
      expect(screen.getByText('Please add attendees before deploying the workshop')).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should close dialog with Escape key', async () => {
      renderWithProviders(<WorkshopDetail />);

      await waitFor(() => {
        expect(screen.getByText('Test Workshop')).toBeInTheDocument();
      });

      // Open dialog
      const deployButton = screen.getByRole('button', { name: /deploy workshop/i });
      fireEvent.click(deployButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Press Escape
      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

      // Dialog should close
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes on dialog', async () => {
      renderWithProviders(<WorkshopDetail />);

      await waitFor(() => {
        expect(screen.getByText('Test Workshop')).toBeInTheDocument();
      });

      // Open dialog
      const deployButton = screen.getByRole('button', { name: /deploy workshop/i });
      fireEvent.click(deployButton);

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-labelledby');
      });
    });
  });
});