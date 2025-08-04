import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import Dashboard from '../Dashboard';
import { workshopApi } from '../../services/api';

// Mock the API
jest.mock('../../services/api');
const mockedWorkshopApi = workshopApi as jest.Mocked<typeof workshopApi>;

// Mock navigate
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  Link: ({ children, to, className }: any) => (
    <a href={to} className={className}>{children}</a>
  ),
}));

const renderDashboard = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Dashboard - UI Fix', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedWorkshopApi.getWorkshops.mockResolvedValue([]);
  });

  it('should NOT have double containers in main wrapper', () => {
    renderDashboard();
    
    const mainContainer = document.querySelector('.animate-fade-in');
    expect(mainContainer).toBeInTheDocument();
    
    // Should NOT have dark background, border, shadow, padding, or rounded corners
    // These should be handled by base CSS only
    expect(mainContainer).not.toHaveClass('dark:bg-slate-900');
    expect(mainContainer).not.toHaveClass('dark:border');
    expect(mainContainer).not.toHaveClass('dark:border-slate-700');
    expect(mainContainer).not.toHaveClass('dark:shadow-2xl');
    expect(mainContainer).not.toHaveClass('dark:p-6');
    expect(mainContainer).not.toHaveClass('dark:rounded-lg');
  });

  it('should NOT have redundant dark mode classes on stat cards', () => {
    renderDashboard();
    
    // Wait for cards to render
    const cards = document.querySelectorAll('.card');
    expect(cards.length).toBeGreaterThan(0);
    
    // Cards should rely on CSS .dark .card selector, not inline classes
    cards.forEach((card) => {
      expect(card).not.toHaveClass('dark:bg-slate-800');
      expect(card).not.toHaveClass('dark:border-slate-600');
      expect(card).not.toHaveClass('dark:border-2');
    });
  });

  it('should have single-level card structure for recent workshops', async () => {
    renderDashboard();
    
    // Wait for content to load
    await waitFor(() => {
      expect(screen.getByText('Recent Workshops')).toBeInTheDocument();
    });
    
    const recentWorkshopsCard = screen.getByText('Recent Workshops').closest('.card');
    expect(recentWorkshopsCard).toBeInTheDocument();
    
    // Should NOT have redundant dark mode classes
    expect(recentWorkshopsCard).not.toHaveClass('dark:bg-slate-800');
    expect(recentWorkshopsCard).not.toHaveClass('dark:border-slate-600');
    expect(recentWorkshopsCard).not.toHaveClass('dark:border-2');
    expect(recentWorkshopsCard).not.toHaveClass('dark:shadow-lg');
  });

  it('should NOT have nested dark containers in empty state', async () => {
    renderDashboard();
    
    // Wait for content to load
    await waitFor(() => {
      expect(screen.getByText('No workshops')).toBeInTheDocument();
    });
    
    // Find the empty state container
    const emptyState = screen.getByText('No workshops').parentElement;
    expect(emptyState).toBeInTheDocument();
    
    // Should not have nested dark styling creating "box within box" effect
    expect(emptyState).not.toHaveClass('dark:bg-slate-800/50');
    expect(emptyState).not.toHaveClass('dark:border');
    expect(emptyState).not.toHaveClass('dark:border-slate-600');
    expect(emptyState).not.toHaveClass('dark:rounded-lg');
    expect(emptyState).not.toHaveClass('dark:shadow-inner');
    expect(emptyState).not.toHaveClass('dark:m-4');
  });

  it('should have clean header without excessive dark styling', () => {
    renderDashboard();
    
    const header = screen.getByText('Dashboard').closest('div')?.parentElement;
    expect(header).toBeInTheDocument();
    
    // Header should have minimal, clean styling
    expect(header).not.toHaveClass('dark:border-b-2');
    expect(header).not.toHaveClass('dark:border-slate-600');
    expect(header).not.toHaveClass('dark:pb-8');
  });

  it('should NOT have redundant card header dark styling', () => {
    renderDashboard();
    
    const cardHeaders = document.querySelectorAll('.card-header');
    cardHeaders.forEach((header) => {
      // Should rely on CSS .dark .card-header, not inline classes
      expect(header).not.toHaveClass('dark:bg-slate-700');
      expect(header).not.toHaveClass('dark:border-b-2');
      expect(header).not.toHaveClass('dark:border-slate-600');
    });
  });

  it('should have consistent spacing without nested margin/padding', async () => {
    renderDashboard();
    
    // Wait for content to load
    await waitFor(() => {
      expect(screen.getByText('Total Workshops')).toBeInTheDocument();
    });
    
    // Stats section should have standard spacing
    const statsGrid = document.querySelector('.grid.grid-cols-1.gap-5');
    expect(statsGrid).toBeInTheDocument();
    expect(statsGrid).toHaveClass('mb-12'); // Standard spacing
    
    // Should not have extra dark mode margins
    expect(statsGrid).not.toHaveClass('dark:mt-4');
  });

  it('should use base CSS card styles instead of inline dark classes', () => {
    renderDashboard();
    
    // All cards should have base card class
    const cards = document.querySelectorAll('.card');
    cards.forEach((card) => {
      expect(card).toHaveClass('card');
      
      // Should NOT override CSS with inline dark classes
      expect(card).not.toHaveClass('dark:bg-slate-800');
      expect(card).not.toHaveClass('dark:border-slate-600');
      expect(card).not.toHaveClass('dark:border-2');
    });
  });
});