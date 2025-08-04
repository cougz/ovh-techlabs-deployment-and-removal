import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import WorkshopDetail from '../WorkshopDetail';
import { authSlice } from '../../store/slices/authSlice';

// Mock the API modules
jest.mock('../../services/api', () => ({
  workshopApi: {
    getWorkshop: jest.fn(),
    deployWorkshop: jest.fn(),
    cleanupWorkshop: jest.fn(),
    deleteWorkshop: jest.fn(),
  },
  attendeeApi: {
    getWorkshopAttendees: jest.fn(),
    createAttendee: jest.fn(),
    deleteAttendee: jest.fn(),
  },
  deploymentApi: {
    getAttendeeDeploymentLogs: jest.fn(),
  },
}));

const createMockStore = () => configureStore({
  reducer: {
    auth: authSlice.reducer,
  },
  preloadedState: {
    auth: {
      user: { id: 'test-user', username: 'testuser', email: 'test@example.com' },
      token: 'test-token',
      isAuthenticated: true,
      isLoading: false,
      error: null,
    },
  },
});

const createWrapper = (workshopId: string) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const store = createMockStore();

  return ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/workshops/${workshopId}`]}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>
  );
};

describe('WorkshopDetail Page', () => {
  const { workshopApi, attendeeApi, deploymentApi } = require('../../services/api');

  const mockWorkshop = {
    id: 'workshop-1',
    name: 'Test Workshop',
    description: 'A test workshop description',
    start_date: '2024-07-15T10:00:00Z',
    end_date: '2024-07-15T18:00:00Z',
    status: 'planning' as const,
    created_at: '2024-07-01T00:00:00Z',
    updated_at: '2024-07-01T00:00:00Z',
  };

  const mockAttendees = [
    {
      id: 'attendee-1',
      username: 'john.doe',
      email: 'john.doe@example.com',
      status: 'planning' as const,
      workshop_id: 'workshop-1',
      created_at: '2024-07-01T00:00:00Z',
      updated_at: '2024-07-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default API responses
    workshopApi.getWorkshop.mockResolvedValue(mockWorkshop);
    attendeeApi.getWorkshopAttendees.mockResolvedValue(mockAttendees);
    deploymentApi.getAttendeeDeploymentLogs.mockResolvedValue([]);
  });

  describe('component rendering', () => {
    it('should display workshop information when data loads', async () => {
      const Wrapper = createWrapper('workshop-1');
      
      render(<WorkshopDetail />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('Test Workshop')).toBeInTheDocument();
      });

      expect(screen.getByText('A test workshop description')).toBeInTheDocument();
    });

    it('should show loading state initially', () => {
      const Wrapper = createWrapper('workshop-1');
      
      render(<WorkshopDetail />, { wrapper: Wrapper });

      // Should show loading skeleton
      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('should handle missing workshop ID', () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const store = createMockStore();

      const WrapperNoId = ({ children }: { children: React.ReactNode }) => (
        <Provider store={store}>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={['/workshops/']}>
              {children}
            </MemoryRouter>
          </QueryClientProvider>
        </Provider>
      );

      render(<WorkshopDetail />, { wrapper: WrapperNoId });

      expect(screen.getByText('Invalid Workshop ID')).toBeInTheDocument();
    });
  });

  describe('attendee management', () => {
    it('should show add attendee form when button is clicked', async () => {
      const Wrapper = createWrapper('workshop-1');
      
      render(<WorkshopDetail />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('Test Workshop')).toBeInTheDocument();
      });

      // Click add attendee button
      const addButton = screen.getByRole('button', { name: /add attendee/i });
      fireEvent.click(addButton);

      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    });

    it('should display attendee information', async () => {
      const Wrapper = createWrapper('workshop-1');
      
      render(<WorkshopDetail />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('john.doe')).toBeInTheDocument();
        expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
      });
    });
  });

  describe('workshop actions', () => {
    it('should show deploy button when workshop is in planning status', async () => {
      const Wrapper = createWrapper('workshop-1');
      
      render(<WorkshopDetail />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /deploy workshop/i })).toBeInTheDocument();
      });
    });

    it('should show cleanup button when workshop is active', async () => {
      workshopApi.getWorkshop.mockResolvedValue({
        ...mockWorkshop,
        status: 'active',
      });

      const Wrapper = createWrapper('workshop-1');
      
      render(<WorkshopDetail />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cleanup resources/i })).toBeInTheDocument();
      });
    });

    it('should always show delete button', async () => {
      const Wrapper = createWrapper('workshop-1');
      
      render(<WorkshopDetail />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete workshop/i })).toBeInTheDocument();
      });
    });
  });

  describe('navigation', () => {
    it('should show back to workshops link', async () => {
      const Wrapper = createWrapper('workshop-1');
      
      render(<WorkshopDetail />, { wrapper: Wrapper });

      await waitFor(() => {
        const backLink = screen.getByRole('link', { name: /back to workshops/i });
        expect(backLink).toHaveAttribute('href', '/workshops');
      });
    });
  });

  describe('workshop status display', () => {
    it('should show correct status for planning workshop', async () => {
      const Wrapper = createWrapper('workshop-1');
      
      render(<WorkshopDetail />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('planning')).toBeInTheDocument();
        expect(screen.getByText('Ready to deploy')).toBeInTheDocument();
      });
    });

    it('should format dates correctly', async () => {
      const Wrapper = createWrapper('workshop-1');
      
      render(<WorkshopDetail />, { wrapper: Wrapper });

      await waitFor(() => {
        // Should show formatted date
        expect(screen.getByText(/July 15, 2024/)).toBeInTheDocument();
      });
    });
  });

  describe('attendee count display', () => {
    it('should show correct attendee count', async () => {
      const Wrapper = createWrapper('workshop-1');
      
      render(<WorkshopDetail />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('1 total')).toBeInTheDocument();
      });
    });

    it('should handle empty attendee list', async () => {
      attendeeApi.getWorkshopAttendees.mockResolvedValue([]);

      const Wrapper = createWrapper('workshop-1');
      
      render(<WorkshopDetail />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('No attendees')).toBeInTheDocument();
      });
    });
  });

  describe('form validation', () => {
    it('should require username and email fields', async () => {
      const Wrapper = createWrapper('workshop-1');
      
      render(<WorkshopDetail />, { wrapper: Wrapper });

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /add attendee/i }));
      });

      const usernameInput = screen.getByLabelText(/username/i);
      const emailInput = screen.getByLabelText(/email/i);

      expect(usernameInput).toHaveAttribute('required');
      expect(emailInput).toHaveAttribute('required');
      expect(emailInput).toHaveAttribute('type', 'email');
    });
  });
});