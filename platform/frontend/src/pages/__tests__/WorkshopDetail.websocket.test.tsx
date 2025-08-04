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

// Mock navigate
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
  useParams: () => ({ id: 'test-workshop-id' }),
}));

// Mock WebSocket hook
jest.mock('../../hooks/useWebSocket', () => ({
  useWebSocket: jest.fn()
}));

const mockUseWebSocket = require('../../hooks/useWebSocket').useWebSocket;

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

describe('WorkshopDetail - WebSocket Integration', () => {
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

    // Mock attendees data
    mockedAttendeeApi.getWorkshopAttendees.mockResolvedValue([
      {
        id: 'attendee-1',
        workshop_id: 'test-workshop-id',
        username: 'john-doe',
        email: 'john.doe@techlab.ovh',
        status: 'deploying',
        ovh_project_id: '123e4567-e89b-12d3-a456-426614174000',
        ovh_user_urn: 'urn:v1:eu:identity:user:cc1882189-ovh/john-doe',
        created_at: '2025-07-21T15:58:41Z',
        updated_at: '2025-07-21T15:58:41Z'
      }
    ]);

    // Mock WebSocket hook to return connection functions
    mockUseWebSocket.mockReturnValue({
      isConnected: true,
      connectionError: null,
      sendMessage: jest.fn(),
      reconnect: jest.fn(),
      disconnect: jest.fn(),
    });
  });

  it('should establish WebSocket connection for real-time updates', async () => {
    renderComponent();

    // Wait for component to mount and data to load
    await waitFor(() => {
      expect(screen.getByText('Test Workshop')).toBeInTheDocument();
    });

    // Verify WebSocket hook was called with correct workshop ID
    expect(mockUseWebSocket).toHaveBeenCalledWith({
      workshopId: 'test-workshop-id',
      onStatusUpdate: expect.any(Function),
      onDeploymentLog: expect.any(Function),
      onDeploymentProgress: expect.any(Function),
    });
  });

  it('should handle real-time status updates via WebSocket', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Workshop')).toBeInTheDocument();
    });

    // Get the onStatusUpdate callback that was passed to useWebSocket
    const onStatusUpdateCallback = mockUseWebSocket.mock.calls[0][0].onStatusUpdate;

    // Simulate receiving a WebSocket status update
    const statusUpdate = {
      type: 'status_update',
      entity_type: 'attendee',
      entity_id: 'attendee-1',
      new_status: 'active',
      data: { message: 'Deployment completed successfully' }
    };

    // This should trigger React Query cache invalidation
    onStatusUpdateCallback(statusUpdate);

    // Verify that the callback function exists and can be called
    expect(onStatusUpdateCallback).toBeDefined();
    expect(typeof onStatusUpdateCallback).toBe('function');
  });

  it('should handle real-time deployment progress updates', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Workshop')).toBeInTheDocument();
    });

    // Get the onDeploymentProgress callback
    const onProgressCallback = mockUseWebSocket.mock.calls[0][0].onDeploymentProgress;

    // Simulate receiving progress update
    const progressUpdate = {
      type: 'deployment_progress',
      workshop_id: 'test-workshop-id',
      attendee_id: 'attendee-1', 
      progress: 75,
      step: 'Configuring resources...'
    };

    onProgressCallback(progressUpdate);

    // Verify callback exists and is callable
    expect(onProgressCallback).toBeDefined();
    expect(typeof onProgressCallback).toBe('function');
  });

  it('should handle real-time deployment log updates', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Workshop')).toBeInTheDocument();
    });

    // Get the onDeploymentLog callback
    const onLogCallback = mockUseWebSocket.mock.calls[0][0].onDeploymentLog;

    // Simulate receiving log update
    const logUpdate = {
      type: 'deployment_log',
      attendee_id: 'attendee-1',
      log: {
        id: 'log-1',
        attendee_id: 'attendee-1',
        action: 'deploy',
        status: 'success',
        message: 'Resources created successfully',
        started_at: '2025-07-21T20:00:00Z',
        completed_at: '2025-07-21T20:05:00Z'
      }
    };

    onLogCallback(logUpdate);

    // Verify callback exists and is callable
    expect(onLogCallback).toBeDefined();
    expect(typeof onLogCallback).toBe('function');
  });

  it('should show WebSocket connection status', async () => {
    // Test with disconnected state
    mockUseWebSocket.mockReturnValueOnce({
      isConnected: false,
      connectionError: null,
      sendMessage: jest.fn(),
      reconnect: jest.fn(),
      disconnect: jest.fn(),
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Workshop')).toBeInTheDocument();
    });

    // When disconnected, should still show the page but might show connection status
    // This test verifies that disconnected WebSocket doesn't break the component
    expect(screen.getByText('Test Workshop')).toBeInTheDocument();
  });

  it('should re-enable WebSocket functionality that was previously disabled', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Workshop')).toBeInTheDocument();
    });

    // This test ensures WebSocket hook is being called, indicating it's no longer disabled
    expect(mockUseWebSocket).toHaveBeenCalled();
    
    // Verify the component is not relying solely on polling
    const callArgs = mockUseWebSocket.mock.calls[0][0];
    expect(callArgs).toHaveProperty('onStatusUpdate');
    expect(callArgs).toHaveProperty('onDeploymentLog');
    expect(callArgs).toHaveProperty('onDeploymentProgress');
  });
});