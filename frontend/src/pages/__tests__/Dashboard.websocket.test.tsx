import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import Dashboard from '../Dashboard';
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
    name: 'Test Workshop 1',
    description: 'Workshop 1 description',
    start_date: '2025-07-25T10:00:00Z',
    end_date: '2025-07-25T18:00:00Z',
    status: 'active' as const,
    attendee_count: 5,
    active_attendees: 3,
    created_at: '2025-07-21T15:58:41Z',
    updated_at: '2025-07-21T15:58:41Z',
  },
  {
    id: 'workshop-2',
    name: 'Test Workshop 2',
    description: 'Workshop 2 description',
    start_date: '2025-07-26T10:00:00Z',
    end_date: '2025-07-26T18:00:00Z',
    status: 'deploying' as const,
    attendee_count: 10,
    active_attendees: 0,
    created_at: '2025-07-22T15:58:41Z',
    updated_at: '2025-07-22T15:58:41Z',
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
        <Dashboard />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Dashboard - WebSocket Real-time Updates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedWorkshopApi.getWorkshops.mockResolvedValue(mockWorkshops);
  });

  it('should display initial workshop data', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Workshop 1')).toBeInTheDocument();
      expect(screen.getByText('Test Workshop 2')).toBeInTheDocument();
    });

    // Verify status badges are shown (multiple elements may have same text)
    const activeElements = screen.getAllByText('Active');
    expect(activeElements.length).toBeGreaterThan(0);
    expect(screen.getByText('Deploying')).toBeInTheDocument();
  });

  it('should NOT update workshop status in real-time without WebSocket', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Workshop 1')).toBeInTheDocument();
    });

    // Initially workshop 2 is 'deploying'
    expect(screen.getByText('Deploying')).toBeInTheDocument();

    // Simulate that the backend status changed to 'active'
    const updatedWorkshops = [...mockWorkshops];
    updatedWorkshops[1] = { ...updatedWorkshops[1], status: 'active', active_attendees: 10 };
    mockedWorkshopApi.getWorkshops.mockResolvedValue(updatedWorkshops);

    // Without WebSocket, the status should NOT update immediately
    // It should only update after the 30-second refetch interval
    await waitFor(() => {
      // Should still show 'Deploying' because no WebSocket update
      expect(screen.getByText('Deploying')).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('should require manual refresh to see updated data', async () => {
    const { rerender } = renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Workshop 1')).toBeInTheDocument();
    });

    // Update the mock to return different data
    const updatedWorkshops = [...mockWorkshops];
    updatedWorkshops[1] = { ...updatedWorkshops[1], status: 'active', active_attendees: 10 };
    mockedWorkshopApi.getWorkshops.mockResolvedValue(updatedWorkshops);

    // Manually trigger a re-render (simulating page refresh)
    rerender(
      <QueryClientProvider client={new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      })}>
        <BrowserRouter>
          <Dashboard />
        </BrowserRouter>
      </QueryClientProvider>
    );

    // After manual refresh, new data should appear
    await waitFor(() => {
      expect(screen.getAllByText('Active').length).toBe(2);
    });
  });

  it('should demonstrate lack of WebSocket connection', async () => {
    // Spy on WebSocket constructor
    const WebSocketSpy = jest.fn();
    global.WebSocket = WebSocketSpy as any;

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    // WebSocket should NOT be instantiated for Dashboard
    expect(WebSocketSpy).not.toHaveBeenCalled();
  });

  it('should only update via polling interval, not real-time', async () => {
    jest.useFakeTimers();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Workshop 1')).toBeInTheDocument();
    });

    // Change the mock data
    const updatedWorkshops = [...mockWorkshops];
    updatedWorkshops[0] = { ...updatedWorkshops[0], active_attendees: 5 };
    mockedWorkshopApi.getWorkshops.mockResolvedValue(updatedWorkshops);

    // Advance time less than refetch interval (30 seconds)
    jest.advanceTimersByTime(15000);

    // Data should not have updated yet
    expect(screen.getByText('5 attendees • 3 active')).toBeInTheDocument();

    // Advance time past refetch interval
    jest.advanceTimersByTime(16000); // Total: 31 seconds

    // Now data should update via polling
    await waitFor(() => {
      expect(screen.getByText('5 attendees • 5 active')).toBeInTheDocument();
    });

    jest.useRealTimers();
  });
});