import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { store } from '../store';
import Dashboard from '../pages/Dashboard';
import Settings from '../pages/Settings';
import WorkshopList from '../pages/WorkshopList';
import { workshopApi, settingsApi } from '../services/api';

// Mock APIs
jest.mock('../services/api');

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

describe('Dark Mode WCAG Contrast Compliance', () => {
  beforeEach(() => {
    // Add dark class to document element
    document.documentElement.classList.add('dark');
    
    // Mock API responses
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
    ]);

    (settingsApi.getLoginPrefixConfig as jest.Mock).mockResolvedValue({
      login_prefix: '',
      export_format: 'OVHcloud Login'
    });
  });
  
  afterEach(() => {
    document.documentElement.classList.remove('dark');
    jest.clearAllMocks();
  });

  describe('Dashboard Dark Mode Contrast', () => {
    it('should have sufficient contrast for primary headings', async () => {
      renderWithProviders(<Dashboard />);
      
      const mainHeading = await screen.findByText('Dashboard');
      
      // FAILING TEST: Main heading should use high contrast text
      expect(mainHeading).toHaveClass('dark:text-gray-100');
      
      // Should not use low contrast colors
      expect(mainHeading).not.toHaveClass('dark:text-gray-500');
      expect(mainHeading).not.toHaveClass('dark:text-gray-400');
    });

    it('should have sufficient contrast for secondary text', async () => {
      renderWithProviders(<Dashboard />);
      
      const subtitle = await screen.findByText('Workshop environment overview and statistics');
      
      // FAILING TEST: Subtitle should have adequate contrast
      expect(subtitle).toHaveClass('dark:text-gray-300');
      
      // Should not use very low contrast colors
      expect(subtitle).not.toHaveClass('dark:text-gray-500');
      expect(subtitle).not.toHaveClass('dark:text-gray-600');
    });

    it('should have high contrast for stat card values', async () => {
      renderWithProviders(<Dashboard />);
      
      await screen.findByText('Total Workshops');
      
      // Find stat card values (they should be numbers)
      const statElements = screen.getAllByText(/^\d+$/);
      
      statElements.forEach(element => {
        // FAILING TEST: Stat values should have maximum contrast
        expect(element).toHaveClass('dark:text-white');
      });
    });

    it('should have readable contrast for stat card labels', async () => {
      renderWithProviders(<Dashboard />);
      
      const totalWorkshopsLabel = await screen.findByText('Total Workshops');
      
      // FAILING TEST: Stat labels should have good contrast
      expect(totalWorkshopsLabel).toHaveClass('dark:text-gray-300');
    });
  });

  describe('Settings Dark Mode Contrast', () => {
    it('should have high contrast for form labels', async () => {
      renderWithProviders(<Settings />);
      
      const loginPrefixLabel = await screen.findByText('Login Prefix');
      
      // FAILING TEST: Form labels should have high contrast
      expect(loginPrefixLabel).toHaveClass('dark:text-gray-300');
    });

    it('should have readable contrast for help text', async () => {
      renderWithProviders(<Settings />);
      
      const helpText = await screen.findByText(/Prefix applied to all attendee usernames/);
      
      // FAILING TEST: Help text should be readable but less prominent
      expect(helpText).toHaveClass('dark:text-gray-400');
      
      // Should not be too low contrast
      expect(helpText).not.toHaveClass('dark:text-gray-600');
    });

    it('should have high contrast for input fields', async () => {
      renderWithProviders(<Settings />);
      
      const loginPrefixInput = await screen.findByLabelText('Login Prefix');
      
      // FAILING TEST: Input fields should have proper dark mode styling
      expect(loginPrefixInput).toHaveClass('dark:bg-slate-700');
      expect(loginPrefixInput).toHaveClass('dark:border-slate-600');
      expect(loginPrefixInput).toHaveClass('dark:text-gray-100');
    });
  });

  describe('WorkshopList Dark Mode Contrast', () => {
    it('should have high contrast for workshop titles', async () => {
      renderWithProviders(<WorkshopList />);
      
      const workshopTitle = await screen.findByText('Test Workshop');
      
      // FAILING TEST: Workshop titles should have maximum contrast
      expect(workshopTitle).toHaveClass('dark:text-gray-100');
    });

    it('should have readable contrast for workshop descriptions', async () => {
      renderWithProviders(<WorkshopList />);
      
      const workshopDescription = await screen.findByText('Test description');
      
      // FAILING TEST: Workshop descriptions should be readable
      expect(workshopDescription).toHaveClass('dark:text-gray-400');
    });

    it('should have adequate contrast for metadata text', async () => {
      renderWithProviders(<WorkshopList />);
      
      const attendeeText = await screen.findByText(/3\/5 attendees/);
      
      // FAILING TEST: Metadata should be readable
      expect(attendeeText).toHaveClass('dark:text-gray-400');
    });

    it('should have proper contrast for search input', async () => {
      renderWithProviders(<WorkshopList />);
      
      const searchInput = await screen.findByPlaceholderText('Search workshops...');
      
      // FAILING TEST: Search input should have dark mode styling
      expect(searchInput).toHaveClass('dark:bg-slate-700');
      expect(searchInput).toHaveClass('dark:text-gray-100');
      expect(searchInput).toHaveClass('dark:placeholder-gray-400');
    });
  });

  describe('Global Element Contrast Requirements', () => {
    it('should have consistent card backgrounds across all pages', async () => {
      // Test Dashboard cards
      const { unmount } = renderWithProviders(<Dashboard />);
      
      const dashboardCard = await screen.findByText('Total Workshops');
      const dashboardCardElement = dashboardCard.closest('.card');
      
      // FAILING TEST: All cards should have consistent dark backgrounds
      expect(dashboardCardElement).toHaveClass('dark:bg-slate-800');
      expect(dashboardCardElement).toHaveClass('dark:border-slate-600');
      
      unmount();
      
      // Test Settings cards
      renderWithProviders(<Settings />);
      
      const settingsCard = document.querySelector('.card');
      expect(settingsCard).toHaveClass('dark:bg-slate-800');
    });

    it('should have consistent button contrast across pages', async () => {
      renderWithProviders(<Dashboard />);
      
      const primaryButton = await screen.findByText('New Workshop');
      
      // FAILING TEST: Primary buttons should have enhanced dark mode styling
      expect(primaryButton).toHaveClass('dark:bg-primary-600');
      expect(primaryButton).toHaveClass('dark:hover:bg-primary-500');
      expect(primaryButton).toHaveClass('dark:focus:ring-primary-300');
    });

    it('should not use problematic color combinations', async () => {
      renderWithProviders(<Dashboard />);
      
      // Check for elements that might have poor contrast
      const allElements = document.querySelectorAll('*');
      
      Array.from(allElements).forEach(element => {
        const classes = element.className;
        
        // FAILING TEST: Should not have problematic color combinations
        if (typeof classes === 'string') {
          // Check for known bad combinations
          expect(classes).not.toMatch(/dark:text-gray-500.*dark:bg-gray-500/);
          expect(classes).not.toMatch(/dark:text-gray-600.*dark:bg-gray-700/);
          
          // Should not use very low contrast text on dark backgrounds
          if (classes.includes('dark:bg-slate-900')) {
            expect(classes).not.toMatch(/dark:text-gray-700/);
            expect(classes).not.toMatch(/dark:text-gray-600/);
          }
        }
      });
    });
  });

  describe('Interactive Element Contrast', () => {
    it('should have proper hover state contrast', async () => {
      renderWithProviders(<WorkshopList />);
      
      const workshopLink = await screen.findByText('Test Workshop');
      
      // FAILING TEST: Links should have proper hover states
      expect(workshopLink).toHaveClass('dark:hover:text-primary-400');
    });

    it('should have visible focus indicators', async () => {
      renderWithProviders(<Settings />);
      
      const saveButton = await screen.findByText('Save Settings');
      
      // FAILING TEST: Buttons should have visible focus rings
      expect(saveButton).toHaveClass('dark:focus:ring-4');
      expect(saveButton).toHaveClass('dark:focus:ring-primary-300');
    });
  });
});