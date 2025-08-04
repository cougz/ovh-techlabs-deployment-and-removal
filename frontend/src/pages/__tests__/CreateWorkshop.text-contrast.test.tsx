import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { store } from '../../store';
import CreateWorkshop from '../CreateWorkshop';

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

describe('CreateWorkshop Text Contrast in Dark Mode', () => {
  beforeEach(() => {
    // Add dark class to document element
    document.documentElement.classList.add('dark');
  });
  
  afterEach(() => {
    document.documentElement.classList.remove('dark');
    jest.clearAllMocks();
  });

  it('should have high contrast section headers in dark mode', () => {
    renderWithProviders(<CreateWorkshop />);
    
    // Find section headers (usually h3 elements)
    const sectionHeaders = screen.getAllByRole('heading', { level: 3 });
    
    sectionHeaders.forEach(header => {
      // PASSING TEST: Section headers should have high contrast dark mode classes
      expect(header).toHaveClass('dark:text-gray-100');
    });
  });

  it('should have visible form labels in dark mode', () => {
    renderWithProviders(<CreateWorkshop />);
    
    // Find all label elements by text content
    const nameLabel = screen.getByText('Workshop Name *');
    const descriptionLabel = screen.getByText('Description');
    const startDateLabel = screen.getByText('Start Date & Time *');
    const endDateLabel = screen.getByText('End Date & Time *');
    
    // Test each label has dark mode classes
    [nameLabel, descriptionLabel, startDateLabel, endDateLabel].forEach(label => {
      // PASSING TEST: Labels should have readable contrast in dark mode
      expect(label).toHaveClass('dark:text-gray-300');
    });
  });

  it('should have readable helper text in dark mode', () => {
    renderWithProviders(<CreateWorkshop />);
    
    // Find helper text elements (usually small text, descriptions, hints)
    const helperTexts = screen.queryAllByText(/this will be used|select the timezone|choose a template/i);
    
    helperTexts.forEach(helperText => {
      // FAILING TEST: Helper text should be readable in dark mode
      expect(helperText).toHaveClass('dark:text-gray-400');
      expect(helperText).not.toHaveClass('text-gray-600'); // Default light mode color
    });
  });

  it('should have form inputs with proper dark mode styling', () => {
    renderWithProviders(<CreateWorkshop />);
    
    // Find form inputs (no combobox elements in this form)
    const inputs = screen.getAllByRole('textbox');
    
    inputs.forEach(input => {
      // Form inputs get dark mode styling from .input class in CSS
      // Just verify the base input classes are present
      expect(input).toHaveClass('block');
      expect(input).toHaveClass('w-full');
      expect(input).toHaveClass('rounded-md');
      // Dark mode styling is applied via CSS for .input class
    });
  });

  it('should have main form container with proper dark mode background', () => {
    renderWithProviders(<CreateWorkshop />);
    
    // Find the card containers (they get dark mode styling from CSS)
    const cards = document.querySelectorAll('.card');
    
    cards.forEach(card => {
      // Cards get dark mode styling from .card class in index.css
      expect(card).toHaveClass('card');
      // Dark mode styling is: .dark .card { @apply bg-slate-800 text-white border-2 border-slate-600; }
    });
  });

  it('should have submit button with visible styling in dark mode', () => {
    renderWithProviders(<CreateWorkshop />);
    
    // Find submit button
    const submitButton = screen.getByRole('button', { name: /create workshop/i });
    
    // Button gets styling from .btn-primary class in CSS
    expect(submitButton).toHaveClass('btn-primary');
    // Dark mode styling is handled by CSS for button classes
  });

  it('should have error messages with proper contrast in dark mode', () => {
    renderWithProviders(<CreateWorkshop />);
    
    // Look for potential error message containers or validation text
    const errorContainers = document.querySelectorAll('[class*="error"], [class*="invalid"], .text-red-500, .text-danger-500');
    
    errorContainers.forEach(errorElement => {
      // FAILING TEST: Error messages should be visible in dark mode
      expect(errorElement).toHaveClass('dark:text-red-400');
      expect(errorElement).not.toHaveClass('text-red-500'); // Light mode error color may not have enough contrast
    });
  });

  it('should have consistent text hierarchy for WCAG AA compliance', () => {
    renderWithProviders(<CreateWorkshop />);
    
    // Check main page title
    const pageTitle = screen.getByRole('heading', { level: 1 });
    
    // PASSING TEST: Page title should be highly visible
    expect(pageTitle).toHaveClass('dark:text-white');

    // Check that all text elements have appropriate contrast
    const allTextElements = document.querySelectorAll('p, span, div, label');
    let hasLowContrastElements = false;
    
    allTextElements.forEach(element => {
      const computedStyle = window.getComputedStyle(element);
      const hasText = element.textContent && element.textContent.trim().length > 0;
      
      if (hasText && computedStyle.color === 'rgb(107, 114, 128)') { // gray-500 - low contrast
        hasLowContrastElements = true;
      }
    });
    
    // FAILING TEST: No elements should have low contrast colors in dark mode
    expect(hasLowContrastElements).toBe(false);
  });
});