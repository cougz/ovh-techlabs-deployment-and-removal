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

describe('Dashboard Visible Dark Mode Changes', () => {
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

  it('should have visibly distinct card backgrounds in dark mode', async () => {
    renderWithProviders(<Dashboard />);
    
    // Wait for data to load
    const totalWorkshopsCard = await screen.findByText('Total Workshops');
    const card = totalWorkshopsCard.closest('.card');
    
    expect(card).toBeInTheDocument();
    
    // The card should have visible dark styling that's significantly different from light mode
    expect(card).toHaveClass('dark:bg-slate-800');
    expect(card).toHaveClass('dark:border-slate-600');
    expect(card).toHaveClass('dark:border-2');
  });

  it('should have highly readable text in dark mode with strong contrast', async () => {
    renderWithProviders(<Dashboard />);
    
    // Wait for subtitle text
    const subtitle = await screen.findByText('Workshop environment overview and statistics');
    
    // Text should be clearly visible in dark mode
    expect(subtitle).toHaveClass('dark:text-gray-300');
    
    // Check stat card labels for strong contrast
    const statLabel = await screen.findByText('Total Workshops');
    expect(statLabel).toHaveClass('dark:text-gray-300');
  });

  it('should have clearly visible empty state box in dark mode', async () => {
    // Mock empty response
    (workshopApi.getWorkshops as jest.Mock).mockResolvedValue([]);
    
    renderWithProviders(<Dashboard />);
    
    const emptyStateText = await screen.findByText('No workshops');
    const emptyStateContainer = emptyStateText.closest('div');
    
    // Empty state should be highly visible
    expect(emptyStateContainer?.parentElement).toHaveClass('dark:bg-slate-800');
    expect(emptyStateContainer?.parentElement).toHaveClass('dark:border-slate-600');
    expect(emptyStateContainer?.parentElement).toHaveClass('dark:border-2');
  });

  it('should have prominent section headers in dark mode', async () => {
    renderWithProviders(<Dashboard />);
    
    const recentWorkshopsHeader = await screen.findByText('Recent Workshops');
    const headerContainer = recentWorkshopsHeader.closest('.card-header');
    
    // Section header should be prominently styled
    expect(headerContainer).toHaveClass('dark:bg-slate-700');
    expect(headerContainer).toHaveClass('dark:border-b-2');
    expect(headerContainer).toHaveClass('dark:border-slate-600');
  });

  it('should have enhanced button styling with visible focus states', async () => {
    renderWithProviders(<Dashboard />);
    
    const newWorkshopButton = await screen.findByText('New Workshop');
    
    // Button should have prominent dark mode styling
    expect(newWorkshopButton).toHaveClass('dark:bg-primary-600');
    expect(newWorkshopButton).toHaveClass('dark:hover:bg-primary-500');
    expect(newWorkshopButton).toHaveClass('dark:border-primary-500');
    expect(newWorkshopButton).toHaveClass('dark:shadow-lg');
    expect(newWorkshopButton).toHaveClass('dark:focus:ring-4');
    expect(newWorkshopButton).toHaveClass('dark:focus:ring-primary-300');
  });

  it('should have strong visual separation between main sections', async () => {
    renderWithProviders(<Dashboard />);
    
    // Wait for data to load
    await screen.findByText('Dashboard');
    
    // Main content should have distinct background
    const mainContent = screen.getByText('Dashboard').closest('.animate-fade-in');
    expect(mainContent).toHaveClass('dark:bg-slate-900');
    expect(mainContent).toHaveClass('dark:border');
    expect(mainContent).toHaveClass('dark:border-slate-700');
    expect(mainContent).toHaveClass('dark:shadow-2xl');
    
    // Header section should have clear separator
    const headerSection = screen.getByText('Dashboard').closest('.mb-8');
    expect(headerSection).toHaveClass('dark:border-b-2');
    expect(headerSection).toHaveClass('dark:border-slate-600');
  });

  it('should have text with high contrast ratios meeting WCAG AA standards', async () => {
    renderWithProviders(<Dashboard />);
    
    // Dashboard title should be highly visible
    const title = await screen.findByText('Dashboard');
    expect(title).toHaveClass('dark:text-gray-100');
    
    // Description should be readable
    const description = await screen.findByText('Workshop environment overview and statistics');
    expect(description).toHaveClass('dark:text-gray-300');
    
    // Numbers in stat cards should be prominent
    const statLabels = await screen.findAllByText(/Total|Active|Attendees/);
    statLabels.forEach(label => {
      const card = label.closest('.card');
      const numberElement = card?.querySelector('dd');
      if (numberElement) {
        expect(numberElement).toHaveClass('dark:text-white');
      }
    });
  });
});