/**
 * Tests for WorkshopDetail popup replacements - POPUP-REPLACEMENT-001
 * Tests replacing remaining window.confirm and alert calls with custom dialogs
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
  useNavigate: () => jest.fn(),
}));

// Mock API services
jest.mock('../../services/api', () => ({
  workshopApi: {
    getWorkshop: jest.fn(),
    cleanupWorkshop: jest.fn(),
    deleteWorkshop: jest.fn(),
  },
  attendeeApi: {
    getWorkshopAttendees: jest.fn(),
    deleteAttendee: jest.fn(),
  },
  deploymentApi: {
    getAttendeeDeploymentLogs: jest.fn(),
  },
}));

const { workshopApi, attendeeApi, deploymentApi } = require('../../services/api');

describe('WorkshopDetail Popup Replacements', () => {
  let queryClient: QueryClient;

  const mockWorkshopActive = {
    id: 'test-workshop-id',
    name: 'Test Workshop',
    description: 'Test Description',
    start_date: '2025-07-23T09:00:00Z',
    end_date: '2025-07-23T17:00:00Z',
    status: 'active',
    template: 'Generic',
    timezone: 'UTC',
    created_at: '2025-07-23T08:00:00Z',
    updated_at: '2025-07-23T08:00:00Z',
    deletion_scheduled_at: null,
  };

  const mockAttendeeActive = {
    id: 'attendee-1',
    username: 'user1',
    email: 'user1@example.com',
    status: 'active',
    workshop_id: 'test-workshop-id',
    ovh_project_id: 'project-123',
    ovh_user_urn: null,
    created_at: '2025-07-23T08:00:00Z',
    updated_at: '2025-07-23T08:00:00Z',
    deletion_scheduled_at: null,
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
    workshopApi.getWorkshop.mockResolvedValue(mockWorkshopActive);
    attendeeApi.getWorkshopAttendees.mockResolvedValue([mockAttendeeActive]);
    deploymentApi.getAttendeeDeploymentLogs.mockResolvedValue([]);
    workshopApi.cleanupWorkshop.mockResolvedValue({ message: 'Cleanup started' });
    workshopApi.deleteWorkshop.mockResolvedValue({ message: 'Workshop deleted' });
    attendeeApi.deleteAttendee.mockResolvedValue({ message: 'Attendee deleted' });
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

  describe('Cleanup Workshop Confirmation', () => {
    it('should show custom confirmation dialog for cleanup instead of window.confirm', async () => {
      renderWithProviders(<WorkshopDetail />);

      await waitFor(() => {
        expect(screen.getByText('Test Workshop')).toBeInTheDocument();
      });

      // Find and click Cleanup Resources button
      const cleanupButton = screen.getByRole('button', { name: /cleanup resources/i });
      fireEvent.click(cleanupButton);

      // Should show custom dialog instead of browser confirm
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      expect(screen.getByText('Cleanup Resources')).toBeInTheDocument();
      expect(screen.getByText('This will destroy all workshop resources. Are you sure?')).toBeInTheDocument();
    });

    it('should call cleanupWorkshop when confirmed', async () => {
      renderWithProviders(<WorkshopDetail />);

      await waitFor(() => {
        expect(screen.getByText('Test Workshop')).toBeInTheDocument();
      });

      const cleanupButton = screen.getByRole('button', { name: /cleanup resources/i });
      fireEvent.click(cleanupButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /cleanup/i });
      fireEvent.click(confirmButton);

      expect(workshopApi.cleanupWorkshop).toHaveBeenCalledWith('test-workshop-id');
    });
  });

  describe('Delete Workshop Confirmation', () => {
    it('should show custom confirmation dialog for delete instead of window.confirm', async () => {
      // Make workshop ready for deletion (no active attendees)
      attendeeApi.getWorkshopAttendees.mockResolvedValue([]);
      
      renderWithProviders(<WorkshopDetail />);

      await waitFor(() => {
        expect(screen.getByText('Test Workshop')).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', { name: /delete workshop/i });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      expect(screen.getByText('Delete Workshop')).toBeInTheDocument();
      expect(screen.getByText('This will permanently delete the workshop. Are you sure?')).toBeInTheDocument();
    });
  });

  describe('Remove Attendee Confirmation', () => {
    it('should show custom confirmation dialog for attendee removal', async () => {
      renderWithProviders(<WorkshopDetail />);

      await waitFor(() => {
        expect(screen.getByText('Test Workshop')).toBeInTheDocument();
      });

      // Click attendee actions menu
      const actionsButton = screen.getByRole('button', { name: '' }); // EllipsisVerticalIcon button
      fireEvent.click(actionsButton);

      // Click remove attendee
      await waitFor(() => {
        const removeButton = screen.getByText('Remove Attendee');
        fireEvent.click(removeButton);
      });

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      expect(screen.getByText('Remove Attendee')).toBeInTheDocument();
      expect(screen.getByText('Remove user1 from the workshop?')).toBeInTheDocument();
    });
  });

  describe('Error Notifications', () => {
    it('should show custom notification dialog for errors instead of alert', async () => {
      // Make cleanup fail
      workshopApi.cleanupWorkshop.mockRejectedValue(new Error('Network error'));
      
      renderWithProviders(<WorkshopDetail />);

      await waitFor(() => {
        expect(screen.getByText('Test Workshop')).toBeInTheDocument();
      });

      const cleanupButton = screen.getByRole('button', { name: /cleanup resources/i });
      fireEvent.click(cleanupButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /cleanup/i });
      fireEvent.click(confirmButton);

      // Should show error notification dialog
      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument();
        expect(screen.getByText(/Failed to cleanup workshop/)).toBeInTheDocument();
      });
    });
  });
});