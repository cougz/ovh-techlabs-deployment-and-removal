import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DarkModeToggle from '../DarkModeToggle';

describe('DarkModeToggle Layout Shift', () => {
  let mockLocalStorage: Storage;

  beforeEach(() => {
    // Reset document classes
    document.documentElement.classList.remove('dark');
    
    // Create a functional localStorage mock
    const store: Record<string, string> = {};
    mockLocalStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => Object.keys(store).forEach(key => delete store[key]),
      length: Object.keys(store).length,
      key: (index: number) => Object.keys(store)[index] || null,
    };
    
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should not cause layout shift when toggling to dark mode', () => {
    render(
      <div>
        <DarkModeToggle />
        <div data-testid="content-element">Content below toggle</div>
      </div>
    );

    // Get initial classes applied to document
    const initialClasses = Array.from(document.documentElement.classList);

    // Toggle to dark mode
    const toggleButton = screen.getByLabelText('Toggle dark mode');
    fireEvent.click(toggleButton);

    // Get classes after toggle
    const afterClasses = Array.from(document.documentElement.classList);

    // FAILING TEST: Document should only have 'dark' class added, no layout-affecting changes
    expect(afterClasses).toContain('dark');
    expect(afterClasses.length).toBe(initialClasses.length + 1);
    
    // FAILING TEST: No additional layout-affecting classes should be added
    const addedClasses = afterClasses.filter(cls => !initialClasses.includes(cls));
    expect(addedClasses).toEqual(['dark']);
  });

  it('should not cause layout shift when toggling to light mode', () => {
    // Start in dark mode
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');

    render(
      <div>
        <DarkModeToggle />
        <div data-testid="content-element">Content below toggle</div>
      </div>
    );

    // Verify starting state
    expect(document.documentElement.classList).toContain('dark');

    // Toggle to light mode
    const toggleButton = screen.getByLabelText('Toggle dark mode');
    fireEvent.click(toggleButton);

    // FAILING TEST: Document should have 'dark' class removed cleanly
    expect(document.documentElement.classList).not.toContain('dark');
    
    // FAILING TEST: No unexpected classes should remain
    const remainingClasses = Array.from(document.documentElement.classList);
    expect(remainingClasses).not.toContain('dark');
    expect(remainingClasses.length).toBe(0);
  });

  it('should maintain theme toggle state consistency', () => {
    render(<DarkModeToggle />);

    const toggleButton = screen.getByLabelText('Toggle dark mode');

    // Initial state - should be light mode
    expect(document.documentElement.classList).not.toContain('dark');
    expect(localStorage.getItem('theme')).toBeFalsy();

    // First toggle - to dark mode
    fireEvent.click(toggleButton);
    expect(document.documentElement.classList).toContain('dark');
    expect(localStorage.getItem('theme')).toBe('dark');

    // Second toggle - back to light mode
    fireEvent.click(toggleButton);
    
    // FAILING TEST: Should cleanly return to light mode
    expect(document.documentElement.classList).not.toContain('dark');
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('should test document element modification behavior', () => {
    render(<DarkModeToggle />);

    // Test that theme toggle only modifies classList, not other properties
    const initialProps = {
      className: document.documentElement.className,
      style: document.documentElement.getAttribute('style'),
      id: document.documentElement.id,
    };

    const toggleButton = screen.getByLabelText('Toggle dark mode');
    fireEvent.click(toggleButton);

    // FAILING TEST: Only classList should change, other attributes remain unchanged
    expect(document.documentElement.getAttribute('style')).toBe(initialProps.style);
    expect(document.documentElement.id).toBe(initialProps.id);
    
    // Class should change but only by adding 'dark'
    expect(document.documentElement.className).toContain('dark');
  });

  it('should handle rapid theme toggles without state corruption', () => {
    render(<DarkModeToggle />);

    const toggleButton = screen.getByLabelText('Toggle dark mode');

    // Perform rapid toggles
    for (let i = 0; i < 5; i++) {
      fireEvent.click(toggleButton);
    }

    // FAILING TEST: After odd number of toggles, should be in dark mode
    expect(document.documentElement.classList).toContain('dark');
    expect(localStorage.getItem('theme')).toBe('dark');

    // One more toggle to even it out
    fireEvent.click(toggleButton);

    // FAILING TEST: After even number of toggles, should be in light mode
    expect(document.documentElement.classList).not.toContain('dark');
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('should NOT add classes to body element that could cause layout shift', () => {
    render(<DarkModeToggle />);

    // Get initial body classes
    const initialBodyClasses = Array.from(document.body.classList);

    // Toggle to dark mode
    const toggleButton = screen.getByLabelText('Toggle dark mode');
    fireEvent.click(toggleButton);

    // FAILING TEST: Body should not have layout-affecting classes added
    const afterBodyClasses = Array.from(document.body.classList);
    
    // Check if any classes were added to body
    const addedBodyClasses = afterBodyClasses.filter(cls => !initialBodyClasses.includes(cls));
    
    // FAILING TEST: Body should not have 'dark-mode' or any layout-affecting classes
    expect(addedBodyClasses).toEqual([]);
    expect(document.body.classList).not.toContain('dark-mode');
  });
});