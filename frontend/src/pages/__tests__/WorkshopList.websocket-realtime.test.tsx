import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import '@testing-library/jest-dom';
import WorkshopList from '../WorkshopList';
import { workshopApi } from '../../services/api';

// Mock the APIs
jest.mock('../../services/api');
const mockedWorkshopApi = workshopApi as jest.Mocked<typeof workshopApi>;

// Mock useGlobalWebSocket hook to simulate WebSocket behavior
jest.mock('../../hooks/useGlobalWebSocket', () => ({
  useGlobalWebSocket: ({ onStatusUpdate }: any) => {
    // Store the callback for testing
    (global as any).__testWebSocketCallback = (workshopId: string, entityType: string, entityId: string, status: string) => {
      // Call the onStatusUpdate callback which will be used by the WorkshopList component
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

const mockWorkshopsInitial = [
  {
    id: 'workshop-1',
    name: 'Test Workshop 1',
    description: 'Workshop with no deployed attendees initially',
    start_date: '2025-07-30T10:00:00Z',
    end_date: '2025-07-30T18:00:00Z',
    status: 'planning' as const,
    attendee_count: 3,
    active_attendees: 0, // Key issue: shows 0 deployed
    created_at: '2025-07-30T09:00:00Z',
    updated_at: '2025-07-30T09:00:00Z',
    timezone: 'UTC',
    template: 'Generic'
  },
  {
    id: 'workshop-2',
    name: 'Test Workshop 2',
    description: 'Another workshop with zero attendees deployed',
    start_date: '2025-07-31T10:00:00Z',
    end_date: '2025-07-31T18:00:00Z',
    status: 'planning' as const,
    attendee_count: 2,
    active_attendees: 0, // Key issue: shows 0 deployed
    created_at: '2025-07-30T09:00:00Z',
    updated_at: '2025-07-30T09:00:00Z',
    timezone: 'UTC',
    template: 'Generic'
  }
];

const mockWorkshopsAfterDeployment = [
  {
    ...mockWorkshopsInitial[0],
    active_attendees: 3, // All attendees now deployed
    status: 'active' as const
  },
  {
    ...mockWorkshopsInitial[1],
    active_attendees: 1, // Partial deployment
    status: 'deploying' as const
  }
];

describe('WorkshopList - Real-time WebSocket Updates', () => {
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
    
    // Mock initial API response - workshops with 0 deployed attendees
    mockedWorkshopApi.getWorkshops.mockResolvedValue(mockWorkshopsInitial);
  });

  afterEach(() => {
    delete (global as any).__testWebSocketCallback;
  });

  it('should show attendee counts update in real-time when attendees are deployed', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <WorkshopList />
        </BrowserRouter>
      </QueryClientProvider>
    );

    // Wait for initial render - should show 0 deployed attendees
    await waitFor(() => {
      expect(screen.getByText('Test Workshop 1')).toBeInTheDocument();
      expect(screen.getByText('Test Workshop 2')).toBeInTheDocument();
    });

    // Initially should show 0/3 and 0/2 attendees
    expect(screen.getByText('0/3 attendees')).toBeInTheDocument();
    expect(screen.getByText('0/2 attendees')).toBeInTheDocument(); 
    
    // Both should show Planning status
    expect(screen.getAllByText('Planning')).toHaveLength(2);

    // Update mock to return updated attendee counts
    mockedWorkshopApi.getWorkshops.mockResolvedValue(mockWorkshopsAfterDeployment);

    // Simulate WebSocket update when attendees are deployed
    act(() => {
      if ((global as any).__testWebSocketCallback) {
        // Simulate attendee becoming active
        (global as any).__testWebSocketCallback('workshop-1', 'attendee', 'attendee-1', 'active');
      }
    });

    // Workshop list should update to show new attendee counts and statuses
    await waitFor(() => {
      // Should now show updated attendee counts
      expect(screen.getByText('3/3 attendees')).toBeInTheDocument(); // workshop-1 fully deployed
      expect(screen.getByText('1/2 attendees')).toBeInTheDocument(); // workshop-2 partially deployed
      
      // Statuses should update accordingly
      expect(screen.getByText('Active')).toBeInTheDocument(); // workshop-1 is now active
      expect(screen.getByText('Deploying')).toBeInTheDocument(); // workshop-2 is deploying
      
      // Planning status should be gone for workshop-1
      expect(screen.getAllByText('Planning')).toHaveLength(0);
    });
  });

  it('should update when workshop cleanup completes', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <WorkshopList />
        </BrowserRouter>
      </QueryClientProvider>
    );

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByText('Training Workshop')).toBeInTheDocument();
      expect(screen.getByText('Cleanup')).toBeInTheDocument();
    });

    // Update mock to show cleanup completed
    const updatedWorkshops = [...mockWorkshops];
    updatedWorkshops[2] = { ...updatedWorkshops[2], status: 'completed' };
    mockedWorkshopApi.getWorkshops.mockResolvedValue(updatedWorkshops);

    // Simulate WebSocket update
    act(() => {
      if ((global as any).__testWebSocketCallback) {
        (global as any).__testWebSocketCallback('workshop', 'workshop-3', 'completed');
      }
    });

    // Status should update to completed
    await waitFor(() => {
      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.queryByText('Cleanup')).not.toBeInTheDocument();
    });
  });

  it('should update attendee counts in real-time', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <WorkshopList />
        </BrowserRouter>
      </QueryClientProvider>
    );

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByText('15 attendees • 10 active')).toBeInTheDocument();
    });

    // Update mock to reflect attendee changes
    const updatedWorkshops = [...mockWorkshops];
    updatedWorkshops[0] = {
      ...updatedWorkshops[0],
      active_attendees: 12, // 2 more attendees became active
    };
    mockedWorkshopApi.getWorkshops.mockResolvedValue(updatedWorkshops);

    // Simulate attendee status update
    act(() => {
      if ((global as any).__testWebSocketCallback) {
        (global as any).__testWebSocketCallback('attendee', 'attendee-456', 'active');
      }
    });

    // Attendee count should update
    await waitFor(() => {
      expect(screen.getByText('15 attendees • 12 active')).toBeInTheDocument();
    });
  });

  it('should handle workshop deletion via WebSocket', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <WorkshopList />
        </BrowserRouter>
      </QueryClientProvider>
    );

    // Wait for initial render with 3 workshops
    await waitFor(() => {
      expect(screen.getByText('Production Workshop')).toBeInTheDocument();
      expect(screen.getByText('Development Workshop')).toBeInTheDocument();
      expect(screen.getByText('Training Workshop')).toBeInTheDocument();
    });

    // Update mock to remove workshop-3
    const updatedWorkshops = mockWorkshops.filter(w => w.id !== 'workshop-3');
    mockedWorkshopApi.getWorkshops.mockResolvedValue(updatedWorkshops);

    // Simulate deletion via WebSocket
    act(() => {
      if ((global as any).__testWebSocketCallback) {
        (global as any).__testWebSocketCallback('workshop', 'workshop-3', 'deleted');
      }
    });

    // Workshop should disappear from the list
    await waitFor(() => {
      expect(screen.queryByText('Training Workshop')).not.toBeInTheDocument();
      expect(screen.getByText('Production Workshop')).toBeInTheDocument();
      expect(screen.getByText('Development Workshop')).toBeInTheDocument();
    });
  });

  it('should show real-time progress updates during deployment', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <WorkshopList />
        </BrowserRouter>
      </QueryClientProvider>
    );

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByText('Development Workshop')).toBeInTheDocument();
    });

    // Verify workshop-2 is deploying
    expect(screen.getByText('Deploying')).toBeInTheDocument();

    // Update mock to show partial deployment progress
    const updatedWorkshops = [...mockWorkshops];
    updatedWorkshops[1] = {
      ...updatedWorkshops[1],
      active_attendees: 4, // Half of the attendees are now active
    };
    mockedWorkshopApi.getWorkshops.mockResolvedValue(updatedWorkshops);

    // Simulate progress update
    act(() => {
      if ((global as any).__testWebSocketCallback) {
        (global as any).__testWebSocketCallback('attendee', 'attendee-789', 'active');
      }
    });

    // Should show partial deployment progress
    await waitFor(() => {
      expect(screen.getByText('8 attendees • 4 active')).toBeInTheDocument();
      // Status should still be deploying
      expect(screen.getByText('Deploying')).toBeInTheDocument();
    });
  });
});