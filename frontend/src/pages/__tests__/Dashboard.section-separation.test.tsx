import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { store } from '../../store';
import Dashboard from '../Dashboard';
import { workshopApi } from '../../services/api';

// Mock the API
jest.mock('../../services/api');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          {ui}
        </BrowserRouter>
      </QueryClientProvider>
    </Provider>
  );
};

describe('Dashboard Section Separation', () => {
  beforeEach(() => {
    // Add dark class to document element
    document.documentElement.classList.add('dark');
    
    // Mock API response
    (workshopApi.getWorkshops as jest.Mock).mockResolvedValue([
      {
        id: '1',
        name: 'Test Workshop',
        status: 'active',
        attendee_count: 5,
        active_attendees: 3,
        start_date: '2024-01-01',
      },
    ]);
  });
  
  afterEach(() => {
    document.documentElement.classList.remove('dark');
    jest.clearAllMocks();
  });

  it('should have clear visual separation between stats and recent workshops sections', async () => {
    renderWithProviders(<Dashboard />);
    
    // Wait for data to load
    await screen.findByText('Total Workshops');
    
    // Find the stats section
    const statsSection = screen.getByText('Total Workshops').closest('.grid');
    
    // Find the recent workshops section
    const recentWorkshopsSection = await screen.findByText('Recent Workshops');
    const recentWorkshopsCard = recentWorkshopsSection.closest('.card');
    
    // Stats section should have proper spacing
    expect(statsSection).toHaveClass('mb-12');
    
    // Recent workshops card should have enhanced dark mode styling for better separation
    expect(recentWorkshopsCard).toHaveClass('dark:bg-slate-800');
    expect(recentWorkshopsCard).toHaveClass('dark:border-slate-600');
    expect(recentWorkshopsCard).toHaveClass('dark:border-2');
  });

  it('should have visual divider between header and dashboard content', async () => {
    renderWithProviders(<Dashboard />);
    
    // Wait for data to load
    await screen.findByText('Dashboard');
    
    // Find the header section
    const headerSection = screen.getByText('Dashboard').closest('.mb-8');
    
    // Header section should have proper spacing and divider styling
    expect(headerSection).toHaveClass('mb-8');
    expect(headerSection).toHaveClass('dark:border-b-2');
    expect(headerSection).toHaveClass('dark:border-slate-600');
    expect(headerSection).toHaveClass('dark:pb-8');
  });

  it('should have proper background contrast for main content area', async () => {
    renderWithProviders(<Dashboard />);
    
    // Wait for data to load
    await screen.findByText('Dashboard');
    
    // Find the main content container
    const mainContent = screen.getByText('Dashboard').closest('.animate-fade-in');
    
    // Main content should have subtle background for better section separation
    expect(mainContent).toHaveClass('dark:bg-slate-900');
    expect(mainContent).toHaveClass('dark:border');
    expect(mainContent).toHaveClass('dark:border-slate-700');
    expect(mainContent).toHaveClass('dark:shadow-2xl');
    expect(mainContent).toHaveClass('dark:p-6');
    expect(mainContent).toHaveClass('dark:rounded-lg');
  });

  it('should have enhanced spacing between stat cards and recent workshops', async () => {
    renderWithProviders(<Dashboard />);
    
    // Wait for data to load
    await screen.findByText('Total Workshops');
    
    // Find the stats grid
    const statsGrid = screen.getByText('Total Workshops').closest('.grid');
    
    // Stats grid should have enhanced bottom margin for better section separation
    expect(statsGrid).toHaveClass('mb-12');
  });

  it('should have proper section dividers in dark mode', async () => {
    renderWithProviders(<Dashboard />);
    
    // Wait for data to load
    await screen.findByText('Dashboard');
    
    // Find elements that should have section dividers
    const headerSection = screen.getByText('Dashboard').closest('.mb-8');
    const recentWorkshopsCard = await screen.findByText('Recent Workshops');
    const cardElement = recentWorkshopsCard.closest('.card');
    
    // Check for section dividers
    expect(headerSection).toHaveClass('dark:border-b-2');
    expect(cardElement).toHaveClass('dark:mt-4');
    expect(cardElement).toHaveClass('dark:shadow-lg');
  });
});