import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
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
  useWebSocket: jest.fn(),
}));

// Mock React Query hooks directly
jest.mock('react-query', () => ({
  ...jest.requireActual('react-query'),
  useQuery: jest.fn(),
  useQueryClient: jest.fn(() => ({
    invalidateQueries: jest.fn(),
  })),
}));

// Mock react-router-dom params
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ id: 'workshop-123' })
}));

const mockWorkshopWithCleanup: Workshop = {
  id: 'workshop-123',
  name: 'Test Workshop',
  description: 'Test Description',
  start_date: '2025-07-30T10:00:00Z',
  end_date: '2025-07-30T18:00:00Z',
  status: 'active',
  timezone: 'UTC',
  template: 'Generic',
  deletion_scheduled_at: '2025-07-30T19:00:00Z',
  created_at: '2025-07-30T09:00:00Z',
  updated_at: '2025-07-30T09:00:00Z'
};

const mockAttendees: Attendee[] = [
  { 
    id: 'attendee-1', 
    username: 'user1', 
    email: 'user1@example.com', 
    status: 'active',
    workshop_id: 'workshop-123',
    created_at: '2025-07-30T09:00:00Z',
    updated_at: '2025-07-30T09:00:00Z',
    deletion_scheduled_at: '2025-07-30T20:00:00Z'
  },
  { 
    id: 'attendee-2', 
    username: 'user2', 
    email: 'user2@example.com', 
    status: 'active',
    workshop_id: 'workshop-123',
    created_at: '2025-07-30T09:00:00Z',
    updated_at: '2025-07-30T09:00:00Z'
  }
];

const renderWorkshopDetail = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return render(
    <MemoryRouter initialEntries={['/workshops/workshop-123']}>
      <QueryClientProvider client={queryClient}>
        <WorkshopDetail />
      </QueryClientProvider>
    </MemoryRouter>
  );
};

describe('WorkshopDetail Cleanup Schedule Presentation', () => {
  const mockUseQuery = require('react-query').useQuery as jest.Mock;

  beforeEach(() => {
    // Mock useQuery to return our mock data
    mockUseQuery.mockImplementation((key: any) => {
      if (Array.isArray(key) && key[0] === 'workshop') {
        return {
          data: mockWorkshopWithCleanup,
          isLoading: false,
          error: null,
        };
      }
      if (Array.isArray(key) && key[0] === 'attendees') {
        return {
          data: mockAttendees,
          isLoading: false,
          error: null,
        };
      }
      if (Array.isArray(key) && key[0] === 'deploymentLogs') {
        return {
          data: [],
          isLoading: false,
          error: null,
        };
      }
      return {
        data: undefined,
        isLoading: false,
        error: null,
      };
    });
    
    // Clear console errors for clean test output
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('Improved Cleanup Schedule Presentation', () => {
    it('should use informational clock icon instead of warning triangle', async () => {
      renderWorkshopDetail();
      
      // Wait for workshop data to load
      await screen.findByText('Test Workshop');
      
      // Should show Cleanup Schedule section
      expect(screen.getByText('Cleanup Schedule')).toBeInTheDocument();
      
      // Should use ClockIcon class (not ExclamationTriangleIcon)
      const cleanupCard = screen.getByText('Cleanup Schedule').closest('.card');
      expect(cleanupCard).toBeInTheDocument();
      
      // Verify clock icon is present (look for Clock icon svg element)
      const clockIcon = cleanupCard?.querySelector('svg');
      expect(clockIcon).toBeInTheDocument();
    });

    it('should use blue informational colors instead of amber warning colors', async () => {
      renderWorkshopDetail();
      
      // Wait for workshop data to load
      await screen.findByText('Test Workshop');
      
      // Find the cleanup schedule card
      const cleanupScheduleText = screen.getByText('Cleanup Schedule');
      const cleanupCard = cleanupScheduleText.closest('.card');
      
      // Check that the icon uses blue color class (text-blue-500)
      const iconElement = cleanupCard?.querySelector('.text-blue-500');
      expect(iconElement).toBeInTheDocument();
      
      // Check that no amber/warning colors are used
      const amberElements = cleanupCard?.querySelectorAll('[class*="amber"]');
      expect(amberElements).toHaveLength(0);
    });

    it('should display deletion date with improved readability', async () => {
      renderWorkshopDetail();
      
      // Wait for workshop data to load
      await screen.findByText('Test Workshop');
      
      // Should show formatted deletion date
      expect(screen.getByText('Environment deletion')).toBeInTheDocument();
      
      // Find the date element and verify it uses readable text size
      const cleanupCard = screen.getByText('Cleanup Schedule').closest('.card');
      const dateElement = cleanupCard?.querySelector('.text-sm.font-medium.text-blue-600');
      expect(dateElement).toBeInTheDocument();
    });

    it('should provide edit functionality for cleanup schedule', async () => {
      renderWorkshopDetail();
      
      // Wait for workshop data to load
      await screen.findByText('Test Workshop');
      
      // Should show edit button for deletion date
      const editButton = screen.getByTitle('Edit deletion date');
      expect(editButton).toBeInTheDocument();
      expect(editButton).toHaveClass('text-blue-600', 'hover:text-blue-700');
    });

    it('should handle missing cleanup schedule gracefully', async () => {
      // Mock workshop without cleanup schedule
      const workshopWithoutCleanup = { ...mockWorkshopWithCleanup };
      delete workshopWithoutCleanup.deletion_scheduled_at;
      
      // Override the useQuery mock for this specific test
      mockUseQuery.mockImplementation((key: any) => {
        if (Array.isArray(key) && key[0] === 'workshop') {
          return {
            data: workshopWithoutCleanup,
            isLoading: false,
            error: null,
          };
        }
        if (Array.isArray(key) && key[0] === 'attendees') {
          return {
            data: mockAttendees,
            isLoading: false,
            error: null,
          };
        }
        if (Array.isArray(key) && key[0] === 'deploymentLogs') {
          return {
            data: [],
            isLoading: false,
            error: null,
          };
        }
        return {
          data: undefined,
          isLoading: false,
          error: null,
        };
      });
      
      renderWorkshopDetail();
      
      // Wait for workshop data to load
      await screen.findByText('Test Workshop');
      
      // Should show informational message instead of warning
      expect(screen.getByText('No automatic cleanup scheduled')).toBeInTheDocument();
      
      // Should provide option to set deletion date
      const setButton = screen.getByTitle('Set deletion date');
      expect(setButton).toBeInTheDocument();
    });
  });

  describe('Consistent Information Card Styling', () => {
    it('should maintain consistent card layout across all information cards', async () => {
      renderWorkshopDetail();
      
      // Wait for data to load
      await screen.findByText('Test Workshop');
      
      // All information cards should use the same structure
      const scheduleCard = screen.getByText('Schedule').closest('.card');
      const attendeesCard = screen.getByText('Attendees').closest('.card');
      const statusCard = screen.getByText('Status').closest('.card');
      const cleanupCard = screen.getByText('Cleanup Schedule').closest('.card');
      
      // All cards should have consistent structure
      [scheduleCard, attendeesCard, statusCard, cleanupCard].forEach(card => {
        expect(card).toHaveClass('card');
        expect(card?.querySelector('.card-body')).toBeInTheDocument();
      });
    });

    it('should use appropriate informational colors for each card type', async () => {
      renderWorkshopDetail();
      
      // Wait for data to load
      await screen.findByText('Test Workshop');
      
      // Schedule card should use primary color
      const scheduleCard = screen.getByText('Schedule').closest('.card');
      expect(scheduleCard?.querySelector('.text-primary-500')).toBeInTheDocument();
      
      // Attendees card should use success color
      const attendeesCard = screen.getByText('Attendees').closest('.card');
      expect(attendeesCard?.querySelector('.text-success-500')).toBeInTheDocument();
      
      // Cleanup card should use blue informational color (not warning amber)
      const cleanupCard = screen.getByText('Cleanup Schedule').closest('.card');
      expect(cleanupCard?.querySelector('.text-blue-500')).toBeInTheDocument();
    });
  });

  describe('Attendee Deletion Date Styling', () => {
    it('should display attendee deletion dates with informational styling instead of warning amber', async () => {
      renderWorkshopDetail();
      
      // Wait for workshop data to load
      await screen.findByText('Test Workshop');
      
      // Find the attendee with deletion scheduled
      const deletionText = screen.getByText(/Will be deleted on/);
      expect(deletionText).toBeInTheDocument();
      
      // Should use blue informational styling instead of amber warning
      expect(deletionText).toHaveClass('text-blue-600', 'dark:text-blue-400');
      expect(deletionText).not.toHaveClass('text-amber-600');
      expect(deletionText).not.toHaveClass('dark:text-amber-400');
    });

    it('should maintain readable text size for deletion dates', async () => {
      renderWorkshopDetail();
      
      // Wait for workshop data to load
      await screen.findByText('Test Workshop');
      
      // Find the attendee deletion date text
      const deletionText = screen.getByText(/Will be deleted on/);
      
      // Should use small text size for secondary information
      expect(deletionText).toHaveClass('text-xs');
    });
  });
});