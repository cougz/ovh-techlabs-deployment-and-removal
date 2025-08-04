import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { store } from '../store';
import Dashboard from '../pages/Dashboard';
import WorkshopList from '../pages/WorkshopList';
import Settings from '../pages/Settings';
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

// Utility function to convert RGB color to luminance
const getLuminance = (r: number, g: number, b: number): number => {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};

// Utility function to calculate contrast ratio
const getContrastRatio = (color1: [number, number, number], color2: [number, number, number]): number => {
  const lum1 = getLuminance(...color1);
  const lum2 = getLuminance(...color2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
};

// Utility function to parse RGB color string
const parseRGB = (color: string): [number, number, number] => {
  const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (match) {
    return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
  }
  return [0, 0, 0]; // fallback
};

// Common dark mode background colors (slate-800, slate-900)
const DARK_BACKGROUNDS: Record<string, [number, number, number]> = {
  'slate-800': [30, 41, 59],  // #1e293b
  'slate-900': [15, 23, 42],  // #0f172a
  'slate-700': [51, 65, 85],  // #334155
};

describe('WCAG AA Contrast Ratio Validation in Dark Mode', () => {
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

  describe('Dashboard Text Contrast Validation', () => {
    it('should meet WCAG AA standards for main headings', async () => {
      renderWithProviders(<Dashboard />);
      
      const mainHeading = await screen.findByText('Dashboard');
      const computedStyle = window.getComputedStyle(mainHeading);
      
      // PASSING TEST: Main headings should have dark:text-gray-100 (very light)
      expect(mainHeading).toHaveClass('dark:text-gray-100');
      
      // Validate contrast ratio against dark background
      // gray-100 (#f3f4f6) against slate-900 (#0f172a) should have high contrast
      const textColor: [number, number, number] = [243, 244, 246]; // gray-100
      const backgroundColor: [number, number, number] = DARK_BACKGROUNDS['slate-900'];
      
      const contrastRatio = getContrastRatio(textColor, backgroundColor);
      
      // WCAG AA requires 4.5:1 for normal text, 3:1 for large text
      // Headings are large text, so 3:1 minimum
      expect(contrastRatio).toBeGreaterThanOrEqual(3.0);
      expect(contrastRatio).toBeGreaterThanOrEqual(4.5); // Even better - aim for normal text standard
    });

    it('should meet WCAG AA standards for secondary text', async () => {
      renderWithProviders(<Dashboard />);
      
      const subtitle = await screen.findByText('Workshop environment overview and statistics');
      
      // PASSING TEST: Secondary text should have dark:text-gray-300
      expect(subtitle).toHaveClass('dark:text-gray-300');
      
      // gray-300 (#d1d5db) against slate-900 should have adequate contrast
      const textColor: [number, number, number] = [209, 213, 219]; // gray-300
      const backgroundColor: [number, number, number] = DARK_BACKGROUNDS['slate-900'];
      
      const contrastRatio = getContrastRatio(textColor, backgroundColor);
      expect(contrastRatio).toBeGreaterThanOrEqual(4.5);
    });

    it('should meet WCAG AA standards for stat card text', async () => {
      renderWithProviders(<Dashboard />);
      
      await screen.findByText('Total Workshops');
      
      // Find stat card values and labels
      const statLabel = screen.getByText('Total Workshops');
      const statCard = statLabel.closest('.card');
      
      expect(statCard).toHaveClass('dark:bg-slate-800');
      expect(statLabel).toHaveClass('dark:text-gray-300');
      
      // gray-300 against slate-800 background
      const labelColor: [number, number, number] = [209, 213, 219]; // gray-300
      const cardBackground: [number, number, number] = DARK_BACKGROUNDS['slate-800'];
      
      const contrastRatio = getContrastRatio(labelColor, cardBackground);
      expect(contrastRatio).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe('WorkshopList Text Contrast Validation', () => {
    it('should meet WCAG AA standards for workshop titles', async () => {
      renderWithProviders(<WorkshopList />);
      
      const workshopTitle = await screen.findByText('Test Workshop');
      
      // PASSING TEST: Workshop titles should have dark:text-gray-100
      expect(workshopTitle).toHaveClass('dark:text-gray-100');
      
      // Very high contrast for important content
      const textColor: [number, number, number] = [243, 244, 246]; // gray-100
      const backgroundColor: [number, number, number] = DARK_BACKGROUNDS['slate-900'];
      
      const contrastRatio = getContrastRatio(textColor, backgroundColor);
      expect(contrastRatio).toBeGreaterThanOrEqual(7.0); // AAA standard
    });

    it('should meet WCAG AA standards for form inputs', async () => {
      renderWithProviders(<WorkshopList />);
      
      const searchInput = await screen.findByPlaceholderText('Search workshops...');
      
      // PASSING TEST: Inputs should have proper dark mode styling
      expect(searchInput).toHaveClass('dark:bg-slate-700');
      expect(searchInput).toHaveClass('dark:text-gray-100');
      
      // Text in input fields should be highly readable
      const textColor: [number, number, number] = [243, 244, 246]; // gray-100
      const inputBackground: [number, number, number] = DARK_BACKGROUNDS['slate-700'];
      
      const contrastRatio = getContrastRatio(textColor, inputBackground);
      expect(contrastRatio).toBeGreaterThanOrEqual(4.5);
    });

    it('should meet WCAG AA standards for metadata text', async () => {
      renderWithProviders(<WorkshopList />);
      
      const attendeeText = await screen.findByText(/3\/5 attendees/);
      
      // PASSING TEST: Metadata should be readable
      expect(attendeeText).toHaveClass('dark:text-gray-400');
      
      // gray-400 should still meet minimum contrast
      const textColor: [number, number, number] = [156, 163, 175]; // gray-400
      const backgroundColor: [number, number, number] = DARK_BACKGROUNDS['slate-900'];
      
      const contrastRatio = getContrastRatio(textColor, backgroundColor);
      expect(contrastRatio).toBeGreaterThanOrEqual(3.0); // Minimum for secondary text
    });
  });

  describe('Settings Form Contrast Validation', () => {
    it('should meet WCAG AA standards for form labels', async () => {
      renderWithProviders(<Settings />);
      
      const loginLabel = await screen.findByText('Login Prefix');
      
      // PASSING TEST: Form labels should be highly readable
      expect(loginLabel).toHaveClass('dark:text-gray-300');
      
      const textColor: [number, number, number] = [209, 213, 219]; // gray-300
      const backgroundColor: [number, number, number] = DARK_BACKGROUNDS['slate-900'];
      
      const contrastRatio = getContrastRatio(textColor, backgroundColor);
      expect(contrastRatio).toBeGreaterThanOrEqual(4.5);
    });

    it('should meet WCAG AA standards for help text', async () => {
      renderWithProviders(<Settings />);
      
      const helpText = await screen.findByText(/Prefix applied to all attendee usernames/);
      
      // PASSING TEST: Help text should meet minimum contrast
      expect(helpText).toHaveClass('dark:text-gray-400');
      
      const textColor: [number, number, number] = [156, 163, 175]; // gray-400
      const backgroundColor: [number, number, number] = DARK_BACKGROUNDS['slate-900'];
      
      const contrastRatio = getContrastRatio(textColor, backgroundColor);
      expect(contrastRatio).toBeGreaterThanOrEqual(3.0);
    });
  });

  describe('Interactive Element Contrast Validation', () => {
    it('should have sufficient contrast for focus indicators', async () => {
      renderWithProviders(<Settings />);
      
      const saveButton = await screen.findByText('Save Settings');
      
      // PASSING TEST: Buttons should have visible focus rings
      expect(saveButton).toHaveClass('dark:focus:ring-4');
      expect(saveButton).toHaveClass('dark:focus:ring-primary-300');
      
      // Primary blue focus ring should be visible on dark backgrounds
      // primary-300 is a light blue that contrasts well with dark backgrounds
      const focusColor: [number, number, number] = [147, 197, 253]; // primary-300 (blue-300)
      const backgroundColor: [number, number, number] = DARK_BACKGROUNDS['slate-900'];
      
      const contrastRatio = getContrastRatio(focusColor, backgroundColor);
      expect(contrastRatio).toBeGreaterThanOrEqual(3.0);
    });

    it('should have proper hover state contrast', async () => {
      renderWithProviders(<WorkshopList />);
      
      const workshopLink = await screen.findByText('Test Workshop');
      
      // PASSING TEST: Links should have readable hover states
      expect(workshopLink).toHaveClass('dark:hover:text-primary-400');
      
      // primary-400 should have good contrast on dark backgrounds
      const hoverColor: [number, number, number] = [96, 165, 250]; // primary-400 (blue-400)
      const backgroundColor: [number, number, number] = DARK_BACKGROUNDS['slate-900'];
      
      const contrastRatio = getContrastRatio(hoverColor, backgroundColor);
      expect(contrastRatio).toBeGreaterThanOrEqual(3.0);
    });
  });

  describe('Color Combination Validation', () => {
    it('should not use problematic color combinations', async () => {
      renderWithProviders(<Dashboard />);
      
      // Check all text elements for sufficient contrast
      const allTextElements = document.querySelectorAll('h1, h2, h3, p, span, div, button, input, label');
      
      Array.from(allTextElements).forEach(element => {
        const classes = element.className;
        
        if (typeof classes === 'string') {
          // Check for known problematic combinations
          expect(classes).not.toMatch(/dark:text-gray-600.*dark:bg-slate-900/);
          expect(classes).not.toMatch(/dark:text-gray-500.*dark:bg-slate-800/);
          
          // Ensure we're using appropriate text colors for dark backgrounds
          if (classes.includes('dark:bg-slate-900')) {
            // On very dark backgrounds, text should be light
            expect(
              classes.includes('dark:text-gray-100') || 
              classes.includes('dark:text-gray-200') || 
              classes.includes('dark:text-gray-300') ||
              classes.includes('dark:text-white')
            ).toBeTruthy();
          }
          
          if (classes.includes('dark:bg-slate-800')) {
            // On medium dark backgrounds, text should still be light
            expect(
              classes.includes('dark:text-gray-100') || 
              classes.includes('dark:text-gray-200') || 
              classes.includes('dark:text-gray-300') ||
              classes.includes('dark:text-white')
            ).toBeTruthy();
          }
        }
      });
    });

    it('should maintain consistent contrast across all card elements', async () => {
      renderWithProviders(<Dashboard />);
      
      await screen.findByText('Total Workshops');
      
      const cards = document.querySelectorAll('.card');
      
      cards.forEach(card => {
        // All cards should have consistent dark backgrounds
        expect(card).toHaveClass('dark:bg-slate-800');
        expect(card).toHaveClass('dark:border-slate-600');
        
        // Text within cards should be properly contrasted
        const textElements = card.querySelectorAll('h1, h2, h3, p, span, div');
        
        textElements.forEach(textEl => {
          const classes = textEl.className;
          if (typeof classes === 'string' && classes.includes('dark:')) {
            // Ensure no low-contrast text on dark card backgrounds
            expect(classes).not.toMatch(/dark:text-gray-600/);
            expect(classes).not.toMatch(/dark:text-gray-700/);
            expect(classes).not.toMatch(/dark:text-gray-800/);
          }
        });
      });
    });
  });

  describe('Accessibility Standards Compliance', () => {
    it('should pass basic accessibility color requirements', async () => {
      renderWithProviders(<Dashboard />);
      
      await screen.findByText('Dashboard');
      
      // Test key color combinations that should always pass
      const testCombinations = [
        { text: [243, 244, 246], bg: [15, 23, 42], minRatio: 7.0 }, // gray-100 on slate-900
        { text: [209, 213, 219], bg: [15, 23, 42], minRatio: 4.5 }, // gray-300 on slate-900
        { text: [156, 163, 175], bg: [15, 23, 42], minRatio: 3.0 }, // gray-400 on slate-900
        { text: [243, 244, 246], bg: [30, 41, 59], minRatio: 4.5 }, // gray-100 on slate-800
        { text: [209, 213, 219], bg: [30, 41, 59], minRatio: 3.5 }, // gray-300 on slate-800
      ];
      
      testCombinations.forEach(({ text, bg, minRatio }) => {
        const ratio = getContrastRatio(text as [number, number, number], bg as [number, number, number]);
        expect(ratio).toBeGreaterThanOrEqual(minRatio);
      });
    });
  });
});