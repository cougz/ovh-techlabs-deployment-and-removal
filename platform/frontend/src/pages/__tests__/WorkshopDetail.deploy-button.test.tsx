/**
 * Test to reproduce DEPLOY-BUTTON-001: Fix Deploy Workshop button visibility logic
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

describe('WorkshopDetail Deploy Button Logic', () => {
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
    status: 'planning',
    created_at: '2025-07-22T08:00:00Z',
    updated_at: '2025-07-22T08:00:00Z',
    deletion_scheduled_at: '2025-07-22T19:15:00Z'
  };

  it('should show Deploy Workshop button when status is planning and no attendees deployed', async () => {
    const attendees = [
      { id: '1', username: 'user1', email: 'user1@test.com', status: 'planning' },
      { id: '2', username: 'user2', email: 'user2@test.com', status: 'planning' }
    ];

    workshopApi.getWorkshop.mockResolvedValue(mockWorkshop);
    attendeeApi.getWorkshopAttendees.mockResolvedValue(attendees);
    deploymentApi.getAttendeeDeploymentLogs.mockResolvedValue([]);

    renderWorkshopDetail();

    await screen.findByText('Deploy Workshop');
  });

  it('should NOT show Deploy Workshop button when all attendees are already deployed', async () => {
    const attendees = [
      { id: '1', username: 'user1', email: 'user1@test.com', status: 'active' },
      { id: '2', username: 'user2', email: 'user2@test.com', status: 'active' }
    ];

    workshopApi.getWorkshop.mockResolvedValue(mockWorkshop);
    attendeeApi.getWorkshopAttendees.mockResolvedValue(attendees);
    deploymentApi.getAttendeeDeploymentLogs.mockResolvedValue([]);

    renderWorkshopDetail();

    // Should NOT show Deploy Workshop button when all attendees are active
    const deployButton = screen.queryByText('Deploy Workshop');
    expect(deployButton).toBeNull();
  });

  it('should NOT show Deploy Workshop button when attendees are currently deploying', async () => {
    const attendees = [
      { id: '1', username: 'user1', email: 'user1@test.com', status: 'deploying' },
      { id: '2', username: 'user2', email: 'user2@test.com', status: 'planning' }
    ];

    workshopApi.getWorkshop.mockResolvedValue(mockWorkshop);
    attendeeApi.getWorkshopAttendees.mockResolvedValue(attendees);
    deploymentApi.getAttendeeDeploymentLogs.mockResolvedValue([]);

    renderWorkshopDetail();

    const deployButton = screen.queryByText('Deploy Workshop');
    expect(deployButton).toBeNull();
  });

  it('should show Deploy Workshop button when some attendees failed but others need deployment', async () => {
    const attendees = [
      { id: '1', username: 'user1', email: 'user1@test.com', status: 'failed' },
      { id: '2', username: 'user2', email: 'user2@test.com', status: 'planning' }
    ];

    workshopApi.getWorkshop.mockResolvedValue(mockWorkshop);
    attendeeApi.getWorkshopAttendees.mockResolvedValue(attendees);
    deploymentApi.getAttendeeDeploymentLogs.mockResolvedValue([]);

    renderWorkshopDetail();

    // Should show button since there are still planning attendees that need deployment
    await screen.findByText('Deploy Workshop');
  });

  it('should NOT show Deploy Workshop button when workshop status is active', async () => {
    const activeWorkshop = { ...mockWorkshop, status: 'active' };
    const attendees = [
      { id: '1', username: 'user1', email: 'user1@test.com', status: 'active' },
      { id: '2', username: 'user2', email: 'user2@test.com', status: 'active' }
    ];

    workshopApi.getWorkshop.mockResolvedValue(activeWorkshop);
    attendeeApi.getWorkshopAttendees.mockResolvedValue(attendees);
    deploymentApi.getAttendeeDeploymentLogs.mockResolvedValue([]);

    renderWorkshopDetail();

    const deployButton = screen.queryByText('Deploy Workshop');
    expect(deployButton).toBeNull();
  });

  it('should show contextual action when deployment is complete', async () => {
    const attendees = [
      { id: '1', username: 'user1', email: 'user1@test.com', status: 'active' },
      { id: '2', username: 'user2', email: 'user2@test.com', status: 'active' }
    ];

    workshopApi.getWorkshop.mockResolvedValue(mockWorkshop);
    attendeeApi.getWorkshopAttendees.mockResolvedValue(attendees);
    deploymentApi.getAttendeeDeploymentLogs.mockResolvedValue([]);

    renderWorkshopDetail();

    // Should show cleanup button instead of deploy button
    await screen.findByText('Cleanup Resources');
    
    const deployButton = screen.queryByText('Deploy Workshop');
    expect(deployButton).toBeNull();
  });
});