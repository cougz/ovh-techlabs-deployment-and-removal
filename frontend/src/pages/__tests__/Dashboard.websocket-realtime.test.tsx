import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import '@testing-library/jest-dom';
import Dashboard from '../Dashboard';
import { workshopApi } from '../../services/api';
import type { WorkshopSummary } from '../../types';

// Mock the APIs
jest.mock('../../services/api');
const mockedWorkshopApi = workshopApi as jest.Mocked<typeof workshopApi>;

// Mock useGlobalWebSocket hook to simulate WebSocket behavior
jest.mock('../../hooks/useGlobalWebSocket', () => ({
  useGlobalWebSocket: ({ onStatusUpdate }: any) => {
    // Store the callback for testing
    (global as any).__testDashboardWebSocketCallback = (workshopId: string, entityType: string, entityId: string, status: string) => {
      onStatusUpdate?.(workshopId, entityType, entityId, status);
    };
    
    return {
      isConnected: true,
      connectionError: null,
      sendMessage: jest.fn(),
      reconnect: jest.fn(),
      disconnect: jest.fn(),
    };
  }
}));

const mockWorkshopsStuckDeploying: WorkshopSummary[] = [
  {
    id: 'workshop-1',
    name: 'Stuck Workshop',
    description: 'Workshop stuck at deploying status',
    start_date: '2025-07-30T10:00:00Z',
    end_date: '2025-07-30T18:00:00Z',
    status: 'deploying', // Raw status is deploying
    attendee_count: 2,
    active_attendees: 2, // But all attendees are active - should show as active
    created_at: '2025-07-30T09:00:00Z',
    updated_at: '2025-07-30T09:00:00Z',
    timezone: 'UTC',
    template: 'Generic'
  },
  {
    id: 'workshop-2',
    name: 'Planning Workshop',
    description: 'Workshop still in planning',
    start_date: '2025-07-31T10:00:00Z',
    end_date: '2025-07-31T18:00:00Z',
    status: 'planning',
    attendee_count: 3,
    active_attendees: 0,
    created_at: '2025-07-30T09:00:00Z',
    updated_at: '2025-07-30T09:00:00Z',
    timezone: 'UTC',
    template: 'Generic'
  }
];

describe('Dashboard - Real-time WebSocket Updates', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { 
          retry: false,
          staleTime: 0,
          refetchInterval: false,
        },
        mutations: { retry: false },
      },
    });
    
    // Mock initial API response
    mockedWorkshopApi.getWorkshops.mockResolvedValue(mockWorkshopsStuckDeploying);
  });

  afterEach(() => {
    delete (global as any).__testDashboardWebSocketCallback;
  });

  it('should show effective status for workshops stuck in deploying', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Dashboard />
        </BrowserRouter>
      </QueryClientProvider>
    );

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByText('Stuck Workshop')).toBeInTheDocument();
      expect(screen.getByText('Planning Workshop')).toBeInTheDocument();
    });

    // Workshop 1 should show as Active (effective status) despite DB status being deploying
    // because all attendees are active (2/2)
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Planning')).toBeInTheDocument();
    
    // Statistics should reflect effective status:
    // - Total Workshops: 2
    // - Active Workshops: 1 (workshop-1 with effective status active)
    // - Total Attendees: 5 (2 + 3)
    // - Active Attendees: 2
    
    // Check that Active Workshops count is 1 (using effective status)
    const statCards = screen.getAllByText('1'); // Should appear in Active Workshops stat
    expect(statCards.length).toBeGreaterThanOrEqual(1);
    
    // Check total workshops and attendees
    expect(screen.getByText('2')).toBeInTheDocument(); // Total Workshops and Active Attendees
    expect(screen.getByText('5')).toBeInTheDocument(); // Total Attendees
  });

  it('should update attendee counts when attendee status changes', async () => {
    // Initial setup with different attendee counts
    const workshopsWithAttendees = [...mockWorkshops];
    workshopsWithAttendees[0] = {
      ...workshopsWithAttendees[0],
      active_attendees: 3, // Initially 3 active out of 10
    };
    mockedWorkshopApi.getWorkshops.mockResolvedValue(workshopsWithAttendees);

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Dashboard />
        </BrowserRouter>
      </QueryClientProvider>
    );

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByText('10 attendees • 3 active')).toBeInTheDocument();
    });

    // Update mock to reflect new attendee count
    const updatedWorkshops = [...workshopsWithAttendees];
    updatedWorkshops[0] = {
      ...updatedWorkshops[0],
      active_attendees: 4, // One more attendee became active
    };
    mockedWorkshopApi.getWorkshops.mockResolvedValue(updatedWorkshops);

    // Simulate attendee status update via WebSocket
    act(() => {
      if ((global as any).__testWebSocketCallback) {
        (global as any).__testWebSocketCallback('attendee', 'attendee-123', 'active');
      }
    });

    // Dashboard should update to show new attendee count
    await waitFor(() => {
      expect(screen.getByText('10 attendees • 4 active')).toBeInTheDocument();
    });
  });

  it('should handle multiple rapid status updates', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Dashboard />
        </BrowserRouter>
      </QueryClientProvider>
    );

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByText('Production Workshop')).toBeInTheDocument();
      expect(screen.getByText('Development Workshop')).toBeInTheDocument();
    });

    // First update: workshop-2 becomes active
    const firstUpdate = [...mockWorkshops];
    firstUpdate[1] = { ...firstUpdate[1], status: 'active' };
    mockedWorkshopApi.getWorkshops.mockResolvedValue(firstUpdate);

    act(() => {
      if ((global as any).__testWebSocketCallback) {
        (global as any).__testWebSocketCallback('workshop', 'workshop-2', 'active');
      }
    });

    // Second update: workshop-1 goes to cleanup
    const secondUpdate = [...firstUpdate];
    secondUpdate[0] = { ...secondUpdate[0], status: 'cleanup' };
    mockedWorkshopApi.getWorkshops.mockResolvedValue(secondUpdate);

    act(() => {
      if ((global as any).__testWebSocketCallback) {
        (global as any).__testWebSocketCallback('workshop', 'workshop-1', 'cleanup');
      }
    });

    // Verify both updates are reflected
    await waitFor(() => {
      expect(screen.getByText('Cleanup')).toBeInTheDocument();
      expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    });
  });

  it('should demonstrate the fix: workshops query is invalidated on WebSocket updates', async () => {
    // Track query invalidations
    const invalidateQueriesSpy = jest.spyOn(queryClient, 'invalidateQueries');

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Dashboard />
        </BrowserRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    // Clear initial calls
    invalidateQueriesSpy.mockClear();

    // Simulate WebSocket update
    act(() => {
      if ((global as any).__testWebSocketCallback) {
        (global as any).__testWebSocketCallback('workshop', 'workshop-1', 'error');
      }
    });

    // Verify that workshops query was invalidated
    expect(invalidateQueriesSpy).toHaveBeenCalledWith('workshops');
    expect(invalidateQueriesSpy).toHaveBeenCalledWith(['workshops']);
  });
});