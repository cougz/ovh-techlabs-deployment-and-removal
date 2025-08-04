import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import AttendeeView from '../AttendeeView';

// Mock the API modules
jest.mock('../../services/api', () => ({
  attendeeApi: {
    getAttendee: jest.fn(),
    getAttendeeCredentials: jest.fn(),
  },
  deploymentApi: {
    getAttendeeDeploymentLogs: jest.fn(),
  },
}));

const createWrapper = (attendeeId: string) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/attendees/${attendeeId}`]}>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('AttendeeView Page', () => {
  const { attendeeApi, deploymentApi } = require('../../services/api');

  const mockAttendee = {
    id: 'attendee-1',
    username: 'john.doe',
    email: 'john.doe@example.com',
    status: 'active' as const,
    workshop_id: 'workshop-1',
    ovh_project_id: 'proj-123',
    created_at: '2024-07-01T00:00:00Z',
    updated_at: '2024-07-01T00:00:00Z',
  };

  const mockCredentials = {
    username: 'ovh-user-123',
    password: 'secure-password-456',
    access_key: 'access-key-789',
    secret_key: 'secret-key-012',
  };

  const mockDeploymentLogs = [
    {
      id: 'log-1',
      attendee_id: 'attendee-1',
      action: 'create_project',
      status: 'completed' as const,
      terraform_output: 'Successfully created project',
      error_message: null,
      created_at: '2024-07-01T10:00:00Z',
      updated_at: '2024-07-01T10:05:00Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default API responses
    attendeeApi.getAttendee.mockResolvedValue(mockAttendee);
    attendeeApi.getAttendeeCredentials.mockResolvedValue(mockCredentials);
    deploymentApi.getAttendeeDeploymentLogs.mockResolvedValue(mockDeploymentLogs);

    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn(() => Promise.resolve()),
      },
    });
  });

  describe('component rendering', () => {
    it('should display attendee information when data loads', async () => {
      const Wrapper = createWrapper('attendee-1');
      
      render(<AttendeeView />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('john.doe')).toBeInTheDocument();
        expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
        expect(screen.getByText('active')).toBeInTheDocument();
        expect(screen.getByText('proj-123')).toBeInTheDocument();
      });
    });

    it('should show loading state initially', () => {
      const Wrapper = createWrapper('attendee-1');
      
      render(<AttendeeView />, { wrapper: Wrapper });

      // Should show loading skeleton
      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  describe('credentials management for active attendees', () => {
    it('should show credentials section for active attendees', async () => {
      const Wrapper = createWrapper('attendee-1');
      
      render(<AttendeeView />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('Access Credentials')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /show/i })).toBeInTheDocument();
      });
    });

    it('should toggle credentials visibility when show/hide button is clicked', async () => {
      const Wrapper = createWrapper('attendee-1');
      
      render(<AttendeeView />, { wrapper: Wrapper });

      await waitFor(() => {
        const showButton = screen.getByRole('button', { name: /show/i });
        fireEvent.click(showButton);
      });

      await waitFor(() => {
        expect(screen.getByText('ovh-user-123')).toBeInTheDocument();
        expect(screen.getByText('secure-password-456')).toBeInTheDocument();
        expect(screen.getByText('access-key-789')).toBeInTheDocument();
        expect(screen.getByText('secret-key-012')).toBeInTheDocument();
      });

      // Button should now show "Hide"
      expect(screen.getByRole('button', { name: /hide/i })).toBeInTheDocument();
    });
  });

  describe('credentials for non-active attendees', () => {
    it('should not show credentials section for planning attendees', async () => {
      attendeeApi.getAttendee.mockResolvedValue({
        ...mockAttendee,
        status: 'planning',
      });

      const Wrapper = createWrapper('attendee-1');
      
      render(<AttendeeView />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('john.doe')).toBeInTheDocument();
      });

      expect(screen.queryByText('Access Credentials')).not.toBeInTheDocument();
    });
  });

  describe('deployment history', () => {
    it('should display deployment history section', async () => {
      const Wrapper = createWrapper('attendee-1');
      
      render(<AttendeeView />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('Deployment History')).toBeInTheDocument();
      });
    });

    it('should show deployment logs with correct information', async () => {
      const Wrapper = createWrapper('attendee-1');
      
      render(<AttendeeView />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('create_project')).toBeInTheDocument();
        expect(screen.getByText('completed')).toBeInTheDocument();
      });
    });

    it('should show empty state when no logs available', async () => {
      deploymentApi.getAttendeeDeploymentLogs.mockResolvedValue([]);

      const Wrapper = createWrapper('attendee-1');
      
      render(<AttendeeView />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText(/no deployment history available/i)).toBeInTheDocument();
      });
    });
  });

  describe('attendee actions', () => {
    it('should show destroy button for active attendees', async () => {
      const Wrapper = createWrapper('attendee-1');
      
      render(<AttendeeView />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /destroy resources/i })).toBeInTheDocument();
      });
    });

    it('should show deploy button for planning attendees', async () => {
      attendeeApi.getAttendee.mockResolvedValue({
        ...mockAttendee,
        status: 'planning',
      });

      const Wrapper = createWrapper('attendee-1');
      
      render(<AttendeeView />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /deploy resources/i })).toBeInTheDocument();
      });
    });

    it('should always show remove attendee button', async () => {
      const Wrapper = createWrapper('attendee-1');
      
      render(<AttendeeView />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /remove attendee/i })).toBeInTheDocument();
      });
    });
  });

  describe('navigation', () => {
    it('should show back to workshop link with correct workshop ID', async () => {
      const Wrapper = createWrapper('attendee-1');
      
      render(<AttendeeView />, { wrapper: Wrapper });

      await waitFor(() => {
        const backLink = screen.getByRole('link', { name: /back to workshop/i });
        expect(backLink).toHaveAttribute('href', '/workshops/workshop-1');
      });
    });
  });

  describe('error handling', () => {
    it('should show error message when attendee not found', async () => {
      attendeeApi.getAttendee.mockRejectedValue(new Error('Attendee not found'));

      const Wrapper = createWrapper('attendee-1');
      
      render(<AttendeeView />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('Attendee Not Found')).toBeInTheDocument();
        expect(screen.getByText(/attendee you're looking for doesn't exist/i)).toBeInTheDocument();
      });
    });

    it('should handle credentials loading errors gracefully', async () => {
      attendeeApi.getAttendeeCredentials.mockRejectedValue(new Error('Credentials not found'));

      const Wrapper = createWrapper('attendee-1');
      
      render(<AttendeeView />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('john.doe')).toBeInTheDocument();
      });

      // Should still show the credentials section
      expect(screen.getByText('Access Credentials')).toBeInTheDocument();
    });
  });

  describe('status display', () => {
    it('should show appropriate status indicators', async () => {
      const Wrapper = createWrapper('attendee-1');
      
      render(<AttendeeView />, { wrapper: Wrapper });

      await waitFor(() => {
        // Status should appear in multiple places
        const statusElements = screen.getAllByText('active');
        expect(statusElements.length).toBeGreaterThan(0);
      });
    });

    it('should display OVH project ID when available', async () => {
      const Wrapper = createWrapper('attendee-1');
      
      render(<AttendeeView />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('OVH Project ID')).toBeInTheDocument();
        expect(screen.getByText('proj-123')).toBeInTheDocument();
      });
    });
  });
});