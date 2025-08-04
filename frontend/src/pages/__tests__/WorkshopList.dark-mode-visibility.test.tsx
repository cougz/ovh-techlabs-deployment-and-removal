import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { store } from '../../store';
import WorkshopList from '../WorkshopList';
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

describe('WorkshopList Dark Mode Text Visibility', () => {
  beforeEach(() => {
    // Add dark class to document element
    document.documentElement.classList.add('dark');
    
    // Mock API response with test data
    (workshopApi.getWorkshops as jest.Mock).mockResolvedValue([
      {
        id: '1',
        name: 'Test Workshop',
        description: 'Test description',
        status: 'active',
        attendee_count: 5,
        active_attendees: 3,
        start_date: '2023-12-01T10:00:00Z',
        end_date: '2023-12-01T18:00:00Z',
      },
      {
        id: '2',
        name: 'Planning Workshop',
        description: 'Another workshop',
        status: 'planning',
        attendee_count: 10,
        active_attendees: 0,
        start_date: '2023-12-15T09:00:00Z',
        end_date: '2023-12-15T17:00:00Z',
      },
    ]);
  });
  
  afterEach(() => {
    document.documentElement.classList.remove('dark');
    jest.clearAllMocks();
  });

  it('should have proper text contrast in main header in dark mode', async () => {
    renderWithProviders(<WorkshopList />);
    
    const title = await screen.findByText('Workshops');
    const subtitle = await screen.findByText('Manage all workshop environments');
    
    // FAILING TEST: Headers should have dark mode text colors
    expect(title).toHaveClass('dark:text-gray-100');
    expect(subtitle).toHaveClass('dark:text-gray-300');
  });

  it('should have visible search input in dark mode', async () => {
    renderWithProviders(<WorkshopList />);
    
    const searchInput = await screen.findByPlaceholderText('Search workshops...');
    
    // FAILING TEST: Search input should have dark mode styling
    expect(searchInput).toHaveClass('dark:bg-slate-700');
    expect(searchInput).toHaveClass('dark:border-slate-600');
    expect(searchInput).toHaveClass('dark:text-gray-100');
    expect(searchInput).toHaveClass('dark:placeholder-gray-400');
  });

  it('should have visible filter select in dark mode', async () => {
    renderWithProviders(<WorkshopList />);
    
    const filterSelect = await screen.findByDisplayValue('All Status');
    
    // FAILING TEST: Filter select should have dark mode styling
    expect(filterSelect).toHaveClass('dark:bg-slate-700');
    expect(filterSelect).toHaveClass('dark:border-slate-600');
    expect(filterSelect).toHaveClass('dark:text-gray-100');
  });

  it('should have proper workshop card styling in dark mode', async () => {
    renderWithProviders(<WorkshopList />);
    
    const workshopCard = await screen.findByText('Test Workshop');
    const card = workshopCard.closest('.card');
    
    // FAILING TEST: Workshop cards should have enhanced dark mode styling
    expect(card).toHaveClass('dark:bg-slate-800');
    expect(card).toHaveClass('dark:border-slate-600');
    expect(card).toHaveClass('dark:border-2');
  });

  it('should have visible workshop details text in dark mode', async () => {
    renderWithProviders(<WorkshopList />);
    
    const workshopTitle = await screen.findByText('Test Workshop');
    const workshopDescription = await screen.findByText('Test description');
    
    // FAILING TEST: Workshop content should have proper contrast
    expect(workshopTitle).toHaveClass('dark:text-gray-100');
    expect(workshopDescription).toHaveClass('dark:text-gray-400');
  });

  it('should have visible attendee information in dark mode', async () => {
    renderWithProviders(<WorkshopList />);
    
    // Wait for workshop data to load
    await screen.findByText('Test Workshop');
    
    const attendeeInfo = screen.getByText(/3\/5 attendees/);
    
    // FAILING TEST: Attendee info should be visible
    expect(attendeeInfo).toHaveClass('dark:text-gray-400');
  });

  it('should have visible dropdown menu in dark mode', async () => {
    renderWithProviders(<WorkshopList />);
    
    // Wait for workshops to load
    await screen.findByText('Test Workshop');
    
    // Find and click the dropdown button
    const dropdownButtons = screen.getAllByRole('button');
    const actionButton = dropdownButtons.find(btn => 
      btn.querySelector('svg') && btn.getAttribute('class')?.includes('text-gray-400')
    );
    
    expect(actionButton).toBeTruthy();
    
    if (actionButton) {
      fireEvent.click(actionButton);
      
      // Wait for dropdown to open
      await waitFor(() => {
        const deployButton = screen.queryByText('Deploy Workshop');
        if (deployButton) {
          // FAILING TEST: Dropdown items should have dark mode styling
          expect(deployButton).toHaveClass('dark:text-gray-200');
          expect(deployButton).toHaveClass('dark:hover:bg-gray-700');
        }
      });
    }
  });

  it('should have visible empty state in dark mode', async () => {
    // Mock empty response
    (workshopApi.getWorkshops as jest.Mock).mockResolvedValue([]);
    
    renderWithProviders(<WorkshopList />);
    
    const emptyStateText = await screen.findByText('No workshops');
    const emptyStateSubtext = await screen.findByText('Get started by creating a new workshop.');
    
    // FAILING TEST: Empty state should be properly visible in dark mode
    expect(emptyStateText).toHaveClass('dark:text-gray-100');
    expect(emptyStateSubtext).toHaveClass('dark:text-gray-300');
    
    const emptyStateContainer = emptyStateText.closest('.card');
    expect(emptyStateContainer).toHaveClass('dark:bg-slate-800');
    expect(emptyStateContainer).toHaveClass('dark:border-slate-600');
  });

  it('should have visible error state in dark mode', async () => {
    // Mock error response
    (workshopApi.getWorkshops as jest.Mock).mockRejectedValue(new Error('API Error'));
    
    renderWithProviders(<WorkshopList />);
    
    const errorTitle = await screen.findByText('Error loading workshops');
    const errorSubtext = await screen.findByText('There was a problem loading the workshop data.');
    
    // FAILING TEST: Error state should be properly visible in dark mode
    expect(errorTitle).toHaveClass('dark:text-gray-100');
    expect(errorSubtext).toHaveClass('dark:text-gray-300');
  });

  it('should not have layout shifts when toggling dark mode', async () => {
    const { rerender } = renderWithProviders(<WorkshopList />);
    
    // Wait for initial render
    await screen.findByText('Test Workshop');
    
    // Get initial card positions
    const cards = screen.getAllByTestId(/workshop-card|card/i) || 
                 document.querySelectorAll('.card');
    
    const initialPositions = Array.from(cards).map(card => ({
      top: card.getBoundingClientRect().top,
      left: card.getBoundingClientRect().left,
      width: card.getBoundingClientRect().width,
      height: card.getBoundingClientRect().height,
    }));
    
    // Toggle to light mode
    document.documentElement.classList.remove('dark');
    
    // Re-render with light mode
    rerender(
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <WorkshopList />
          </BrowserRouter>
        </QueryClientProvider>
      </Provider>
    );
    
    // Wait for re-render
    await screen.findByText('Test Workshop');
    
    // Check positions haven't changed
    const finalPositions = Array.from(cards).map(card => ({
      top: card.getBoundingClientRect().top,
      left: card.getBoundingClientRect().left,
      width: card.getBoundingClientRect().width,
      height: card.getBoundingClientRect().height,
    }));
    
    // FAILING TEST: Positions should remain stable during theme toggle
    initialPositions.forEach((initialPos, index) => {
      const finalPos = finalPositions[index];
      if (finalPos) {
        expect(Math.abs(finalPos.top - initialPos.top)).toBeLessThan(2);
        expect(Math.abs(finalPos.left - initialPos.left)).toBeLessThan(2);
        expect(Math.abs(finalPos.width - initialPos.width)).toBeLessThan(2);
        expect(Math.abs(finalPos.height - initialPos.height)).toBeLessThan(2);
      }
    });
  });

  it('should have proper WCAG contrast ratios in dark mode', async () => {
    renderWithProviders(<WorkshopList />);
    
    const title = await screen.findByText('Test Workshop');
    const computedStyle = window.getComputedStyle(title);
    
    // FAILING TEST: Should meet WCAG AA contrast requirements
    // Note: This is a simplified test - in real scenarios you'd use tools like axe-core
    expect(computedStyle.color).not.toBe('rgb(128, 128, 128)'); // Should not be gray-500
    expect(title).toHaveClass('dark:text-gray-100'); // Should be light enough for dark background
  });
});