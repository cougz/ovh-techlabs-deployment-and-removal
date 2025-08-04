import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import Dashboard from '../Dashboard';
import WorkshopDetail from '../WorkshopDetail';
import { workshopApi, attendeeApi } from '../../services/api';

// Mock the APIs
jest.mock('../../services/api');
const mockedWorkshopApi = workshopApi as jest.Mocked<typeof workshopApi>;
const mockedAttendeeApi = attendeeApi as jest.Mocked<typeof attendeeApi>;

// Mock navigate and params
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: 'workshop-1' }),
}));

// Track WebSocket instances
let webSocketInstances: any[] = [];
const originalWebSocket = global.WebSocket;

beforeEach(() => {
  webSocketInstances = [];
  
  // Mock WebSocket
  global.WebSocket = jest.fn().mockImplementation((url: string) => {
    const ws = {
      url,
      readyState: WebSocket.CONNECTING,
      send: jest.fn(),
      close: jest.fn(),
      onopen: null,
      onclose: null,
      onerror: null,
      onmessage: null,
    };
    webSocketInstances.push(ws);
    
    // Simulate connection after a tick
    setTimeout(() => {
      ws.readyState = WebSocket.OPEN;
      ws.onopen?.();
    }, 0);
    
    return ws;
  }) as any;
});

afterEach(() => {
  global.WebSocket = originalWebSocket;
});

const mockWorkshops = [
  {
    id: 'workshop-1',
    name: 'Production Workshop',
    description: 'Main production environment',
    start_date: '2025-07-25T10:00:00Z',
    end_date: '2025-07-25T18:00:00Z',
    status: 'active' as const,
    attendee_count: 10,
    active_attendees: 5,
    created_at: '2025-07-21T15:58:41Z',
    updated_at: '2025-07-21T15:58:41Z',
  },
  {
    id: 'workshop-2',
    name: 'Development Workshop',
    description: 'Dev environment',
    start_date: '2025-07-26T10:00:00Z',
    end_date: '2025-07-26T18:00:00Z',
    status: 'deploying' as const,
    attendee_count: 8,
    active_attendees: 0,
    created_at: '2025-07-22T15:58:41Z',
    updated_at: '2025-07-22T15:58:41Z',
  }
];

describe('Dashboard - WebSocket Integration with Workshop Detail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock API responses
    mockedWorkshopApi.getWorkshops.mockResolvedValue(mockWorkshops);
    mockedWorkshopApi.getWorkshop.mockResolvedValue({
      ...mockWorkshops[0],
      template_id: 'template-1',
      deletion_date: null,
    });
    mockedAttendeeApi.getWorkshopAttendees.mockResolvedValue([]);
  });

  it('should update Dashboard in real-time when Workshop Detail page receives WebSocket updates', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { 
          retry: false,
          staleTime: 0, // Force data to be fresh
        },
        mutations: { retry: false },
      },
    });

    // Render both Dashboard and WorkshopDetail in the same QueryClient context
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <div>
            <div data-testid="dashboard-section">
              <Dashboard />
            </div>
            <div data-testid="workshop-detail-section" style={{ display: 'none' }}>
              <WorkshopDetail />
            </div>
          </div>
        </BrowserRouter>
      </QueryClientProvider>
    );

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByText('Production Workshop')).toBeInTheDocument();
      expect(screen.getByText('Development Workshop')).toBeInTheDocument();
    });

    // Verify initial status
    const deployingBadges = screen.getAllByText('Deploying');
    expect(deployingBadges.length).toBeGreaterThan(0);

    // Verify WebSocket connection was established for workshop detail
    await waitFor(() => {
      expect(webSocketInstances.length).toBe(1);
      expect(webSocketInstances[0].url).toContain('/ws/workshop-1');
    });

    // Update the mock to return updated data
    const updatedWorkshops = [...mockWorkshops];
    updatedWorkshops[1] = { 
      ...updatedWorkshops[1], 
      status: 'active',
      active_attendees: 8 
    };
    mockedWorkshopApi.getWorkshops.mockResolvedValue(updatedWorkshops);

    // Simulate WebSocket message for workshop status update
    const wsMessage = {
      type: 'status_update',
      entity_type: 'workshop',
      entity_id: 'workshop-2',
      status: 'active',
      workshop_id: 'workshop-2',
      timestamp: new Date().toISOString()
    };

    // Send WebSocket message
    await waitFor(() => {
      const ws = webSocketInstances[0];
      ws.onmessage?.({ data: JSON.stringify(wsMessage) });
    });

    // Dashboard should update to show new status
    await waitFor(() => {
      // Should now show 2 active workshops
      const activeBadges = screen.getAllByText('Active');
      expect(activeBadges.length).toBeGreaterThan(1);
      
      // Should no longer show deploying status for workshop-2
      const deployingBadgesAfter = screen.queryAllByText('Deploying');
      expect(deployingBadgesAfter.length).toBe(0);
    });

    // Verify the attendee count also updated
    expect(screen.getByText('8 attendees • 8 active')).toBeInTheDocument();
  });

  it('should update Dashboard when attendee status changes via WebSocket', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { 
          retry: false,
          staleTime: 0,
        },
        mutations: { retry: false },
      },
    });

    // Initial workshop with some attendees
    const workshopsWithAttendees = [...mockWorkshops];
    workshopsWithAttendees[0] = {
      ...workshopsWithAttendees[0],
      active_attendees: 3, // Initially 3 active out of 10
    };
    mockedWorkshopApi.getWorkshops.mockResolvedValue(workshopsWithAttendees);

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <div>
            <Dashboard />
            <div style={{ display: 'none' }}>
              <WorkshopDetail />
            </div>
          </div>
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
    const attendeeUpdate = {
      type: 'status_update',
      entity_type: 'attendee',
      entity_id: 'attendee-123',
      status: 'active',
      workshop_id: 'workshop-1',
      timestamp: new Date().toISOString()
    };

    // Send WebSocket message
    await waitFor(() => {
      const ws = webSocketInstances[0];
      ws.onmessage?.({ data: JSON.stringify(attendeeUpdate) });
    });

    // Dashboard should update to show new attendee count
    await waitFor(() => {
      expect(screen.getByText('10 attendees • 4 active')).toBeInTheDocument();
    });
  });

  it('should NOT update if no WorkshopDetail page is open', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { 
          retry: false,
          refetchInterval: false, // Disable polling for this test
        },
        mutations: { retry: false },
      },
    });

    // Only render Dashboard, no WorkshopDetail
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Dashboard />
        </BrowserRouter>
      </QueryClientProvider>
    );

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByText('Development Workshop')).toBeInTheDocument();
      expect(screen.getByText('Deploying')).toBeInTheDocument();
    });

    // No WebSocket should be created
    expect(webSocketInstances.length).toBe(0);

    // Update the mock data
    const updatedWorkshops = [...mockWorkshops];
    updatedWorkshops[1] = { 
      ...updatedWorkshops[1], 
      status: 'active' 
    };
    mockedWorkshopApi.getWorkshops.mockResolvedValue(updatedWorkshops);

    // Wait a bit to ensure no updates happen
    await new Promise(resolve => setTimeout(resolve, 100));

    // Status should NOT have changed
    expect(screen.getByText('Deploying')).toBeInTheDocument();
    expect(screen.queryByText('active', { selector: 'span' })).toBe(null);
  });
});