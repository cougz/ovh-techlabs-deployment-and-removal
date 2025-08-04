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

describe('Dashboard Empty State Visibility', () => {
  beforeEach(() => {
    // Add dark class to document element
    document.documentElement.classList.add('dark');
    
    // Mock empty API response
    (workshopApi.getWorkshops as jest.Mock).mockResolvedValue([]);
  });
  
  afterEach(() => {
    document.documentElement.classList.remove('dark');
    jest.clearAllMocks();
  });

  it('should have highly visible empty state icon in dark mode', async () => {
    renderWithProviders(<Dashboard />);
    
    // Wait for empty state to load
    const emptyStateIcon = await screen.findByTestId('empty-state-icon');
    
    // Icon should be visible in dark mode with proper contrast
    expect(emptyStateIcon).toHaveClass('dark:text-gray-300');
    expect(emptyStateIcon).toHaveClass('dark:drop-shadow-lg');
  });

  it('should have prominent empty state text in dark mode', async () => {
    renderWithProviders(<Dashboard />);
    
    // Wait for empty state to load
    const emptyStateTitle = await screen.findByText('No workshops');
    const emptyStateDescription = await screen.findByText('Get started by creating a new workshop.');
    
    // Title should be highly visible
    expect(emptyStateTitle).toHaveClass('dark:text-gray-100');
    
    // Description should be readable with good contrast
    expect(emptyStateDescription).toHaveClass('dark:text-gray-300');
  });

  it('should have visible empty state container with clear boundaries', async () => {
    renderWithProviders(<Dashboard />);
    
    // Wait for empty state to load
    const emptyStateText = await screen.findByText('No workshops');
    const emptyStateContainer = emptyStateText.closest('.text-center');
    
    // Container should have visible background and border
    expect(emptyStateContainer).toHaveClass('dark:bg-slate-800/50');
    expect(emptyStateContainer).toHaveClass('dark:border');
    expect(emptyStateContainer).toHaveClass('dark:border-slate-600');
    expect(emptyStateContainer).toHaveClass('dark:rounded-lg');
    expect(emptyStateContainer).toHaveClass('dark:shadow-inner');
  });

  it('should have enhanced button styling in empty state', async () => {
    renderWithProviders(<Dashboard />);
    
    // Wait for empty state to load
    const emptyStateText = await screen.findByText('No workshops');
    const emptyStateContainer = emptyStateText.closest('.text-center');
    const createButton = emptyStateContainer?.querySelector('a[href="/workshops/new"]');
    
    // Button should have enhanced styling for better visibility
    expect(createButton).toHaveClass('dark:bg-primary-600');
    expect(createButton).toHaveClass('dark:hover:bg-primary-500');
    expect(createButton).toHaveClass('dark:border-primary-500');
    expect(createButton).toHaveClass('dark:shadow-lg');
    expect(createButton).toHaveClass('dark:focus:ring-4');
    expect(createButton).toHaveClass('dark:focus:ring-primary-300');
  });

  it('should have proper spacing and padding in empty state', async () => {
    renderWithProviders(<Dashboard />);
    
    // Wait for empty state to load
    const emptyStateText = await screen.findByText('No workshops');
    const emptyStateContainer = emptyStateText.closest('.text-center');
    
    // Container should have enhanced padding for better visual presence
    expect(emptyStateContainer).toHaveClass('dark:px-8');
    expect(emptyStateContainer).toHaveClass('dark:py-12');
    expect(emptyStateContainer).toHaveClass('dark:m-4');
  });

  it('should have card body with proper background when empty', async () => {
    renderWithProviders(<Dashboard />);
    
    // Wait for empty state to load
    const emptyStateText = await screen.findByText('No workshops');
    const cardBody = emptyStateText.closest('.card-body');
    
    // Card body should have visible background styling
    expect(cardBody).toHaveClass('dark:bg-slate-800');
    expect(cardBody).toHaveClass('dark:border-slate-600');
    expect(cardBody).toHaveClass('dark:border-2');
  });

  it('should have consistent visual hierarchy in empty state', async () => {
    renderWithProviders(<Dashboard />);
    
    // Wait for empty state to load
    const icon = await screen.findByTestId('empty-state-icon');
    const title = await screen.findByText('No workshops');
    const description = await screen.findByText('Get started by creating a new workshop.');
    
    // Visual hierarchy should be clear
    expect(icon).toHaveClass('dark:text-gray-300'); // Icon should be visible
    expect(title).toHaveClass('dark:text-gray-100'); // Title should be prominent
    expect(description).toHaveClass('dark:text-gray-300'); // Description should be readable
  });
});