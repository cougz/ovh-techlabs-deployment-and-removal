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

describe('Dashboard Dark Mode Styling', () => {
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
      },
    ]);
  });
  
  afterEach(() => {
    document.documentElement.classList.remove('dark');
    jest.clearAllMocks();
  });

  it('should apply enhanced dark mode styles to stat cards', async () => {
    renderWithProviders(<Dashboard />);
    
    // Wait for data to load
    const totalWorkshopsCard = await screen.findByText('Total Workshops');
    const card = totalWorkshopsCard.closest('.card');
    
    expect(card).toBeInTheDocument();
    
    // Check if card has the enhanced dark mode styling
    const computedStyles = window.getComputedStyle(card!);
    
    // The card should have a lighter background than pure black for better contrast
    expect(card).toHaveClass('dark:bg-slate-800');
    expect(card).toHaveClass('dark:border-slate-600');
    expect(card).toHaveClass('dark:border-2');
  });

  it('should have proper text contrast in dark mode', async () => {
    renderWithProviders(<Dashboard />);
    
    // Wait for subtitle text
    const subtitle = await screen.findByText('Workshop environment overview and statistics');
    
    // Check if secondary text has improved contrast
    expect(subtitle).toHaveClass('dark:text-gray-300');
    
    // Check stat card labels
    const statLabel = await screen.findByText('Total Workshops');
    expect(statLabel).toHaveClass('dark:text-gray-300');
  });

  it('should have visible empty state in dark mode', async () => {
    // Mock empty response
    (workshopApi.getWorkshops as jest.Mock).mockResolvedValue([]);
    
    renderWithProviders(<Dashboard />);
    
    const emptyStateText = await screen.findByText('No workshops');
    const emptyStateContainer = emptyStateText.closest('div');
    
    // Empty state should have visible styling
    expect(emptyStateContainer?.parentElement).toHaveClass('dark:bg-slate-800');
    expect(emptyStateContainer?.parentElement).toHaveClass('dark:border-slate-600');
    expect(emptyStateContainer?.parentElement).toHaveClass('dark:border-2');
  });

  it('should have proper section separation in dark mode', async () => {
    renderWithProviders(<Dashboard />);
    
    const recentWorkshopsHeader = await screen.findByText('Recent Workshops');
    const headerContainer = recentWorkshopsHeader.closest('.card-header');
    
    // Section header should have distinct styling
    expect(headerContainer).toHaveClass('dark:bg-slate-700');
    expect(headerContainer).toHaveClass('dark:border-b-2');
    expect(headerContainer).toHaveClass('dark:border-slate-600');
  });

  it('should have enhanced button hover states in dark mode', async () => {
    renderWithProviders(<Dashboard />);
    
    const newWorkshopButton = await screen.findByText('New Workshop');
    
    // Button should have enhanced dark mode hover styles
    expect(newWorkshopButton).toHaveClass('dark:bg-primary-600');
    expect(newWorkshopButton).toHaveClass('dark:hover:bg-primary-500');
    expect(newWorkshopButton).toHaveClass('dark:border-primary-500');
    expect(newWorkshopButton).toHaveClass('dark:shadow-lg');
    expect(newWorkshopButton).toHaveClass('dark:focus:ring-4');
    expect(newWorkshopButton).toHaveClass('dark:focus:ring-primary-300');
  });
});