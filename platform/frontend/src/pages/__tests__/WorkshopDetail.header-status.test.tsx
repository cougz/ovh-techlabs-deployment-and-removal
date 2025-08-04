/**
 * Test to reproduce WORKSHOP-HEADER-STATUS-001: Workshop header status inconsistency
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

describe('WorkshopDetail Header Status Consistency', () => {
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
    name: 'test014',
    description: 'Test Description',
    start_date: '2025-07-22T09:00:00Z',
    end_date: '2025-07-22T18:15:00Z',
    status: 'planning', // Workshop status is still planning
    created_at: '2025-07-22T08:00:00Z',
    updated_at: '2025-07-22T08:00:00Z',
    deletion_scheduled_at: '2025-07-22T19:15:00Z'
  };

  it('should show consistent status between header badge and main content when all attendees deployed', async () => {
    const attendees = [
      { id: '1', username: 'user1', email: 'user1@test.com', status: 'active' },
      { id: '2', username: 'user2', email: 'user2@test.com', status: 'active' }
    ];

    workshopApi.getWorkshop.mockResolvedValue(mockWorkshop);
    attendeeApi.getWorkshopAttendees.mockResolvedValue(attendees);
    deploymentApi.getAttendeeDeploymentLogs.mockResolvedValue([]);

    renderWorkshopDetail();

    // Main content should show "All attendees deployed"
    await screen.findByText('All attendees deployed');

    // Header badge should NOT show "planning" when all attendees are deployed
    // This test will fail initially because header shows raw workshop.status
    const headerStatusBadges = document.querySelectorAll('.status-planning');
    
    // Should not have planning status badges when attendees are deployed
    expect(headerStatusBadges.length).toBe(0);
    
    // Should have active status indication in header
    const activeStatusBadges = document.querySelectorAll('.status-active');
    expect(activeStatusBadges.length).toBeGreaterThan(0);
  });

  it('should show active status icon when all attendees are deployed despite planning workshop status', async () => {
    const attendees = [
      { id: '1', username: 'user1', email: 'user1@test.com', status: 'active' },
      { id: '2', username: 'user2', email: 'user2@test.com', status: 'active' }
    ];

    workshopApi.getWorkshop.mockResolvedValue(mockWorkshop);
    attendeeApi.getWorkshopAttendees.mockResolvedValue(attendees);
    deploymentApi.getAttendeeDeploymentLogs.mockResolvedValue([]);

    renderWorkshopDetail();

    await screen.findByText('All attendees deployed');

    // Should show success icon (CheckCircle) instead of gray clock icon
    const successIcons = document.querySelectorAll('svg.text-success-500');
    expect(successIcons.length).toBeGreaterThan(0);
    
    // Should NOT show gray planning icon
    const grayIcons = document.querySelectorAll('svg.text-gray-500');
    expect(grayIcons.length).toBe(0);
  });

  it('should show deploying status in header when attendees are deploying', async () => {
    const attendees = [
      { id: '1', username: 'user1', email: 'user1@test.com', status: 'deploying' },
      { id: '2', username: 'user2', email: 'user2@test.com', status: 'planning' }
    ];

    workshopApi.getWorkshop.mockResolvedValue(mockWorkshop);
    attendeeApi.getWorkshopAttendees.mockResolvedValue(attendees);
    deploymentApi.getAttendeeDeploymentLogs.mockResolvedValue([]);

    renderWorkshopDetail();

    await screen.findByText('Deployment in progress');

    // Header should show deploying status
    const deployingStatusBadges = document.querySelectorAll('.status-deploying');
    expect(deployingStatusBadges.length).toBeGreaterThan(0);
    
    // Should show spinning clock icon
    const spinningIcons = document.querySelectorAll('svg.animate-spin.text-warning-500');
    expect(spinningIcons.length).toBeGreaterThan(0);
  });

  it('should show planning status only when actually ready to deploy', async () => {
    const attendees = [
      { id: '1', username: 'user1', email: 'user1@test.com', status: 'planning' },
      { id: '2', username: 'user2', email: 'user2@test.com', status: 'planning' }
    ];

    workshopApi.getWorkshop.mockResolvedValue(mockWorkshop);
    attendeeApi.getWorkshopAttendees.mockResolvedValue(attendees);
    deploymentApi.getAttendeeDeploymentLogs.mockResolvedValue([]);

    renderWorkshopDetail();

    await screen.findByText('Ready to deploy');

    // Should show planning status in header when actually ready to deploy
    const planningStatusBadges = document.querySelectorAll('.status-planning');
    expect(planningStatusBadges.length).toBeGreaterThan(0);
    
    // Should show gray icon
    const grayIcons = document.querySelectorAll('svg.text-gray-500');
    expect(grayIcons.length).toBeGreaterThan(0);
  });

  it('should synchronize header and main content status messages', async () => {
    const attendees = [
      { id: '1', username: 'user1', email: 'user1@test.com', status: 'active' },
      { id: '2', username: 'user2', email: 'user2@test.com', status: 'planning' }
    ];

    workshopApi.getWorkshop.mockResolvedValue(mockWorkshop);
    attendeeApi.getWorkshopAttendees.mockResolvedValue(attendees);
    deploymentApi.getAttendeeDeploymentLogs.mockResolvedValue([]);

    renderWorkshopDetail();

    // Main content shows "Partially deployed"
    await screen.findByText('Partially deployed');

    // Header should also indicate partially deployed state
    // This could be shown with a mixed or intermediate status
    const statusBadgeText = document.querySelector('span[class*="status-"]')?.textContent;
    
    // Should not show "planning" when some attendees are deployed
    expect(statusBadgeText).not.toBe('planning');
  });
});