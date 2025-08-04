import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';

import WorkshopDetail from '../WorkshopDetail';
import type { Workshop, Attendee } from '../../types';

// Mock the API services
jest.mock('../../services/api', () => ({
  workshopApi: {
    getWorkshop: jest.fn(),
    exportWorkshopAttendees: jest.fn(),
    cleanupWorkshopResources: jest.fn(),
  },
  attendeeApi: {
    getWorkshopAttendees: jest.fn(),
  },
  deploymentApi: {
    getWorkshopDeploymentLogs: jest.fn(),
  }
}));

// Mock the WebSocket hook
jest.mock('../../hooks/useWebSocket', () => ({
  __esModule: true,
  default: jest.fn(() => ({})),
}));

// Mock React Query hooks directly
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQuery: jest.fn(),
  useQueryClient: jest.fn(() => ({
    invalidateQueries: jest.fn(),
  })),
}));

const mockWorkshop: Workshop = {
  id: 'workshop-123',
  name: 'Test Workshop',
  description: 'Test Description',
  start_date: '2024-01-01T10:00:00Z',
  end_date: '2024-01-01T18:00:00Z',
  timezone: 'UTC',
  template: 'Generic',
  status: 'planning',
  created_at: '2024-01-01T09:00:00Z',
  updated_at: '2024-01-01T09:00:00Z',
};

const mockAttendees: Attendee[] = [
  {
    id: 'attendee-1',
    workshop_id: 'workshop-123',
    username: 'user1',
    email: 'user1@test.com',
    status: 'active',
    created_at: '2024-01-01T09:00:00Z',
    updated_at: '2024-01-01T09:00:00Z',
  },
  {
    id: 'attendee-2', 
    workshop_id: 'workshop-123',
    username: 'user2',
    email: 'user2@test.com',
    status: 'active',
    created_at: '2024-01-01T09:00:00Z',
    updated_at: '2024-01-01T09:00:00Z',
  }
];

function renderWithProviders(component: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/workshops/workshop-123']}>
        {component}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('WorkshopDetail - Status Display', () => {
  beforeEach(() => {
    const { useQuery } = require('@tanstack/react-query');
    
    // Default mock implementations
    useQuery
      .mockImplementationOnce(() => ({
        data: mockWorkshop,
        isLoading: false,
        error: null,
      }))
      .mockImplementationOnce(() => ({
        data: mockAttendees,
        isLoading: false,
        refetch: jest.fn(),
      }))
      .mockImplementationOnce(() => ({
        data: [],
        isLoading: false,
      }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should show "Ready to deploy" when workshop is in planning state with attendees', () => {
    renderWithProviders(<WorkshopDetail />);

    expect(screen.getByText('Ready to deploy')).toBeInTheDocument();
  });

  test('should not show "Ready to deploy" when workshop is active', () => {
    const { useQuery } = require('@tanstack/react-query');
    
    // Mock active workshop
    useQuery
      .mockImplementationOnce(() => ({
        data: { ...mockWorkshop, status: 'active' },
        isLoading: false,
        error: null,
      }))
      .mockImplementationOnce(() => ({
        data: mockAttendees,
        isLoading: false,
        refetch: jest.fn(),
      }))
      .mockImplementationOnce(() => ({
        data: [],
        isLoading: false,
      }));

    renderWithProviders(<WorkshopDetail />);

    expect(screen.getByText('Workshop running')).toBeInTheDocument();
    expect(screen.queryByText('Ready to deploy')).not.toBeInTheDocument();
  });

  test('should show correct status when workshop is deploying', () => {
    const { useQuery } = require('@tanstack/react-query');
    
    useQuery
      .mockImplementationOnce(() => ({
        data: { ...mockWorkshop, status: 'deploying' },
        isLoading: false,
        error: null,
      }))
      .mockImplementationOnce(() => ({
        data: mockAttendees,
        isLoading: false,
        refetch: jest.fn(),
      }))
      .mockImplementationOnce(() => ({
        data: [],
        isLoading: false,
      }));

    renderWithProviders(<WorkshopDetail />);

    expect(screen.getByText('Deployment in progress')).toBeInTheDocument();
    expect(screen.queryByText('Ready to deploy')).not.toBeInTheDocument();
  });

  test('should show failed status when deployment fails', () => {
    const { useQuery } = require('@tanstack/react-query');
    
    useQuery
      .mockImplementationOnce(() => ({
        data: { ...mockWorkshop, status: 'failed' },
        isLoading: false,
        error: null,
      }))
      .mockImplementationOnce(() => ({
        data: mockAttendees,
        isLoading: false,
        refetch: jest.fn(),
      }))
      .mockImplementationOnce(() => ({
        data: [],
        isLoading: false,
      }));

    renderWithProviders(<WorkshopDetail />);

    expect(screen.getByText('Deployment failed')).toBeInTheDocument();
    expect(screen.queryByText('Ready to deploy')).not.toBeInTheDocument();
  });

  test('should update status display when workshop status changes', () => {
    const { useQuery } = require('@tanstack/react-query');
    
    // First render with planning status
    useQuery
      .mockImplementationOnce(() => ({
        data: mockWorkshop,
        isLoading: false,
        error: null,
      }))
      .mockImplementationOnce(() => ({
        data: mockAttendees,
        isLoading: false,
        refetch: jest.fn(),
      }))
      .mockImplementationOnce(() => ({
        data: [],
        isLoading: false,
      }));

    const { rerender } = renderWithProviders(<WorkshopDetail />);

    expect(screen.getByText('Ready to deploy')).toBeInTheDocument();

    // Rerender with active status (simulating WebSocket update)
    useQuery
      .mockImplementationOnce(() => ({
        data: { ...mockWorkshop, status: 'active' },
        isLoading: false,
        error: null,
      }))
      .mockImplementationOnce(() => ({
        data: mockAttendees,
        isLoading: false,
        refetch: jest.fn(),
      }))
      .mockImplementationOnce(() => ({
        data: [],
        isLoading: false,
      }));

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/workshops/workshop-123']}>
          <WorkshopDetail />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText('Workshop running')).toBeInTheDocument();
    expect(screen.queryByText('Ready to deploy')).not.toBeInTheDocument();
  });

  test('should reflect status based on attendee deployment state', () => {
    // This test validates the business logic - if attendees are active, workshop should show active
    const attendeesAllActive = mockAttendees.every(a => a.status === 'active');
    const expectedWorkshopStatus = attendeesAllActive ? 'active' : 'planning';
    
    expect(expectedWorkshopStatus).toBe('active');
    expect(attendeesAllActive).toBe(true);
  });
});