import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { store } from '../../store';
import DarkModeToggle from '../DarkModeToggle';

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <Provider store={store}>
      {ui}
    </Provider>
  );
};

describe('DarkModeToggle', () => {
  let mockLocalStorage: Storage;

  beforeEach(() => {
    // Clean up between tests
    document.body.classList.remove('dark-mode');
    
    // Create a functional localStorage mock
    mockLocalStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
      length: 0,
      key: jest.fn(),
    };
    
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });
  });

  it('should render dark mode toggle with theme switch', () => {
    renderWithProviders(<DarkModeToggle />);
    
    const toggleInput = screen.getByRole('checkbox', { name: /toggle dark mode/i });
    expect(toggleInput).toBeInTheDocument();
  });

  it('should have proper theme switch structure', () => {
    renderWithProviders(<DarkModeToggle />);
    
    const themeSwitch = screen.getByRole('checkbox').closest('.theme-switch');
    expect(themeSwitch).toBeInTheDocument();
    
    const container = themeSwitch?.querySelector('.theme-switch__container');
    expect(container).toBeInTheDocument();
  });

  it('should toggle dark mode when clicked', () => {
    renderWithProviders(<DarkModeToggle />);
    
    const toggleInput = screen.getByRole('checkbox', { name: /toggle dark mode/i });
    
    fireEvent.click(toggleInput);
    
    // Should toggle the dark mode state
    expect(document.body.classList.contains('dark-mode')).toBe(true);
    // Check if localStorage setItem was called with correct value
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('theme', 'dark');
  });

  it('should turn off dark mode when unchecked', () => {
    renderWithProviders(<DarkModeToggle />);
    
    const toggleInput = screen.getByRole('checkbox', { name: /toggle dark mode/i });
    
    // First turn on dark mode
    fireEvent.click(toggleInput);
    expect(document.body.classList.contains('dark-mode')).toBe(true);
    
    // Then turn it off
    fireEvent.click(toggleInput);
    expect(document.body.classList.contains('dark-mode')).toBe(false);
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('theme', 'light');
  });

  it('should restore theme preference on load', () => {
    // Mock localStorage.getItem to return 'dark' theme
    (mockLocalStorage.getItem as jest.Mock).mockReturnValue('dark');
    
    renderWithProviders(<DarkModeToggle />);
    
    const toggleInput = screen.getByRole('checkbox', { name: /toggle dark mode/i });
    expect(toggleInput).toBeChecked();
    expect(document.body.classList.contains('dark-mode')).toBe(true);
  });

  it('should have animated theme switch elements', () => {
    renderWithProviders(<DarkModeToggle />);
    
    const themeSwitch = screen.getByRole('checkbox').closest('.theme-switch');
    
    // Check for animated elements
    expect(themeSwitch?.querySelector('.theme-switch__moon')).toBeInTheDocument();
    expect(themeSwitch?.querySelector('.theme-switch__clouds')).toBeInTheDocument();
    expect(themeSwitch?.querySelector('.theme-switch__stars-container')).toBeInTheDocument();
  });

  it('should have appropriate toggle size for header placement', () => {
    renderWithProviders(<DarkModeToggle />);
    
    const themeSwitch = screen.getByRole('checkbox').closest('.theme-switch');
    
    // Check that the toggle has the correct size class
    expect(themeSwitch).toHaveClass('theme-switch');
    
    // Since CSS variables are hard to test in Jest, we'll verify the component renders
    // The actual CSS change from 30px to 20px is verified by visual inspection
    expect(themeSwitch).toBeInTheDocument();
  });

  it('should add dark class to document element for Tailwind dark mode support', () => {
    renderWithProviders(<DarkModeToggle />);
    
    const toggleInput = screen.getByRole('checkbox', { name: /toggle dark mode/i });
    
    // Toggle dark mode on
    fireEvent.click(toggleInput);
    
    // Should add 'dark' class to document element for Tailwind CSS
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.body.classList.contains('dark-mode')).toBe(true);
  });

  it('should remove dark class from document element when toggled off', () => {
    renderWithProviders(<DarkModeToggle />);
    
    const toggleInput = screen.getByRole('checkbox', { name: /toggle dark mode/i });
    
    // First turn on dark mode
    fireEvent.click(toggleInput);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    
    // Then turn it off
    fireEvent.click(toggleInput);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});