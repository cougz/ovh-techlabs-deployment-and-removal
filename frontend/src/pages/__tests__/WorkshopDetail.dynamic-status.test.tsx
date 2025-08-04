/**
 * Test to reproduce WORKSHOP-STATUS-001: Dynamic workshop status logic
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { BrowserRouter } from 'react-router-dom';
import WorkshopDetail from '../WorkshopDetail';

// Mock API calls
jest.mock('../../services/api', () => ({
  workshopApi: {
    getWorkshop: jest.fn(),
    deployWorkshop: jest.fn(),
    cleanupWorkshop: jest.fn(),
    deleteWorkshop: jest.fn(),
  },
  attendeeApi: {
    getWorkshopAttendees: jest.fn(),
  },
  deploymentApi: {
    getAttendeeDeploymentLogs: jest.fn(),
  },
}));

// Mock useWebSocket hook
jest.mock('../../hooks/useWebSocket', () => ({
  useWebSocket: jest.fn(),
}));

// Mock useParams to return test workshop ID
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ id: 'test-workshop-id' }),
}));

const { workshopApi, attendeeApi, deploymentApi } = require('../../services/api');

describe('WorkshopDetail Dynamic Status Logic', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    jest.clearAllMocks();
  });

  const renderWorkshopDetail = () => {
    return render(
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <WorkshopDetail />
        </QueryClientProvider>
      </BrowserRouter>
    );
  };

  const mockWorkshop = {
    id: 'test-workshop-id',
    name: 'Test Workshop',
    description: 'Test Description',
    start_date: '2025-07-22T09:00:00Z',
    end_date: '2025-07-22T18:15:00Z',
    status: 'planning', // Workshop still shows as planning
    created_at: '2025-07-22T08:00:00Z',
    updated_at: '2025-07-22T08:00:00Z',
    deletion_scheduled_at: '2025-07-22T19:15:00Z'
  };

  it('should show "Ready to deploy" when status is planning and no attendees deployed', async () => {
    const attendees = [
      { id: '1', username: 'user1', email: 'user1@test.com', status: 'planning' },
      { id: '2', username: 'user2', email: 'user2@test.com', status: 'planning' }
    ];

    workshopApi.getWorkshop.mockResolvedValue(mockWorkshop);
    attendeeApi.getWorkshopAttendees.mockResolvedValue(attendees);
    deploymentApi.getAttendeeDeploymentLogs.mockResolvedValue([]);

    renderWorkshopDetail();

    await screen.findByText('Ready to deploy');
  });

  it('should NOT show "Ready to deploy" when all attendees are deployed despite planning status', async () => {
    const attendees = [
      { id: '1', username: 'user1', email: 'user1@test.com', status: 'active' },
      { id: '2', username: 'user2', email: 'user2@test.com', status: 'active' }
    ];

    workshopApi.getWorkshop.mockResolvedValue(mockWorkshop);
    attendeeApi.getWorkshopAttendees.mockResolvedValue(attendees);
    deploymentApi.getAttendeeDeploymentLogs.mockResolvedValue([]);

    renderWorkshopDetail();

    // Should NOT show "Ready to deploy" when all attendees are active
    const readyToDeploy = screen.queryByText('Ready to deploy');
    expect(readyToDeploy).toBeNull();

    // Should show something indicating attendees are deployed
    await screen.findByText(/deployed/i);
  });

  it('should show "All attendees deployed" when planning status but all attendees active', async () => {
    const attendees = [
      { id: '1', username: 'user1', email: 'user1@test.com', status: 'active' },
      { id: '2', username: 'user2', email: 'user2@test.com', status: 'active' }
    ];

    workshopApi.getWorkshop.mockResolvedValue(mockWorkshop);
    attendeeApi.getWorkshopAttendees.mockResolvedValue(attendees);
    deploymentApi.getAttendeeDeploymentLogs.mockResolvedValue([]);

    renderWorkshopDetail();

    await screen.findByText('All attendees deployed');
  });

  it('should show "Partially deployed" when some attendees are active', async () => {
    const attendees = [
      { id: '1', username: 'user1', email: 'user1@test.com', status: 'active' },
      { id: '2', username: 'user2', email: 'user2@test.com', status: 'planning' },
      { id: '3', username: 'user3', email: 'user3@test.com', status: 'failed' }
    ];

    workshopApi.getWorkshop.mockResolvedValue(mockWorkshop);
    attendeeApi.getWorkshopAttendees.mockResolvedValue(attendees);
    deploymentApi.getAttendeeDeploymentLogs.mockResolvedValue([]);

    renderWorkshopDetail();

    await screen.findByText('Partially deployed');
  });

  it('should show "Deployment in progress" when attendees are deploying', async () => {
    const attendees = [
      { id: '1', username: 'user1', email: 'user1@test.com', status: 'deploying' },
      { id: '2', username: 'user2', email: 'user2@test.com', status: 'planning' }
    ];

    workshopApi.getWorkshop.mockResolvedValue(mockWorkshop);
    attendeeApi.getWorkshopAttendees.mockResolvedValue(attendees);
    deploymentApi.getAttendeeDeploymentLogs.mockResolvedValue([]);

    renderWorkshopDetail();

    await screen.findByText('Deployment in progress');
  });

  it('should respect actual workshop status when it matches attendee states', async () => {
    const activeWorkshop = { ...mockWorkshop, status: 'active' };
    const attendees = [
      { id: '1', username: 'user1', email: 'user1@test.com', status: 'active' },
      { id: '2', username: 'user2', email: 'user2@test.com', status: 'active' }
    ];

    workshopApi.getWorkshop.mockResolvedValue(activeWorkshop);
    attendeeApi.getWorkshopAttendees.mockResolvedValue(attendees);
    deploymentApi.getAttendeeDeploymentLogs.mockResolvedValue([]);

    renderWorkshopDetail();

    await screen.findByText('Workshop running');
  });
});