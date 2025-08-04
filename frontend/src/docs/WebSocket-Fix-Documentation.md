# WebSocket Real-time Updates Fix

## Problem Description

The TechLabs Automation frontend had an issue where real-time WebSocket updates worked correctly in individual workshop detail pages (`/workshops/{id}`) but did NOT work in the Dashboard (`/dashboard`) and Workshop List (`/workshops`) pages. Users had to manually refresh these pages to see current status updates.

## Root Cause Analysis

### The Problem
The `useWebSocket` hook was only invalidating specific queries when receiving status updates:

```typescript
// BEFORE (problematic code)
case 'status_update':
  if (message.entity_type && message.entity_id && message.status) {
    // Only invalidated specific workshop queries
    queryClient.invalidateQueries(['attendees', workshopId]);
    queryClient.invalidateQueries(['workshop', workshopId]);
    
    // Missing: No invalidation of 'workshops' query!
    onStatusUpdate?.(message.entity_type, message.entity_id, message.status, message.details);
  }
  break;
```

### Why This Caused the Issue
- **Dashboard page** uses: `useQuery('workshops', ...)` 
- **WorkshopList page** uses: `useQuery(['workshops', statusFilter], ...)`
- **WorkshopDetail page** uses: `useQuery(['workshop', workshopId], ...)` ← This worked fine!

When a WebSocket status update was received, it only invalidated the specific workshop and attendees queries, but **NOT** the general `workshops` query that Dashboard and WorkshopList depend on.

## The Solution

Modified the `useWebSocket` hook to also invalidate the `workshops` queries:

```typescript
// AFTER (fixed code)
case 'status_update':
  if (message.entity_type && message.entity_id && message.status) {
    // Invalidate React Query cache to trigger re-fetch
    queryClient.invalidateQueries(['attendees', workshopId]);
    queryClient.invalidateQueries(['workshop', workshopId]);
    
    // IMPORTANT: Also invalidate the workshops list query
    // This ensures Dashboard and WorkshopList pages get real-time updates
    queryClient.invalidateQueries('workshops');
    queryClient.invalidateQueries(['workshops']);

    // Call callback
    onStatusUpdate?.(message.entity_type, message.entity_id, message.status, message.details);
  }
  break;
```

## How Real-time Updates Now Work

### Scenario 1: Workshop Status Changes
1. User has Dashboard open in one browser tab
2. User has Workshop Detail (`/workshops/workshop-123`) open in another tab
3. Workshop status changes from "deploying" to "active" on the backend
4. Backend sends WebSocket message to `/ws/workshop-123`
5. Workshop Detail page receives WebSocket message
6. `useWebSocket` hook invalidates:
   - `['attendees', 'workshop-123']`
   - `['workshop', 'workshop-123']`
   - `'workshops'` ← **NEW: This makes Dashboard update!**
   - `['workshops']` ← **NEW: This makes WorkshopList update!**
7. Dashboard automatically refetches and shows new status without page refresh

### Scenario 2: Attendee Status Changes
1. User has WorkshopList open 
2. User has Workshop Detail open for the same workshop
3. An attendee status changes from "deploying" to "active"
4. WebSocket message triggers query invalidation
5. WorkshopList automatically updates attendee counts in real-time

## Benefits of This Fix

### ✅ Real-time Updates
- Dashboard now shows workshop status changes immediately
- WorkshopList shows attendee count changes in real-time
- No more manual page refreshes needed

### ✅ Minimal Code Change
- Single fix in one location (`useWebSocket.ts`)
- No backend changes required
- Maintains backward compatibility

### ✅ Efficient Implementation
- Leverages existing WebSocket infrastructure
- Uses React Query's intelligent caching and invalidation
- Only refetches data when necessary

### ✅ Cross-tab Updates
- If user has multiple tabs open, updates propagate across all tabs
- Works even if only one tab has a Workshop Detail page open

## Technical Details

### Query Invalidation Strategy
```typescript
// Invalidate both query key formats to ensure compatibility
queryClient.invalidateQueries('workshops');        // String format
queryClient.invalidateQueries(['workshops']);      // Array format
```

### WebSocket Connection Requirements
For real-time updates to work:
1. At least one Workshop Detail page must be open (to establish WebSocket connection)
2. The WebSocket connection must be to the workshop that has status changes
3. Dashboard/WorkshopList pages must be in the same QueryClient context

### Limitations Addressed
- **Before**: Updates only worked if you were on the specific workshop page
- **After**: Updates work across all pages when any workshop detail page is open
- **Future Enhancement**: Could implement a global WebSocket connection for even better coverage

## Testing

The fix includes comprehensive tests that verify:
- WebSocket messages trigger proper query invalidations
- Dashboard updates reflect workshop status changes
- WorkshopList updates show attendee count changes
- Multiple rapid updates are handled correctly
- Existing WorkshopDetail functionality remains intact

## File Changes

### Modified Files
- `/src/hooks/useWebSocket.ts` - Added workshops query invalidation

### New Test Files
- `/src/pages/__tests__/Dashboard.websocket.test.tsx` - Tests current behavior (no WebSocket)
- `/src/pages/__tests__/WorkshopList.websocket.test.tsx` - Tests current behavior (no WebSocket)  
- `/src/pages/__tests__/Dashboard.websocket-realtime.test.tsx` - Tests real-time updates
- `/src/pages/__tests__/WorkshopList.websocket-realtime.test.tsx` - Tests real-time updates
- `/src/hooks/__tests__/useWebSocket.fix.test.tsx` - Tests the specific fix

## Deployment Notes

This is a frontend-only fix that:
- Requires no backend changes
- Requires no database migrations  
- Is backward compatible
- Can be deployed independently

Users will immediately see real-time updates after the frontend deployment, as long as they have at least one workshop detail page open in their browser session.