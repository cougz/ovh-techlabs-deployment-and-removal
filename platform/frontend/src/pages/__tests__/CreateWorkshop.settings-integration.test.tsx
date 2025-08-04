import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import CreateWorkshop from '../CreateWorkshop';

// Mock the API
jest.mock('../../services/api');

// Mock navigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const renderCreateWorkshop = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <CreateWorkshop />
      </QueryClientProvider>
    </BrowserRouter>
  );
};

describe('CreateWorkshop Settings Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Clear localStorage before each test
    localStorage.clear();
    
    // Mock template API
    const { templateApi } = require('../../services/api');
    templateApi.listTemplates = jest.fn().mockResolvedValue([
      {
        name: 'Generic',
        description: 'Creates: IAM User, IAM Policy, OVHcloud Public Cloud Project',
        resources: ['ovh_public_cloud_project'],
        is_active: true
      }
    ]);
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Cleanup Delay Settings Integration', () => {
    it('should show default 1 hour cleanup delay when no settings are saved', async () => {
      renderCreateWorkshop();
      
      await waitFor(() => {
        expect(screen.getByText(/All resources will be cleaned up 1 hour after the workshop ends/i)).toBeInTheDocument();
      });
    });

    it('should show custom cleanup delay from settings', async () => {
      // Set custom cleanup delay in localStorage (2 hours)
      const settings = {
        autoCleanup: true,
        cleanupDelay: 2
      };
      localStorage.setItem('techlabs-settings', JSON.stringify(settings));
      
      renderCreateWorkshop();
      
      await waitFor(() => {
        expect(screen.getByText(/All resources will be cleaned up 2 hours after the workshop ends/i)).toBeInTheDocument();
      });
      
      // Should not show the default 1 hour text
      expect(screen.queryByText(/All resources will be cleaned up 1 hour after the workshop ends/i)).not.toBeInTheDocument();
    });

    it('should show different cleanup delays for different settings', async () => {
      // Test with 24 hours
      const settings24h = {
        autoCleanup: true,
        cleanupDelay: 24
      };
      localStorage.setItem('techlabs-settings', JSON.stringify(settings24h));
      
      const { unmount } = renderCreateWorkshop();
      
      await waitFor(() => {
        expect(screen.getByText(/All resources will be cleaned up 24 hours after the workshop ends/i)).toBeInTheDocument();
      });
      
      unmount();
      
      // Test with 72 hours (default)
      const settings72h = {
        autoCleanup: true,
        cleanupDelay: 72
      };
      localStorage.setItem('techlabs-settings', JSON.stringify(settings72h));
      
      renderCreateWorkshop();
      
      await waitFor(() => {
        expect(screen.getByText(/All resources will be cleaned up 72 hours after the workshop ends/i)).toBeInTheDocument();
      });
    });

    it('should handle singular hour vs plural hours correctly', async () => {
      // Test singular (1 hour)
      const settings1h = {
        autoCleanup: true,
        cleanupDelay: 1
      };
      localStorage.setItem('techlabs-settings', JSON.stringify(settings1h));
      
      const { unmount } = renderCreateWorkshop();
      
      await waitFor(() => {
        expect(screen.getByText(/All resources will be cleaned up 1 hour after the workshop ends/i)).toBeInTheDocument();
      });
      
      unmount();
      
      // Test plural (2 hours)
      const settings2h = {
        autoCleanup: true,
        cleanupDelay: 2
      };
      localStorage.setItem('techlabs-settings', JSON.stringify(settings2h));
      
      renderCreateWorkshop();
      
      await waitFor(() => {
        expect(screen.getByText(/All resources will be cleaned up 2 hours after the workshop ends/i)).toBeInTheDocument();
      });
    });

    it('should handle malformed settings gracefully', async () => {
      // Set malformed settings
      localStorage.setItem('techlabs-settings', 'invalid-json');
      
      renderCreateWorkshop();
      
      // Should fall back to default 1 hour
      await waitFor(() => {
        expect(screen.getByText(/All resources will be cleaned up 1 hour after the workshop ends/i)).toBeInTheDocument();
      });
    });

    it('should handle missing cleanupDelay property', async () => {
      // Set settings without cleanupDelay property
      const incompleteSettings = {
        autoCleanup: true
        // Missing cleanupDelay
      };
      localStorage.setItem('techlabs-settings', JSON.stringify(incompleteSettings));
      
      renderCreateWorkshop();
      
      // Should fall back to default 1 hour
      await waitFor(() => {
        expect(screen.getByText(/All resources will be cleaned up 1 hour after the workshop ends/i)).toBeInTheDocument();
      });
    });

    it('should update display when settings change during session', async () => {
      // Start with default settings
      renderCreateWorkshop();
      
      await waitFor(() => {
        expect(screen.getByText(/All resources will be cleaned up 1 hour after the workshop ends/i)).toBeInTheDocument();
      });
      
      // Simulate settings change (this would normally happen through Settings page)
      const newSettings = {
        autoCleanup: true,
        cleanupDelay: 4
      };
      localStorage.setItem('techlabs-settings', JSON.stringify(newSettings));
      
      // Trigger a re-render by dispatching storage event
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'techlabs-settings',
        newValue: JSON.stringify(newSettings)
      }));
      
      await waitFor(() => {
        expect(screen.getByText(/All resources will be cleaned up 4 hours after the workshop ends/i)).toBeInTheDocument();
      });
    });
  });
});