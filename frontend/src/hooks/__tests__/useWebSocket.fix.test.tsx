import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import React from 'react';
import { useWebSocket } from '../useWebSocket';

// Mock WebSocket
let mockWebSocket: any;

beforeEach(() => {
  mockWebSocket = {
    readyState: WebSocket.CONNECTING,
    send: jest.fn(),
    close: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };

  global.WebSocket = jest.fn(() => mockWebSocket) as any;
});

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe('useWebSocket - Fix for Dashboard/WorkshopList updates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('should invalidate workshops query when workshop status updates', () => {
    const queryClient = new QueryClient();
    const invalidateQueriesSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const customWrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    renderHook(() => useWebSocket({ workshopId: 'workshop-123' }), { wrapper: customWrapper });

    act(() => {
      mockWebSocket.onopen?.();
    });

    // Simulate workshop status update
    const message = {
      type: 'status_update',
      entity_type: 'workshop',
      entity_id: 'workshop-123',
      status: 'active',
      details: { message: 'Workshop activated' }
    };

    act(() => {
      mockWebSocket.onmessage?.({ data: JSON.stringify(message) });
    });

    // Should invalidate the specific workshop query
    expect(invalidateQueriesSpy).toHaveBeenCalledWith(['workshop', 'workshop-123']);
    
    // Should invalidate attendees for this workshop
    expect(invalidateQueriesSpy).toHaveBeenCalledWith(['attendees', 'workshop-123']);

    // IMPORTANT: Should ALSO invalidate the workshops list query
    // This is what allows Dashboard and WorkshopList to update
    expect(invalidateQueriesSpy).toHaveBeenCalledWith('workshops');
  });

  it('should invalidate workshops query when attendee status updates', () => {
    const queryClient = new QueryClient();
    const invalidateQueriesSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const customWrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    renderHook(() => useWebSocket({ workshopId: 'workshop-456' }), { wrapper: customWrapper });

    act(() => {
      mockWebSocket.onopen?.();
    });

    // Simulate attendee status update
    const message = {
      type: 'status_update',
      entity_type: 'attendee',
      entity_id: 'attendee-789',
      status: 'deploying',
      details: { progress: 50 }
    };

    act(() => {
      mockWebSocket.onmessage?.({ data: JSON.stringify(message) });
    });

    // Should invalidate attendees for this workshop
    expect(invalidateQueriesSpy).toHaveBeenCalledWith(['attendees', 'workshop-456']);
    
    // Should invalidate the specific workshop query
    expect(invalidateQueriesSpy).toHaveBeenCalledWith(['workshop', 'workshop-456']);

    // IMPORTANT: Should ALSO invalidate the workshops list query
    // This updates the attendee counts shown in Dashboard/WorkshopList
    expect(invalidateQueriesSpy).toHaveBeenCalledWith('workshops');
  });

  it('should handle multiple workshop connections for cross-workshop updates', () => {
    // This test demonstrates that if multiple workshop detail pages are open,
    // they can collectively provide real-time updates to the workshops list
    const queryClient = new QueryClient();
    const invalidateQueriesSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const customWrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    // Simulate two workshop detail pages open
    const { result: ws1 } = renderHook(() => useWebSocket({ workshopId: 'workshop-1' }), { wrapper: customWrapper });
    const { result: ws2 } = renderHook(() => useWebSocket({ workshopId: 'workshop-2' }), { wrapper: customWrapper });

    // Both connections should be established
    expect(global.WebSocket).toHaveBeenCalledTimes(2);
    expect(global.WebSocket).toHaveBeenCalledWith(expect.stringContaining('/ws/workshop-1'));
    expect(global.WebSocket).toHaveBeenCalledWith(expect.stringContaining('/ws/workshop-2'));

    // When either workshop updates, the workshops list should be invalidated
    const message1 = {
      type: 'status_update',
      entity_type: 'workshop',
      entity_id: 'workshop-1',
      status: 'cleanup'
    };

    // Get the first WebSocket instance
    const firstWebSocket = (global.WebSocket as jest.Mock).mock.results[0].value;
    
    act(() => {
      firstWebSocket.onmessage?.({ data: JSON.stringify(message1) });
    });

    // Should invalidate workshops list
    expect(invalidateQueriesSpy).toHaveBeenCalledWith('workshops');
  });

  it('should provide real-time updates to Dashboard when workshop detail is open', () => {
    // This demonstrates the expected behavior:
    // When a user has a workshop detail page open in one tab and Dashboard in another,
    // the Dashboard should receive real-time updates through the workshop's WebSocket
    
    const queryClient = new QueryClient();
    const invalidateQueriesSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const customWrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    // Workshop detail page establishes WebSocket connection
    renderHook(() => useWebSocket({ workshopId: 'workshop-prod' }), { wrapper: customWrapper });

    act(() => {
      mockWebSocket.onopen?.();
    });

    // Workshop status changes
    const statusUpdate = {
      type: 'status_update',
      entity_type: 'workshop',
      entity_id: 'workshop-prod',
      status: 'error',
      details: { error: 'Deployment failed' }
    };

    act(() => {
      mockWebSocket.onmessage?.({ data: JSON.stringify(statusUpdate) });
    });

    // The 'workshops' query should be invalidated
    // This will cause Dashboard to refetch and show the new status
    expect(invalidateQueriesSpy).toHaveBeenCalledWith('workshops');
    
    // Verify the invalidation happened for both query key formats
    expect(invalidateQueriesSpy).toHaveBeenCalledWith(['workshops']);
  });
});