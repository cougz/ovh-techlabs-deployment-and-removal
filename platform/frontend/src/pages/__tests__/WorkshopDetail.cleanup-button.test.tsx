import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

// Mock window.confirm to avoid actual dialogs during tests
const mockConfirm = jest.fn();
Object.defineProperty(window, 'confirm', {
  value: mockConfirm,
  writable: true,
});

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

describe('WorkshopDetail - Cleanup Resources Button', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock workshop data with active status to show cleanup button
    mockedWorkshopApi.getWorkshop.mockResolvedValue({
      id: 'test-workshop-id',
      name: 'Test Workshop',
      description: 'Test workshop description',
      start_date: '2025-07-25T10:00:00Z',
      end_date: '2025-07-25T18:00:00Z',
      status: 'active', // Active status should show cleanup button
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
        status: 'active',
        ovh_project_id: '123e4567-e89b-12d3-a456-426614174000',
        ovh_user_urn: 'urn:v1:eu:identity:user:cc1882189-ovh/john-doe',
        created_at: '2025-07-21T15:58:41Z',
        updated_at: '2025-07-21T15:58:41Z'
      }
    ]);

    // Mock confirm to always return true (user confirms action)
    mockConfirm.mockReturnValue(true);
  });

  it('should display Cleanup Resources button for active workshops', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Workshop')).toBeInTheDocument();
    });

    // Should show cleanup button for active workshop
    const cleanupButton = screen.getByText('Cleanup Resources');
    expect(cleanupButton).toBeInTheDocument();
    expect(cleanupButton).not.toBeDisabled();
  });

  it('should keep Cleanup Resources button visible after failed cleanup attempt', async () => {
    // Mock cleanup API to fail
    mockedWorkshopApi.cleanupWorkshop.mockRejectedValueOnce({
      response: { data: { detail: 'Cleanup failed' } }
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Workshop')).toBeInTheDocument();
    });

    const cleanupButton = screen.getByText('Cleanup Resources');
    expect(cleanupButton).toBeInTheDocument();

    // Click cleanup button
    fireEvent.click(cleanupButton);

    // Wait for API call and error handling
    await waitFor(() => {
      expect(mockedWorkshopApi.cleanupWorkshop).toHaveBeenCalledWith('test-workshop-id');
    });

    // After failed cleanup, button should still be visible and clickable
    await waitFor(() => {
      const buttonAfterFailure = screen.getByText('Cleanup Resources');
      expect(buttonAfterFailure).toBeInTheDocument();
      expect(buttonAfterFailure).not.toBeDisabled();
    });
  });

  it('should allow retry after failed cleanup attempt', async () => {
    // Mock cleanup API to fail first, then succeed
    mockedWorkshopApi.cleanupWorkshop
      .mockRejectedValueOnce({
        response: { data: { detail: 'Network error' } }
      })
      .mockResolvedValueOnce({
        message: 'Workshop cleanup started',
        task_ids: ['task-123'],
        attendee_count: 1
      });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Workshop')).toBeInTheDocument();
    });

    const cleanupButton = screen.getByText('Cleanup Resources');

    // First attempt - should fail
    fireEvent.click(cleanupButton);

    await waitFor(() => {
      expect(mockedWorkshopApi.cleanupWorkshop).toHaveBeenCalledTimes(1);
    });

    // Button should still be available after failure
    await waitFor(() => {
      const buttonAfterFirstFailure = screen.getByText('Cleanup Resources');
      expect(buttonAfterFirstFailure).toBeInTheDocument();
      expect(buttonAfterFirstFailure).not.toBeDisabled();
    });

    // Second attempt - should succeed
    const retryButton = screen.getByText('Cleanup Resources');
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(mockedWorkshopApi.cleanupWorkshop).toHaveBeenCalledTimes(2);
    });

    // Verify both calls were made
    expect(mockedWorkshopApi.cleanupWorkshop).toHaveBeenNthCalledWith(1, 'test-workshop-id');
    expect(mockedWorkshopApi.cleanupWorkshop).toHaveBeenNthCalledWith(2, 'test-workshop-id');
  });

  it('should disable cleanup button temporarily during cleanup request', async () => {
    // Mock cleanup API with delay to test loading state
    let resolveCleanup: (value: any) => void;
    const cleanupPromise = new Promise((resolve) => {
      resolveCleanup = resolve;
    });
    mockedWorkshopApi.cleanupWorkshop.mockReturnValueOnce(cleanupPromise);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Workshop')).toBeInTheDocument();
    });

    const cleanupButton = screen.getByText('Cleanup Resources');
    fireEvent.click(cleanupButton);

    // Button should show loading state
    await waitFor(() => {
      const loadingButton = screen.getByText('Cleaning up...');
      expect(loadingButton).toBeInTheDocument();
      expect(loadingButton).toBeDisabled();
    });

    // Resolve the cleanup request
    resolveCleanup!({
      message: 'Workshop cleanup started',
      task_ids: ['task-123'],
      attendee_count: 1
    });

    await waitFor(() => {
      expect(mockedWorkshopApi.cleanupWorkshop).toHaveBeenCalled();
    });
  });

  it('should handle multiple rapid cleanup button clicks gracefully', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Workshop')).toBeInTheDocument();
    });

    const cleanupButton = screen.getByText('Cleanup Resources');

    // Click multiple times rapidly
    fireEvent.click(cleanupButton);
    fireEvent.click(cleanupButton);
    fireEvent.click(cleanupButton);

    // Should only call API once due to disabled state during request
    await waitFor(() => {
      expect(mockedWorkshopApi.cleanupWorkshop).toHaveBeenCalledTimes(1);
    });
  });

  it('should show cleanup button for completed workshops too', async () => {
    // Mock workshop with completed status
    mockedWorkshopApi.getWorkshop.mockResolvedValueOnce({
      id: 'test-workshop-id',
      name: 'Test Workshop',
      description: 'Test workshop description',
      start_date: '2025-07-25T10:00:00Z',
      end_date: '2025-07-25T18:00:00Z',
      status: 'completed', // Completed status should also show cleanup button
      created_at: '2025-07-21T15:58:41Z',
      updated_at: '2025-07-21T15:58:41Z',
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Workshop')).toBeInTheDocument();
    });

    // Should show cleanup button for completed workshop
    const cleanupButton = screen.getByText('Cleanup Resources');
    expect(cleanupButton).toBeInTheDocument();
    expect(cleanupButton).not.toBeDisabled();
  });

  it('should not show cleanup button for planning workshops', async () => {
    // Mock workshop with planning status
    mockedWorkshopApi.getWorkshop.mockResolvedValueOnce({
      id: 'test-workshop-id',
      name: 'Test Workshop',
      description: 'Test workshop description',
      start_date: '2025-07-25T10:00:00Z',
      end_date: '2025-07-25T18:00:00Z',
      status: 'planning', // Planning status should NOT show cleanup button
      created_at: '2025-07-21T15:58:41Z',
      updated_at: '2025-07-21T15:58:41Z',
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Workshop')).toBeInTheDocument();
    });

    // Should NOT show cleanup button for planning workshop
    expect(screen.queryByText('Cleanup Resources')).not.toBeInTheDocument();
  });
});