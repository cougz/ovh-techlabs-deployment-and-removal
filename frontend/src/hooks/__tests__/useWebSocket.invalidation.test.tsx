import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import React from 'react';
import { useWebSocket } from '../useWebSocket';

// This test verifies that our fix correctly invalidates the workshops query
// when WebSocket status updates are received

describe('useWebSocket - Query Invalidation Fix', () => {
  let queryClient: QueryClient;
  let mockWebSocket: any;
  let invalidateQueriesSpy: jest.SpyInstance;

  beforeEach(() => {
    // Create fresh QueryClient for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    
    // Spy on invalidateQueries to track calls
    invalidateQueriesSpy = jest.spyOn(queryClient, 'invalidateQueries');

    // Mock WebSocket
    mockWebSocket = {
      readyState: WebSocket.CONNECTING,
      send: jest.fn(),
      close: jest.fn(),
      onopen: null,
      onclose: null,
      onerror: null,
      onmessage: null,
    };

    global.WebSocket = jest.fn(() => mockWebSocket) as any;
  });

  afterEach(() => {
    invalidateQueriesSpy.mockRestore();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('should invalidate workshops query when workshop status updates', () => {
    const onStatusUpdate = jest.fn();
    
    renderHook(() => useWebSocket({ 
      workshopId: 'workshop-123',
      onStatusUpdate 
    }), { wrapper });

    // Simulate connection opening
    act(() => {
      mockWebSocket.readyState = WebSocket.OPEN;
      mockWebSocket.onopen?.();
    });

    // Clear initial invalidation calls
    invalidateQueriesSpy.mockClear();

    // Simulate workshop status update message
    const statusMessage = {
      type: 'status_update',
      entity_type: 'workshop',
      entity_id: 'workshop-123',
      status: 'active',
      details: { message: 'Workshop is now active' }
    };

    act(() => {
      mockWebSocket.onmessage?.({ data: JSON.stringify(statusMessage) });
    });

    // Verify ALL expected queries are invalidated
    expect(invalidateQueriesSpy).toHaveBeenCalledWith(['attendees', 'workshop-123']);
    expect(invalidateQueriesSpy).toHaveBeenCalledWith(['workshop', 'workshop-123']);
    
    // THE FIX: These should now be called
    expect(invalidateQueriesSpy).toHaveBeenCalledWith('workshops');
    expect(invalidateQueriesSpy).toHaveBeenCalledWith(['workshops']);

    // Verify callback was called
    expect(onStatusUpdate).toHaveBeenCalledWith('workshop', 'workshop-123', 'active', { message: 'Workshop is now active' });
  });

  it('should invalidate workshops query when attendee status updates', () => {
    const onStatusUpdate = jest.fn();
    
    renderHook(() => useWebSocket({ 
      workshopId: 'workshop-456',
      onStatusUpdate 
    }), { wrapper });

    // Simulate connection opening
    act(() => {
      mockWebSocket.readyState = WebSocket.OPEN;
      mockWebSocket.onopen?.();
    });

    // Clear initial invalidation calls
    invalidateQueriesSpy.mockClear();

    // Simulate attendee status update message
    const statusMessage = {
      type: 'status_update',
      entity_type: 'attendee',
      entity_id: 'attendee-789',
      status: 'deploying',
      details: { progress: 50 }
    };

    act(() => {
      mockWebSocket.onmessage?.({ data: JSON.stringify(statusMessage) });
    });

    // Verify ALL expected queries are invalidated
    expect(invalidateQueriesSpy).toHaveBeenCalledWith(['attendees', 'workshop-456']);
    expect(invalidateQueriesSpy).toHaveBeenCalledWith(['workshop', 'workshop-456']);
    
    // THE FIX: These should now be called for attendee updates too
    expect(invalidateQueriesSpy).toHaveBeenCalledWith('workshops');
    expect(invalidateQueriesSpy).toHaveBeenCalledWith(['workshops']);

    // Verify callback was called
    expect(onStatusUpdate).toHaveBeenCalledWith('attendee', 'attendee-789', 'deploying', { progress: 50 });
  });

  it('should not invalidate queries for invalid messages', () => {
    renderHook(() => useWebSocket({ workshopId: 'workshop-123' }), { wrapper });

    act(() => {
      mockWebSocket.readyState = WebSocket.OPEN;
      mockWebSocket.onopen?.();
    });

    invalidateQueriesSpy.mockClear();

    // Send invalid message (missing required fields)
    const invalidMessage = {
      type: 'status_update',
      // Missing entity_type, entity_id, status
    };

    act(() => {
      mockWebSocket.onmessage?.({ data: JSON.stringify(invalidMessage) });
    });

    // Should not have invalidated any queries
    expect(invalidateQueriesSpy).not.toHaveBeenCalled();
  });

  it('should handle multiple rapid status updates', () => {
    renderHook(() => useWebSocket({ workshopId: 'workshop-rapid' }), { wrapper });

    act(() => {
      mockWebSocket.readyState = WebSocket.OPEN;
      mockWebSocket.onopen?.();
    });

    invalidateQueriesSpy.mockClear();

    // Send multiple rapid updates
    const updates = [
      { type: 'status_update', entity_type: 'workshop', entity_id: 'workshop-rapid', status: 'deploying' },
      { type: 'status_update', entity_type: 'attendee', entity_id: 'attendee-1', status: 'active' },
      { type: 'status_update', entity_type: 'attendee', entity_id: 'attendee-2', status: 'active' },
      { type: 'status_update', entity_type: 'workshop', entity_id: 'workshop-rapid', status: 'active' },
    ];

    updates.forEach(update => {
      act(() => {
        mockWebSocket.onmessage?.({ data: JSON.stringify(update) });
      });
    });

    // Workshops query should be invalidated for each update
    expect(invalidateQueriesSpy).toHaveBeenCalledWith('workshops');
    expect(invalidateQueriesSpy).toHaveBeenCalledWith(['workshops']);
    
    // Should have been called 4 times (once per update) for each query format
    const workshopsStringCalls = invalidateQueriesSpy.mock.calls.filter(call => call[0] === 'workshops');
    const workshopsArrayCalls = invalidateQueriesSpy.mock.calls.filter(call => 
      Array.isArray(call[0]) && call[0][0] === 'workshops' && call[0].length === 1
    );
    
    expect(workshopsStringCalls.length).toBe(4);
    expect(workshopsArrayCalls.length).toBe(4);
  });

  it('should demonstrate the fix enables Dashboard real-time updates', () => {
    // This test simulates the scenario where:
    // 1. User has Dashboard page open (uses 'workshops' query)
    // 2. User has WorkshopDetail page open (establishes WebSocket)
    // 3. Status update occurs
    // 4. Dashboard should update in real-time

    const onStatusUpdate = jest.fn();
    
    // Simulate WorkshopDetail page establishing WebSocket
    renderHook(() => useWebSocket({ 
      workshopId: 'production-workshop',
      onStatusUpdate 
    }), { wrapper });

    act(() => {
      mockWebSocket.readyState = WebSocket.OPEN;
      mockWebSocket.onopen?.();
    });

    // Simulate Dashboard query being active
    queryClient.setQueryData('workshops', [
      { id: 'production-workshop', status: 'deploying', active_attendees: 0 }
    ]);

    invalidateQueriesSpy.mockClear();

    // Workshop deployment completes
    const completionMessage = {
      type: 'status_update',
      entity_type: 'workshop',
      entity_id: 'production-workshop',
      status: 'active',
      details: { message: 'All attendees deployed successfully' }
    };

    act(() => {
      mockWebSocket.onmessage?.({ data: JSON.stringify(completionMessage) });
    });

    // The fix ensures 'workshops' query is invalidated
    // This would cause Dashboard to refetch and show updated status
    expect(invalidateQueriesSpy).toHaveBeenCalledWith('workshops');
    expect(invalidateQueriesSpy).toHaveBeenCalledWith(['workshops']);

    // Status update callback should be called
    expect(onStatusUpdate).toHaveBeenCalledWith(
      'workshop', 
      'production-workshop', 
      'active', 
      { message: 'All attendees deployed successfully' }
    );
  });

  it('should demonstrate the fix enables WorkshopList real-time updates', () => {
    // This test simulates the scenario where:
    // 1. User has WorkshopList page open (uses ['workshops', filter] query)
    // 2. User has WorkshopDetail page open (establishes WebSocket)
    // 3. Attendee status changes
    // 4. WorkshopList should update attendee counts in real-time

    renderHook(() => useWebSocket({ workshopId: 'dev-workshop' }), { wrapper });

    act(() => {
      mockWebSocket.readyState = WebSocket.OPEN;
      mockWebSocket.onopen?.();
    });

    invalidateQueriesSpy.mockClear();

    // Attendee becomes active
    const attendeeUpdate = {
      type: 'status_update',
      entity_type: 'attendee',
      entity_id: 'attendee-dev-1',
      status: 'active'
    };

    act(() => {
      mockWebSocket.onmessage?.({ data: JSON.stringify(attendeeUpdate) });
    });

    // The fix ensures workshops queries are invalidated
    // This would cause WorkshopList to refetch and show updated attendee counts
    expect(invalidateQueriesSpy).toHaveBeenCalledWith('workshops');
    expect(invalidateQueriesSpy).toHaveBeenCalledWith(['workshops']);

    // Specific workshop queries are also invalidated
    expect(invalidateQueriesSpy).toHaveBeenCalledWith(['workshop', 'dev-workshop']);
    expect(invalidateQueriesSpy).toHaveBeenCalledWith(['attendees', 'dev-workshop']);
  });
});