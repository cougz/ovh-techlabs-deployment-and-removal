import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import WorkshopList from '../WorkshopList';
import { workshopApi } from '../../services/api';

// Mock the APIs
jest.mock('../../services/api');
const mockedWorkshopApi = workshopApi as jest.Mocked<typeof workshopApi>;

// Mock navigate
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
}));

const mockWorkshops = [
  {
    id: 'workshop-1',
    name: 'Production Workshop',
    description: 'Main production environment',
    start_date: '2025-07-25T10:00:00Z',
    end_date: '2025-07-25T18:00:00Z',
    status: 'active' as const,
    attendee_count: 15,
    active_attendees: 10,
    created_at: '2025-07-21T15:58:41Z',
    updated_at: '2025-07-21T15:58:41Z',
  },
  {
    id: 'workshop-2',
    name: 'Development Workshop',
    description: 'Dev environment for testing',
    start_date: '2025-07-26T10:00:00Z',
    end_date: '2025-07-26T18:00:00Z',
    status: 'deploying' as const,
    attendee_count: 8,
    active_attendees: 0,
    created_at: '2025-07-22T15:58:41Z',
    updated_at: '2025-07-22T15:58:41Z',
  },
  {
    id: 'workshop-3',
    name: 'Training Workshop',
    description: 'Training environment',
    start_date: '2025-07-27T10:00:00Z',
    end_date: '2025-07-27T18:00:00Z',
    status: 'cleanup' as const,
    attendee_count: 20,
    active_attendees: 0,
    created_at: '2025-07-23T15:58:41Z',
    updated_at: '2025-07-23T15:58:41Z',
  }
];

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
        <WorkshopList />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('WorkshopList - WebSocket Real-time Updates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedWorkshopApi.getWorkshops.mockResolvedValue(mockWorkshops);
  });

  it('should display initial workshop list with statuses', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Production Workshop')).toBeInTheDocument();
      expect(screen.getByText('Development Workshop')).toBeInTheDocument();
      expect(screen.getByText('Training Workshop')).toBeInTheDocument();
    });

    // Verify different status indicators are shown
    const activeStatus = screen.getAllByText('Active')[0];
    const deployingStatus = screen.getByText('Deploying');
    const cleanupStatus = screen.getByText('Cleanup');

    expect(activeStatus).toBeInTheDocument();
    expect(deployingStatus).toBeInTheDocument();
    expect(cleanupStatus).toBeInTheDocument();
  });

  it('should NOT receive real-time status updates via WebSocket', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Development Workshop')).toBeInTheDocument();
    });

    // Initially workshop is 'deploying'
    expect(screen.getByText('Deploying')).toBeInTheDocument();

    // Simulate backend status change
    const updatedWorkshops = [...mockWorkshops];
    updatedWorkshops[1] = { 
      ...updatedWorkshops[1], 
      status: 'active', 
      active_attendees: 8 
    };
    mockedWorkshopApi.getWorkshops.mockResolvedValue(updatedWorkshops);

    // Status should NOT update in real-time
    await waitFor(() => {
      expect(screen.getByText('Deploying')).toBeInTheDocument();
      expect(screen.queryByText('8 active')).not.toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('should NOT receive real-time attendee count updates', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Production Workshop')).toBeInTheDocument();
    });

    // Check initial attendee count
    expect(screen.getByText('15 attendees • 10 active')).toBeInTheDocument();

    // Update backend data
    const updatedWorkshops = [...mockWorkshops];
    updatedWorkshops[0] = { 
      ...updatedWorkshops[0], 
      active_attendees: 15 // All attendees now active
    };
    mockedWorkshopApi.getWorkshops.mockResolvedValue(updatedWorkshops);

    // Count should NOT update without manual refresh
    await waitFor(() => {
      expect(screen.getByText('15 attendees • 10 active')).toBeInTheDocument();
      expect(screen.queryByText('15 attendees • 15 active')).not.toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('should NOT instantiate WebSocket connection', async () => {
    // Spy on WebSocket constructor
    const WebSocketSpy = jest.fn();
    global.WebSocket = WebSocketSpy as any;

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Workshops')).toBeInTheDocument();
    });

    // Verify no WebSocket connection was attempted
    expect(WebSocketSpy).not.toHaveBeenCalled();
  });

  it('should update only via 30-second polling interval', async () => {
    jest.useFakeTimers();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Training Workshop')).toBeInTheDocument();
    });

    // Initially workshop 3 is in 'cleanup' status
    expect(screen.getByText('Cleanup')).toBeInTheDocument();

    // Update mock to show cleanup completed
    const updatedWorkshops = [...mockWorkshops];
    updatedWorkshops[2] = { ...updatedWorkshops[2], status: 'completed' };
    mockedWorkshopApi.getWorkshops.mockResolvedValue(updatedWorkshops);

    // Advance time but not past refetch interval
    jest.advanceTimersByTime(20000); // 20 seconds

    // Status should still be 'cleanup'
    expect(screen.getByText('Cleanup')).toBeInTheDocument();
    expect(screen.queryByText('Completed')).not.toBeInTheDocument();

    // Advance past refetch interval
    jest.advanceTimersByTime(11000); // Total: 31 seconds

    // Now status should update via polling
    await waitFor(() => {
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    jest.useRealTimers();
  });

  it('should not update progress bars in real-time', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Development Workshop')).toBeInTheDocument();
    });

    // Check that no progress information updates without WebSocket
    const progressBars = screen.queryAllByRole('progressbar');
    expect(progressBars.length).toBe(0); // No real-time progress tracking
  });

  it('should require page refresh to see workshop deletion', async () => {
    const { rerender } = renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Training Workshop')).toBeInTheDocument();
    });

    // Remove a workshop from the list
    const updatedWorkshops = mockWorkshops.filter(w => w.id !== 'workshop-3');
    mockedWorkshopApi.getWorkshops.mockResolvedValue(updatedWorkshops);

    // Workshop should still be visible without refresh
    expect(screen.getByText('Training Workshop')).toBeInTheDocument();

    // Manually refresh by re-rendering
    rerender(
      <QueryClientProvider client={new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      })}>
        <BrowserRouter>
          <WorkshopList />
        </BrowserRouter>
      </QueryClientProvider>
    );

    // After refresh, deleted workshop should be gone
    await waitFor(() => {
      expect(screen.queryByText('Training Workshop')).not.toBeInTheDocument();
    });
  });
});