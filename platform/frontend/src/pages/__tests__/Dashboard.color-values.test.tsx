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

describe('Dashboard Actual Color Values', () => {
  beforeEach(() => {
    // Add dark class to document element
    document.documentElement.classList.add('dark');
    
    // Mock empty API response to test empty state
    (workshopApi.getWorkshops as jest.Mock).mockResolvedValue([]);
  });
  
  afterEach(() => {
    document.documentElement.classList.remove('dark');
    jest.clearAllMocks();
  });

  it('should have CSS classes for high contrast empty state background', async () => {
    renderWithProviders(<Dashboard />);
    
    // Wait for empty state to load
    const emptyStateText = await screen.findByText('No workshops');
    const emptyStateContainer = emptyStateText.closest('.text-center');
    
    // Should have high contrast Tailwind classes applied
    expect(emptyStateContainer).toHaveClass('dark:bg-slate-800/50');
    expect(emptyStateContainer).toHaveClass('dark:border');
    expect(emptyStateContainer).toHaveClass('dark:border-slate-600');
    expect(emptyStateContainer).toHaveClass('dark:rounded-lg');
  });

  it('should have CSS classes for visible border and padding', async () => {
    renderWithProviders(<Dashboard />);
    
    // Wait for empty state to load
    const emptyStateText = await screen.findByText('No workshops');
    const emptyStateContainer = emptyStateText.closest('.text-center');
    
    // Should have visible border and padding classes
    expect(emptyStateContainer).toHaveClass('dark:border');
    expect(emptyStateContainer).toHaveClass('dark:border-slate-600');
    expect(emptyStateContainer).toHaveClass('dark:px-8');
    expect(emptyStateContainer).toHaveClass('dark:py-12');
    expect(emptyStateContainer).toHaveClass('dark:m-4');
  });

  it('should have card backgrounds with solid slate-800 not semi-transparent', async () => {
    // Mock non-empty response to test card backgrounds
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

    renderWithProviders(<Dashboard />);
    
    // Wait for data to load
    const totalWorkshopsCard = await screen.findByText('Total Workshops');
    const card = totalWorkshopsCard.closest('.card');
    
    // Should have solid background, not semi-transparent
    expect(card).toHaveClass('dark:bg-slate-800');
    expect(card).toHaveClass('dark:border-slate-600');
    expect(card).toHaveClass('dark:border-2');
  });

  it('should have text with proper contrast classes for readability', async () => {
    renderWithProviders(<Dashboard />);
    
    // Wait for empty state to load
    const titleText = await screen.findByText('No workshops');
    const descriptionText = await screen.findByText('Get started by creating a new workshop.');
    
    // Title should be near-white for maximum readability
    expect(titleText).toHaveClass('dark:text-gray-100');
    
    // Description should be light gray for good readability
    expect(descriptionText).toHaveClass('dark:text-gray-300');
  });

  it('should have main dashboard container with proper dark background', async () => {
    renderWithProviders(<Dashboard />);
    
    // Wait for data to load
    await screen.findByText('Dashboard');
    
    // Check the main dashboard container background
    const mainContent = screen.getByText('Dashboard').closest('.animate-fade-in');
    
    // Should have very dark background for contrast hierarchy
    expect(mainContent).toHaveClass('dark:bg-slate-900');
    expect(mainContent).toHaveClass('dark:border');
    expect(mainContent).toHaveClass('dark:border-slate-700');
    expect(mainContent).toHaveClass('dark:shadow-2xl');
  });

  it('should have icon with visible color classes not faded', async () => {
    renderWithProviders(<Dashboard />);
    
    // Wait for empty state to load
    const icon = await screen.findByTestId('empty-state-icon');
    
    // Should have visible color classes, not faded gray
    expect(icon).toHaveClass('dark:text-gray-300');
    expect(icon).toHaveClass('dark:drop-shadow-lg');
  });

  it('should verify CSS override classes prevent transparency issues', async () => {
    renderWithProviders(<Dashboard />);
    
    // Wait for empty state to load
    const emptyStateText = await screen.findByText('No workshops');
    const emptyStateContainer = emptyStateText.closest('.text-center');
    
    // The container should have the text-center class which is targeted by our CSS
    // to override any semi-transparent backgrounds
    expect(emptyStateContainer).toHaveClass('text-center');
    
    // Verify this is the empty state and not just any text-center element
    const icon = emptyStateContainer?.querySelector('[data-testid="empty-state-icon"]');
    expect(icon).toBeInTheDocument();
  });
});