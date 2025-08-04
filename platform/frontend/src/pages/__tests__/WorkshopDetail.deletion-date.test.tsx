import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import WorkshopDetail from '../WorkshopDetail';
import { workshopApi, attendeeApi } from '../../services/api';

// Mock the APIs
jest.mock('../../services/api');
const mockedWorkshopApi = workshopApi as jest.Mocked<typeof workshopApi>;
const mockedAttendeeApi = attendeeApi as jest.Mocked<typeof attendeeApi>;

// Mock WebSocket hook to avoid WebSocket connections during tests
jest.mock('../../hooks/useWebSocket', () => ({
  useWebSocket: jest.fn().mockReturnValue({
    isConnected: true,
    connectionError: null,
    sendMessage: jest.fn(),
    reconnect: jest.fn(),
    disconnect: jest.fn(),
  })
}));

// Mock navigate
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
  useParams: () => ({ id: 'test-workshop-id' }),
}));

const renderComponent = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <WorkshopDetail />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('WorkshopDetail - Deletion Date Display', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock workshop data
    mockedWorkshopApi.getWorkshop.mockResolvedValue({
      id: 'test-workshop-id',
      name: 'Test Workshop',
      description: 'Test workshop description',
      start_date: '2025-07-25T10:00:00Z',
      end_date: '2025-07-25T18:00:00Z',
      status: 'active',
      created_at: '2025-07-21T15:58:41Z',
      updated_at: '2025-07-21T15:58:41Z',
    });
  });

  it('should display deletion date for attendees scheduled for deletion', async () => {
    // Mock attendees with scheduled deletion
    const deletionDate = '2025-07-28T18:00:00Z';
    mockedAttendeeApi.getWorkshopAttendees.mockResolvedValue([
      {
        id: 'attendee-1',
        workshop_id: 'test-workshop-id',
        username: 'john-doe',
        email: 'john.doe@techlab.ovh',
        status: 'active',
        ovh_project_id: '123e4567-e89b-12d3-a456-426614174000',
        ovh_user_urn: 'urn:v1:eu:identity:user:cc1882189-ovh/john-doe',
        created_at: '2025-07-21T15:58:41Z',
        updated_at: '2025-07-21T15:58:41Z',
        deletion_scheduled_at: deletionDate
      }
    ]);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Workshop')).toBeInTheDocument();
    });

    // Should display deletion date
    await waitFor(() => {
      expect(screen.getByText(/will be deleted on/i)).toBeInTheDocument();
      expect(screen.getByText(/july 28, 2025/i)).toBeInTheDocument();
    });
  });

  it('should not display deletion date for attendees not scheduled for deletion', async () => {
    // Mock attendees without scheduled deletion
    mockedAttendeeApi.getWorkshopAttendees.mockResolvedValue([
      {
        id: 'attendee-1',
        workshop_id: 'test-workshop-id',
        username: 'john-doe',
        email: 'john.doe@techlab.ovh',
        status: 'active',
        ovh_project_id: '123e4567-e89b-12d3-a456-426614174000',
        ovh_user_urn: 'urn:v1:eu:identity:user:cc1882189-ovh/john-doe',
        created_at: '2025-07-21T15:58:41Z',
        updated_at: '2025-07-21T15:58:41Z',
        // No deletion_scheduled_at field
      }
    ]);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Workshop')).toBeInTheDocument();
    });

    // Should NOT display deletion date
    await waitFor(() => {
      expect(screen.queryByText(/will be deleted on/i)).not.toBeInTheDocument();
    });
  });

  it('should format deletion date correctly', async () => {
    const deletionDate = '2025-07-30T14:30:00Z'; // More predictable time
    mockedAttendeeApi.getWorkshopAttendees.mockResolvedValue([
      {
        id: 'attendee-1',
        workshop_id: 'test-workshop-id',
        username: 'jane-smith',
        email: 'jane.smith@techlab.ovh',
        status: 'active',
        ovh_project_id: '456e7890-e12b-34d5-a789-567812345678',
        ovh_user_urn: 'urn:v1:eu:identity:user:cc1882189-ovh/jane-smith',
        created_at: '2025-07-21T15:58:41Z',
        updated_at: '2025-07-21T15:58:41Z',
        deletion_scheduled_at: deletionDate
      }
    ]);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Workshop')).toBeInTheDocument();
    });

    // Should format the date properly - check for the main components
    await waitFor(() => {
      expect(screen.getByText(/will be deleted on july 30, 2025/i)).toBeInTheDocument();
      // Just verify it contains time formatting (the exact format may vary based on locale)
      expect(screen.getByText(/will be deleted on july 30, 2025 at \d+:\d+/i)).toBeInTheDocument();
    });
  });

  it('should show deletion date for completed workshops', async () => {
    // Mock completed workshop
    mockedWorkshopApi.getWorkshop.mockResolvedValueOnce({
      id: 'test-workshop-id',
      name: 'Test Workshop',
      description: 'Test workshop description',
      start_date: '2025-07-25T10:00:00Z',
      end_date: '2025-07-25T18:00:00Z',
      status: 'completed',
      created_at: '2025-07-21T15:58:41Z',
      updated_at: '2025-07-21T15:58:41Z',
    });

    const deletionDate = '2025-07-28T18:00:00Z';
    mockedAttendeeApi.getWorkshopAttendees.mockResolvedValue([
      {
        id: 'attendee-1',
        workshop_id: 'test-workshop-id',
        username: 'john-doe',
        email: 'john.doe@techlab.ovh',
        status: 'active',
        ovh_project_id: '123e4567-e89b-12d3-a456-426614174000',
        ovh_user_urn: 'urn:v1:eu:identity:user:cc1882189-ovh/john-doe',
        created_at: '2025-07-21T15:58:41Z',
        updated_at: '2025-07-21T15:58:41Z',
        deletion_scheduled_at: deletionDate
      }
    ]);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Workshop')).toBeInTheDocument();
    });

    // Should still show deletion date for completed workshops
    await waitFor(() => {
      expect(screen.getByText(/will be deleted on/i)).toBeInTheDocument();
    });
  });

  it('should show different deletion dates for different attendees', async () => {
    mockedAttendeeApi.getWorkshopAttendees.mockResolvedValue([
      {
        id: 'attendee-1',
        workshop_id: 'test-workshop-id',
        username: 'john-doe',
        email: 'john.doe@techlab.ovh',
        status: 'active',
        ovh_project_id: '123e4567-e89b-12d3-a456-426614174000',
        ovh_user_urn: 'urn:v1:eu:identity:user:cc1882189-ovh/john-doe',
        created_at: '2025-07-21T15:58:41Z',
        updated_at: '2025-07-21T15:58:41Z',
        deletion_scheduled_at: '2025-07-28T18:00:00Z'
      },
      {
        id: 'attendee-2',
        workshop_id: 'test-workshop-id',
        username: 'jane-smith',
        email: 'jane.smith@techlab.ovh',
        status: 'active',
        ovh_project_id: '456e7890-e12b-34d5-a789-567812345678',
        ovh_user_urn: 'urn:v1:eu:identity:user:cc1882189-ovh/jane-smith',
        created_at: '2025-07-21T15:58:41Z',
        updated_at: '2025-07-21T15:58:41Z',
        deletion_scheduled_at: '2025-07-30T12:00:00Z'
      },
      {
        id: 'attendee-3',
        workshop_id: 'test-workshop-id',
        username: 'bob-wilson',
        email: 'bob.wilson@techlab.ovh',
        status: 'active',
        ovh_project_id: '789e1234-e56b-78d9-a012-345678901234',
        ovh_user_urn: 'urn:v1:eu:identity:user:cc1882189-ovh/bob-wilson',
        created_at: '2025-07-21T15:58:41Z',
        updated_at: '2025-07-21T15:58:41Z',
        // No deletion scheduled
      }
    ]);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Workshop')).toBeInTheDocument();
    });

    // Should show different deletion dates
    await waitFor(() => {
      // Two different deletion dates should be visible
      expect(screen.getByText(/july 28, 2025/i)).toBeInTheDocument();
      expect(screen.getByText(/july 30, 2025/i)).toBeInTheDocument();
      
      // But only 2 deletion messages (third attendee has no deletion scheduled)
      expect(screen.getAllByText(/will be deleted on/i)).toHaveLength(2);
    });
  });

  it('should handle invalid deletion date gracefully', async () => {
    mockedAttendeeApi.getWorkshopAttendees.mockResolvedValue([
      {
        id: 'attendee-1',
        workshop_id: 'test-workshop-id',
        username: 'john-doe',
        email: 'john.doe@techlab.ovh',
        status: 'active',
        ovh_project_id: '123e4567-e89b-12d3-a456-426614174000',
        ovh_user_urn: 'urn:v1:eu:identity:user:cc1882189-ovh/john-doe',
        created_at: '2025-07-21T15:58:41Z',
        updated_at: '2025-07-21T15:58:41Z',
        deletion_scheduled_at: 'invalid-date'
      }
    ]);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Workshop')).toBeInTheDocument();
    });

    // Should gracefully handle invalid date - either show nothing or show error text
    await waitFor(() => {
      // Should not crash and should show attendee
      expect(screen.getByText('john-doe')).toBeInTheDocument();
      
      // Invalid date should either not be shown or show as "Invalid date"
      const deletionTexts = screen.queryAllByText(/will be deleted on/i);
      if (deletionTexts.length > 0) {
        expect(screen.getByText(/invalid date/i)).toBeInTheDocument();
      }
    });
  });
});