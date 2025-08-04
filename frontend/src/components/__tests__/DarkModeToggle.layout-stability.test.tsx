import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import DarkModeToggle from '../DarkModeToggle';

describe('DarkModeToggle Layout Stability and Positioning', () => {
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

    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should maintain consistent dimensions during theme toggle', () => {
    const TestComponent = () => (
      <div data-testid="container" style={{ padding: '20px' }}>
        <div data-testid="above-toggle" style={{ height: '50px', backgroundColor: 'blue' }}>
          Content Above Toggle
        </div>
        <DarkModeToggle />
        <div data-testid="below-toggle" style={{ height: '50px', backgroundColor: 'red' }}>
          Content Below Toggle
        </div>
      </div>
    );

    render(<TestComponent />);

    const container = screen.getByTestId('container');
    const aboveElement = screen.getByTestId('above-toggle');
    const belowElement = screen.getByTestId('below-toggle');
    const toggleLabel = screen.getByLabelText('Toggle dark mode');

    // Get initial dimensions and positions
    const initialContainer = container.getBoundingClientRect();
    const initialAbove = aboveElement.getBoundingClientRect();
    const initialBelow = belowElement.getBoundingClientRect();
    const initialToggle = toggleLabel.getBoundingClientRect();

    // Toggle to dark mode
    act(() => {
      fireEvent.click(toggleLabel);
    });

    // FAILING TEST: Check dimensions haven't changed after toggle
    const afterContainer = container.getBoundingClientRect();
    const afterAbove = aboveElement.getBoundingClientRect();
    const afterBelow = belowElement.getBoundingClientRect();
    const afterToggle = toggleLabel.getBoundingClientRect();

    // Container should maintain size
    expect(Math.abs(afterContainer.width - initialContainer.width)).toBeLessThan(1);
    expect(Math.abs(afterContainer.height - initialContainer.height)).toBeLessThan(1);

    // Elements above toggle should not move
    expect(Math.abs(afterAbove.top - initialAbove.top)).toBeLessThan(1);
    expect(Math.abs(afterAbove.left - initialAbove.left)).toBeLessThan(1);

    // Toggle itself should not change size
    expect(Math.abs(afterToggle.width - initialToggle.width)).toBeLessThan(1);
    expect(Math.abs(afterToggle.height - initialToggle.height)).toBeLessThan(1);

    // Elements below toggle should maintain relative position
    expect(Math.abs(afterBelow.top - initialBelow.top)).toBeLessThan(1);
    expect(Math.abs(afterBelow.left - initialBelow.left)).toBeLessThan(1);
  });

  it('should not cause document body layout shifts', () => {
    render(<DarkModeToggle />);

    const toggleLabel = screen.getByLabelText('Toggle dark mode');

    // Get initial body dimensions
    const initialBodyRect = document.body.getBoundingClientRect();
    const initialScrollWidth = document.body.scrollWidth;
    const initialScrollHeight = document.body.scrollHeight;

    // Toggle to dark mode
    act(() => {
      fireEvent.click(toggleLabel);
    });

    // FAILING TEST: Body dimensions should not change
    const afterBodyRect = document.body.getBoundingClientRect();
    const afterScrollWidth = document.body.scrollWidth;
    const afterScrollHeight = document.body.scrollHeight;

    expect(Math.abs(afterBodyRect.width - initialBodyRect.width)).toBeLessThan(1);
    expect(Math.abs(afterBodyRect.height - initialBodyRect.height)).toBeLessThan(1);
    expect(afterScrollWidth).toBe(initialScrollWidth);
    expect(afterScrollHeight).toBe(initialScrollHeight);
  });

  it('should not add CSS properties that cause layout reflow', () => {
    render(<DarkModeToggle />);

    const toggleLabel = screen.getByLabelText('Toggle dark mode');

    // Check initial CSS properties that could cause layout shifts
    const initialBodyStyle = getComputedStyle(document.body);
    const initialDocumentStyle = getComputedStyle(document.documentElement);

    // Toggle to dark mode
    act(() => {
      fireEvent.click(toggleLabel);
    });

    // FAILING TEST: Layout-affecting CSS properties should not be added
    const afterBodyStyle = getComputedStyle(document.body);
    const afterDocumentStyle = getComputedStyle(document.documentElement);

    // Check that no layout-affecting properties were added to body
    expect(afterBodyStyle.width).toBe(initialBodyStyle.width);
    expect(afterBodyStyle.height).toBe(initialBodyStyle.height);
    expect(afterBodyStyle.padding).toBe(initialBodyStyle.padding);
    expect(afterBodyStyle.margin).toBe(initialBodyStyle.margin);
    expect(afterBodyStyle.border).toBe(initialBodyStyle.border);

    // Check that only the 'dark' class was added to document element
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.length).toBe(1);
  });

  it('should maintain toggle visual consistency during rapid toggles', () => {
    const TestComponent = () => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div data-testid="left-element">Left</div>
        <DarkModeToggle />
        <div data-testid="right-element">Right</div>
      </div>
    );

    render(<TestComponent />);

    const toggleLabel = screen.getByLabelText('Toggle dark mode');
    const leftElement = screen.getByTestId('left-element');
    const rightElement = screen.getByTestId('right-element');

    // Get initial positions
    const initialLeft = leftElement.getBoundingClientRect();
    const initialRight = rightElement.getBoundingClientRect();
    const initialToggle = toggleLabel.getBoundingClientRect();

    // Perform rapid toggles
    for (let i = 0; i < 10; i++) {
      act(() => {
        fireEvent.click(toggleLabel);
      });
    }

    // FAILING TEST: Positions should remain stable after rapid toggles
    const finalLeft = leftElement.getBoundingClientRect();
    const finalRight = rightElement.getBoundingClientRect();
    const finalToggle = toggleLabel.getBoundingClientRect();

    expect(Math.abs(finalLeft.left - initialLeft.left)).toBeLessThan(1);
    expect(Math.abs(finalLeft.top - initialLeft.top)).toBeLessThan(1);
    expect(Math.abs(finalRight.left - initialRight.left)).toBeLessThan(1);
    expect(Math.abs(finalRight.top - initialRight.top)).toBeLessThan(1);
    expect(Math.abs(finalToggle.width - initialToggle.width)).toBeLessThan(1);
    expect(Math.abs(finalToggle.height - initialToggle.height)).toBeLessThan(1);
  });

  it('should not cause cumulative layout shift (CLS) issues', () => {
    const TestComponent = () => (
      <div data-testid="layout-container" style={{ minHeight: '100vh' }}>
        <div style={{ height: '200px', backgroundColor: '#f0f0f0' }}>Header</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '20px' }}>
          <div>Content</div>
          <DarkModeToggle />
        </div>
        <div style={{ height: '400px', backgroundColor: '#e0e0e0' }}>Main Content</div>
        <div style={{ height: '100px', backgroundColor: '#d0d0d0' }}>Footer</div>
      </div>
    );

    render(<TestComponent />);

    const container = screen.getByTestId('layout-container');
    const toggleLabel = screen.getByLabelText('Toggle dark mode');

    // Measure initial layout
    const initialHeight = container.scrollHeight;
    const initialWidth = container.scrollWidth;

    // Multiple theme toggles to test for cumulative shifts
    for (let i = 0; i < 5; i++) {
      act(() => {
        fireEvent.click(toggleLabel);
      });
    }

    // FAILING TEST: Total layout dimensions should remain stable
    const finalHeight = container.scrollHeight;
    const finalWidth = container.scrollWidth;

    expect(Math.abs(finalHeight - initialHeight)).toBeLessThan(2);
    expect(Math.abs(finalWidth - initialWidth)).toBeLessThan(2);
  });

  it('should handle theme toggle without affecting fixed positioned elements', () => {
    const TestComponent = () => (
      <div>
        <div 
          data-testid="fixed-element"
          style={{ 
            position: 'fixed', 
            top: '10px', 
            right: '10px', 
            width: '100px', 
            height: '50px',
            backgroundColor: 'yellow'
          }}
        >
          Fixed Element
        </div>
        <DarkModeToggle />
        <div style={{ height: '1000px' }}>Scrollable content</div>
      </div>
    );

    render(<TestComponent />);

    const fixedElement = screen.getByTestId('fixed-element');
    const toggleLabel = screen.getByLabelText('Toggle dark mode');

    // Get initial position of fixed element
    const initialFixed = fixedElement.getBoundingClientRect();

    // Toggle theme
    act(() => {
      fireEvent.click(toggleLabel);
    });

    // FAILING TEST: Fixed element should not move
    const finalFixed = fixedElement.getBoundingClientRect();

    expect(Math.abs(finalFixed.top - initialFixed.top)).toBeLessThan(1);
    expect(Math.abs(finalFixed.right - initialFixed.right)).toBeLessThan(1);
    expect(Math.abs(finalFixed.width - initialFixed.width)).toBeLessThan(1);
    expect(Math.abs(finalFixed.height - initialFixed.height)).toBeLessThan(1);
  });

  it('should not cause document element style attribute changes', () => {
    render(<DarkModeToggle />);

    const toggleLabel = screen.getByLabelText('Toggle dark mode');

    // Check initial document element attributes
    const initialStyleAttr = document.documentElement.getAttribute('style');
    const initialClassName = document.documentElement.className;

    // Toggle to dark mode
    act(() => {
      fireEvent.click(toggleLabel);
    });

    // FAILING TEST: Only className should change, not style attribute
    const finalStyleAttr = document.documentElement.getAttribute('style');
    const finalClassName = document.documentElement.className;

    expect(finalStyleAttr).toBe(initialStyleAttr); // Should be null or unchanged
    expect(finalClassName).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    // Toggle back to light mode
    act(() => {
      fireEvent.click(toggleLabel);
    });

    // FAILING TEST: Should cleanly remove dark class
    expect(document.documentElement.className).toBe('');
    expect(document.documentElement.classList.length).toBe(0);
  });
});