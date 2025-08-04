import React from 'react';
import { render, screen } from '@testing-library/react';
import Settings from '../Settings';

describe('Settings Dark Mode Colors', () => {
  beforeEach(() => {
    // Add dark class to document element
    document.documentElement.classList.add('dark');
  });
  
  afterEach(() => {
    document.documentElement.classList.remove('dark');
  });

  it('should have dark background for main settings container', () => {
    render(<Settings />);
    
    // Find the main settings container (bg-white shadow rounded-lg)
    const mainContainer = document.querySelector('.bg-white.shadow.rounded-lg');
    
    // FAILING TEST: Should have dark background consistent with other pages
    expect(mainContainer).toHaveClass('dark:bg-slate-800');
    expect(mainContainer).toHaveClass('dark:shadow-none');
  });

  it('should have proper tab headers styling in dark mode', () => {
    render(<Settings />);
    
    // Find tab navigation container
    const tabContainer = document.querySelector('.border-b.border-gray-200');
    
    // FAILING TEST: Tab container should have dark border
    expect(tabContainer).toHaveClass('dark:border-slate-600');
    
    // Find active tab button
    const activeTab = document.querySelector('[aria-label="Tabs"] button.border-primary-500');
    
    // FAILING TEST: Active tab should have dark mode colors
    expect(activeTab).toHaveClass('dark:text-primary-400');
    expect(activeTab).toHaveClass('dark:border-primary-400');
  });

  it('should have dark backgrounds for form input fields', () => {
    render(<Settings />);
    
    // Find number input fields
    const numberInputs = document.querySelectorAll('input[type="number"]');
    
    numberInputs.forEach(input => {
      // FAILING TEST: Number inputs should have dark backgrounds
      expect(input).toHaveClass('dark:bg-slate-700');
      expect(input).toHaveClass('dark:border-slate-600');
      expect(input).toHaveClass('dark:text-gray-100');
    });
    
    // Find text input fields
    const textInputs = document.querySelectorAll('input[type="text"]');
    
    textInputs.forEach(input => {
      // FAILING TEST: Text inputs should have dark backgrounds
      expect(input).toHaveClass('dark:bg-slate-700');
      expect(input).toHaveClass('dark:border-slate-600');
      expect(input).toHaveClass('dark:text-gray-100');
    });
  });

  it('should have visible helper text in dark mode', () => {
    render(<Settings />);
    
    // Find helper text with "Time to wait after workshop end before cleanup"
    const helperText = screen.getByText(/Time to wait after workshop end before cleanup/i);
    
    // FAILING TEST: Helper text should be visible in dark mode
    expect(helperText).toHaveClass('dark:text-gray-400');
  });

  it('should have section headers with proper dark mode contrast', () => {
    render(<Settings />);
    
    // Find section headers (h3 elements)
    const sectionHeaders = screen.getAllByRole('heading', { level: 3 });
    
    sectionHeaders.forEach(header => {
      // FAILING TEST: Section headers should have high contrast in dark mode
      expect(header).toHaveClass('dark:text-gray-100');
    });
  });

  it('should have main page title with dark mode styling', () => {
    render(<Settings />);
    
    // Find the main Settings title
    const pageTitle = screen.getByRole('heading', { level: 1 });
    
    // FAILING TEST: Page title should be highly visible in dark mode
    expect(pageTitle).toHaveClass('dark:text-white');
  });

  it('should have page description with readable dark mode text', () => {
    render(<Settings />);
    
    // Find the page description
    const pageDescription = screen.getByText(/Configure application settings and preferences/i);
    
    // FAILING TEST: Page description should be readable in dark mode
    expect(pageDescription).toHaveClass('dark:text-gray-300');
  });

  it('should have form labels with proper dark mode contrast', () => {
    render(<Settings />);
    
    // Find form labels
    const labels = document.querySelectorAll('label.text-sm.font-medium.text-gray-700');
    
    labels.forEach(label => {
      // FAILING TEST: Form labels should have proper contrast in dark mode
      expect(label).toHaveClass('dark:text-gray-300');
    });
  });

  it('should have save button footer with dark background', () => {
    render(<Settings />);
    
    // Find the save button footer
    const footer = document.querySelector('.bg-gray-50.border-t.border-gray-200');
    
    // FAILING TEST: Footer should have dark background
    expect(footer).toHaveClass('dark:bg-slate-700');
    expect(footer).toHaveClass('dark:border-slate-600');
  });

  it('should have consistent dark theme without light mode islands', () => {
    render(<Settings />);
    
    // Main container should have dark background override
    const mainContainer = document.querySelector('.bg-white.shadow.rounded-lg');
    
    // PASSING TEST: Main container has dark mode override
    expect(mainContainer).toHaveClass('bg-white');
    expect(mainContainer).toHaveClass('dark:bg-slate-800');
    
    // Footer should have dark background override
    const footer = document.querySelector('.bg-gray-50.border-t.border-gray-200');
    
    // PASSING TEST: Footer has dark mode override
    expect(footer).toHaveClass('bg-gray-50');
    expect(footer).toHaveClass('dark:bg-slate-700');
  });
});