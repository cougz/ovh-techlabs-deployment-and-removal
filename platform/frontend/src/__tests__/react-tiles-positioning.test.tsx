import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { store } from '../store';
import Dashboard from '../pages/Dashboard';
import WorkshopList from '../pages/WorkshopList';
import Settings from '../pages/Settings';
import DarkModeToggle from '../components/DarkModeToggle';
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

describe('React Tiles Positioning and Layout Stability', () => {
  beforeEach(() => {
    // Reset document classes
    document.documentElement.classList.remove('dark');
    
    // Mock localStorage
    const store: Record<string, string> = {};
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => Object.keys(store).forEach(key => delete store[key]),
        length: Object.keys(store).length,
        key: (index: number) => Object.keys(store)[index] || null,
      },
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
    
    // Mock API responses
    (workshopApi.getWorkshops as jest.Mock).mockResolvedValue([
      {
        id: '1',
        name: 'Test Workshop',
        status: 'active',
        attendee_count: 5,
        active_attendees: 3,
        start_date: '2023-12-01T10:00:00Z',
        end_date: '2023-12-01T18:00:00Z',
      },
      {
        id: '2',
        name: 'Planning Workshop',
        status: 'planning',
        attendee_count: 10,
        active_attendees: 0,
        start_date: '2023-12-15T09:00:00Z',
        end_date: '2023-12-15T17:00:00Z',
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

  describe('Dashboard Stats Tiles Positioning', () => {
    it('should maintain stat card positions during theme toggle', async () => {
      const TestComponent = () => (
        <div>
          <DarkModeToggle />
          <Dashboard />
        </div>
      );

      renderWithProviders(<TestComponent />);
      
      // Wait for data to load
      await screen.findByText('Total Workshops');
      
      // Get all stat cards
      const statCards = screen.getAllByText(/Total Workshops|Active Workshops|Total Attendees|Active Attendees/);
      
      // Record initial positions
      const initialPositions = statCards.map(card => {
        const cardElement = card.closest('.card');
        return cardElement ? cardElement.getBoundingClientRect() : null;
      }).filter(Boolean);

      // Toggle to dark mode
      const toggle = screen.getByLabelText('Toggle dark mode');
      act(() => {
        fireEvent.click(toggle);
      });

      // Wait for theme change to apply
      await new Promise(resolve => setTimeout(resolve, 200));

      // Check positions haven't shifted
      const finalPositions = statCards.map(card => {
        const cardElement = card.closest('.card');
        return cardElement ? cardElement.getBoundingClientRect() : null;
      }).filter(Boolean);

      // FAILING TEST: Positions should remain stable
      initialPositions.forEach((initialPos, index) => {
        const finalPos = finalPositions[index];
        if (initialPos && finalPos) {
          expect(Math.abs(finalPos.top - initialPos.top)).toBeLessThan(2);
          expect(Math.abs(finalPos.left - initialPos.left)).toBeLessThan(2);
          expect(Math.abs(finalPos.width - initialPos.width)).toBeLessThan(2);
          expect(Math.abs(finalPos.height - initialPos.height)).toBeLessThan(2);
        }
      });
    });

    it('should maintain grid layout during theme transitions', async () => {
      renderWithProviders(<Dashboard />);
      
      await screen.findByText('Total Workshops');
      
      // Find the grid container
      const gridContainer = document.querySelector('.grid');
      expect(gridContainer).toBeTruthy();
      
      if (gridContainer) {
        const initialRect = gridContainer.getBoundingClientRect();
        const initialChildren = Array.from(gridContainer.children).map(child => 
          child.getBoundingClientRect()
        );

        // Toggle theme
        document.documentElement.classList.add('dark');
        
        // Force re-render
        await new Promise(resolve => setTimeout(resolve, 100));

        // Check grid hasn't changed
        const finalRect = gridContainer.getBoundingClientRect();
        const finalChildren = Array.from(gridContainer.children).map(child => 
          child.getBoundingClientRect()
        );

        // FAILING TEST: Grid layout should remain stable
        expect(Math.abs(finalRect.width - initialRect.width)).toBeLessThan(2);
        expect(Math.abs(finalRect.height - initialRect.height)).toBeLessThan(2);
        
        // Check individual grid items
        initialChildren.forEach((initialChild, index) => {
          const finalChild = finalChildren[index];
          if (finalChild) {
            expect(Math.abs(finalChild.width - initialChild.width)).toBeLessThan(2);
            expect(Math.abs(finalChild.height - initialChild.height)).toBeLessThan(2);
          }
        });
      }
    });
  });

  describe('WorkshopList Tiles Positioning', () => {
    it('should maintain workshop card positions during theme toggle', async () => {
      const TestComponent = () => (
        <div>
          <DarkModeToggle />
          <WorkshopList />
        </div>
      );

      renderWithProviders(<TestComponent />);
      
      // Wait for workshops to load
      await screen.findByText('Test Workshop');
      
      // Get all workshop cards
      const workshopCards = document.querySelectorAll('.card');
      
      // Record initial positions
      const initialPositions = Array.from(workshopCards).map(card => 
        card.getBoundingClientRect()
      );

      // Toggle to dark mode
      const toggle = screen.getByLabelText('Toggle dark mode');
      act(() => {
        fireEvent.click(toggle);
      });

      // Wait for theme change
      await new Promise(resolve => setTimeout(resolve, 200));

      // Check positions
      const finalPositions = Array.from(workshopCards).map(card => 
        card.getBoundingClientRect()
      );

      // FAILING TEST: Workshop cards should not move
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

    it('should maintain search and filter positioning', async () => {
      renderWithProviders(<WorkshopList />);
      
      await screen.findByText('Test Workshop');
      
      const searchInput = screen.getByPlaceholderText('Search workshops...');
      const filterSelect = screen.getByDisplayValue('All Status');
      
      const initialSearch = searchInput.getBoundingClientRect();
      const initialFilter = filterSelect.getBoundingClientRect();

      // Toggle theme
      document.documentElement.classList.add('dark');
      await new Promise(resolve => setTimeout(resolve, 100));

      const finalSearch = searchInput.getBoundingClientRect();
      const finalFilter = filterSelect.getBoundingClientRect();

      // FAILING TEST: Filter controls should not move
      expect(Math.abs(finalSearch.top - initialSearch.top)).toBeLessThan(2);
      expect(Math.abs(finalSearch.left - initialSearch.left)).toBeLessThan(2);
      expect(Math.abs(finalFilter.top - initialFilter.top)).toBeLessThan(2);
      expect(Math.abs(finalFilter.left - initialFilter.left)).toBeLessThan(2);
    });
  });

  describe('Settings Form Tiles Positioning', () => {
    it('should maintain form field positions during theme toggle', async () => {
      const TestComponent = () => (
        <div>
          <DarkModeToggle />
          <Settings />
        </div>
      );

      renderWithProviders(<TestComponent />);
      
      // Wait for form to load
      await screen.findByText('Login Prefix');
      
      const loginInput = screen.getByLabelText('Login Prefix');
      const exportInput = screen.getByLabelText('Export Format Label');
      const saveButton = screen.getByText('Save Settings');
      
      const initialLogin = loginInput.getBoundingClientRect();
      const initialExport = exportInput.getBoundingClientRect();
      const initialSave = saveButton.getBoundingClientRect();

      // Toggle to dark mode
      const toggle = screen.getByLabelText('Toggle dark mode');
      act(() => {
        fireEvent.click(toggle);
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      const finalLogin = loginInput.getBoundingClientRect();
      const finalExport = exportInput.getBoundingClientRect();
      const finalSave = saveButton.getBoundingClientRect();

      // FAILING TEST: Form elements should not move
      expect(Math.abs(finalLogin.top - initialLogin.top)).toBeLessThan(2);
      expect(Math.abs(finalLogin.left - initialLogin.left)).toBeLessThan(2);
      expect(Math.abs(finalExport.top - initialExport.top)).toBeLessThan(2);
      expect(Math.abs(finalExport.left - initialExport.left)).toBeLessThan(2);
      expect(Math.abs(finalSave.top - initialSave.top)).toBeLessThan(2);
      expect(Math.abs(finalSave.left - initialSave.left)).toBeLessThan(2);
    });
  });

  describe('Rapid Theme Switching Stability', () => {
    it('should handle rapid theme toggles without cumulative layout shift', async () => {
      const TestComponent = () => (
        <div data-testid="main-container">
          <DarkModeToggle />
          <Dashboard />
        </div>
      );

      renderWithProviders(<TestComponent />);
      
      await screen.findByText('Total Workshops');
      
      const container = screen.getByTestId('main-container');
      const initialRect = container.getBoundingClientRect();
      
      const toggle = screen.getByLabelText('Toggle dark mode');

      // Perform rapid toggles
      for (let i = 0; i < 10; i++) {
        act(() => {
          fireEvent.click(toggle);
        });
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const finalRect = container.getBoundingClientRect();

      // FAILING TEST: Container should maintain size after rapid toggles
      expect(Math.abs(finalRect.width - initialRect.width)).toBeLessThan(5);
      expect(Math.abs(finalRect.height - initialRect.height)).toBeLessThan(5);
      expect(Math.abs(finalRect.top - initialRect.top)).toBeLessThan(5);
      expect(Math.abs(finalRect.left - initialRect.left)).toBeLessThan(5);
    });
  });

  describe('Cross-Component Layout Stability', () => {
    it('should maintain layout when switching between pages with different themes', async () => {
      const { rerender } = renderWithProviders(<Dashboard />);
      
      await screen.findByText('Total Workshops');
      
      // Get viewport dimensions
      const initialViewport = {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY
      };

      // Switch to dark mode
      document.documentElement.classList.add('dark');
      
      // Rerender with different component
      rerender(
        <Provider store={store}>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <WorkshopList />
            </BrowserRouter>
          </QueryClientProvider>
        </Provider>
      );

      await screen.findByText('Test Workshop');

      const finalViewport = {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY
      };

      // FAILING TEST: Viewport should remain stable across component changes
      expect(finalViewport.width).toBe(initialViewport.width);
      expect(finalViewport.height).toBe(initialViewport.height);
      expect(Math.abs(finalViewport.scrollX - initialViewport.scrollX)).toBeLessThan(2);
      expect(Math.abs(finalViewport.scrollY - initialViewport.scrollY)).toBeLessThan(2);
    });
  });
});