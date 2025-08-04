/**
 * Test to verify workshop list status synchronization with detail page logic
 * Reproduces issue where workshop list shows "planning" but attendees are deployed
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { BrowserRouter } from 'react-router-dom';
import WorkshopList from '../WorkshopList';

// Mock API calls
jest.mock('../../services/api', () => ({
  workshopApi: {
    getWorkshops: jest.fn(),
    deployWorkshop: jest.fn(),
    cleanupWorkshop: jest.fn(),
    deleteWorkshop: jest.fn(),
  },
}));

const { workshopApi } = require('../../services/api');

describe('WorkshopList Status Synchronization', () => {
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

  const renderWorkshopList = () => {
    return render(
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <WorkshopList />
        </QueryClientProvider>
      </BrowserRouter>
    );
  };

  it('should show active status when all attendees deployed despite planning workshop status', async () => {
    const workshop = {
      id: 'test-workshop-id',
      name: 'test014',
      description: 'Test Description',
      start_date: '2025-07-22T09:00:00Z',
      end_date: '2025-07-22T18:15:00Z',
      status: 'planning', // Backend status is planning
      attendee_count: 2,
      active_attendees: 2, // But all attendees are active/deployed
      created_at: '2025-07-22T08:00:00Z',
      updated_at: '2025-07-22T08:00:00Z',
    };

    workshopApi.getWorkshops.mockResolvedValue([workshop]);

    renderWorkshopList();

    // Wait for workshop to render
    await screen.findByText('test014');

    // FIXED: Should now show "active" instead of "planning"
    const activeStatusBadge = screen.getByText('active');
    expect(activeStatusBadge).toBeInTheDocument();

    // Verify all attendees are indeed deployed
    expect(workshop.active_attendees).toBe(workshop.attendee_count);
  });

  it('should show deploying status when some attendees are deploying', async () => {
    const workshop = {
      id: 'test-workshop-id',
      name: 'test015',
      description: 'Test Description',
      start_date: '2025-07-22T09:00:00Z',
      end_date: '2025-07-22T18:15:00Z',
      status: 'planning',
      attendee_count: 3,
      active_attendees: 1, // Partial deployment
      created_at: '2025-07-22T08:00:00Z',
      updated_at: '2025-07-22T08:00:00Z',
    };

    workshopApi.getWorkshops.mockResolvedValue([workshop]);

    renderWorkshopList();

    await screen.findByText('test015');

    // FIXED: Should now show "deploying" for partial deployment
    const deployingStatusBadge = screen.getByText('deploying');
    expect(deployingStatusBadge).toBeInTheDocument();
  });

  it('should use consistent status icons between list and detail pages', async () => {
    const workshop = {
      id: 'test-workshop-id',
      name: 'test016',
      description: 'Test Description',
      start_date: '2025-07-22T09:00:00Z',
      end_date: '2025-07-22T18:15:00Z',
      status: 'planning',
      attendee_count: 2,
      active_attendees: 2, // All deployed
      created_at: '2025-07-22T08:00:00Z',
      updated_at: '2025-07-22T08:00:00Z',
    };

    workshopApi.getWorkshops.mockResolvedValue([workshop]);

    renderWorkshopList();

    await screen.findByText('test016');

    // FIXED: Should now show success icon when all attendees deployed
    const successIcon = document.querySelector('svg.text-success-500');
    expect(successIcon).toBeInTheDocument(); // Now shows success icon

    // Should NOT show gray planning icon anymore
    const grayIcon = document.querySelector('svg.text-gray-500');
    expect(grayIcon).toBeNull(); // No gray icon for deployed workshops
  });
});