import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Settings from '../Settings';
import { settingsApi } from '../../services/api';

// Mock the settings API  
jest.mock('../../services/api', () => ({
  settingsApi: {
    getLoginPrefixConfig: jest.fn(),
    setLoginPrefixConfig: jest.fn(),
  },
}));

const mockSettingsApi = settingsApi as jest.Mocked<typeof settingsApi>;

const renderComponent = () => {
  return render(
    <BrowserRouter>
      <Settings />
    </BrowserRouter>
  );
};

describe('Settings - Refactored Page', () => {
  beforeEach(() => {
    // Mock localStorage for persistence testing
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn().mockReturnValue(null),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      },
      writable: true,
    });

    // Mock API responses
    mockSettingsApi.getLoginPrefixConfig.mockResolvedValue({
      login_prefix: '',
      export_format: 'OVHcloud Login'
    });
    mockSettingsApi.setLoginPrefixConfig.mockResolvedValue(undefined);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should not show Security, Notifications, or Terraform tab sections', () => {
    renderComponent();
    
    // Should NOT show other tab sections
    expect(screen.queryByText('Security')).not.toBeInTheDocument();
    expect(screen.queryByText('Notifications')).not.toBeInTheDocument();
    expect(screen.queryByText('Terraform')).not.toBeInTheDocument();
    
    // Should show the general content directly (no tabs)
    expect(screen.getByText('Workshop Management')).toBeInTheDocument();
  });

  it('should show Default Cleanup Delay setting in General tab', () => {
    renderComponent();
    
    // Should show cleanup delay setting
    expect(screen.getByLabelText(/cleanup delay/i)).toBeInTheDocument();
    expect(screen.getByText(/time to wait after workshop end before cleanup/i)).toBeInTheDocument();
  });

  it('should not show removed General settings like max workshops or default region', () => {
    renderComponent();
    
    // Should NOT show these removed settings
    expect(screen.queryByText(/max concurrent workshops/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/max attendees per workshop/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/default ovh region/i)).not.toBeInTheDocument();
  });

  it('should show auto-cleanup toggle setting', () => {
    renderComponent();
    
    // Should show auto-cleanup setting
    expect(screen.getByText(/auto-cleanup workshops/i)).toBeInTheDocument();
    expect(screen.getByText(/automatically delete workshop resources after completion/i)).toBeInTheDocument();
  });

  it('should allow changing cleanup delay value', () => {
    renderComponent();
    
    const cleanupDelayInput = screen.getByLabelText(/cleanup delay/i);
    expect(cleanupDelayInput).toHaveValue(72);
    
    // Change value
    fireEvent.change(cleanupDelayInput, { target: { value: '48' } });
    
    expect(cleanupDelayInput).toHaveValue(48);
  });

  it('should allow toggling auto-cleanup setting', () => {
    renderComponent();
    
    const autoCleanupCheckbox = screen.getByRole('checkbox');
    expect(autoCleanupCheckbox).toBeChecked();
    
    // Toggle off
    fireEvent.click(autoCleanupCheckbox);
    expect(autoCleanupCheckbox).not.toBeChecked();
    
    // Toggle back on
    fireEvent.click(autoCleanupCheckbox);
    expect(autoCleanupCheckbox).toBeChecked();
  });

  it('should show save settings button', () => {
    renderComponent();
    
    const saveButton = screen.getByText('Save Settings');
    expect(saveButton).toBeInTheDocument();
    expect(saveButton.tagName).toBe('BUTTON');
  });

  it('should show success confirmation when settings are saved', async () => {
    renderComponent();
    
    const saveButton = screen.getByText('Save Settings');
    
    fireEvent.click(saveButton);
    
    // Should show success confirmation via custom notification dialog
    await waitFor(() => {
      expect(screen.getByText('Settings Saved')).toBeInTheDocument();
      expect(screen.getByText('Settings saved successfully!')).toBeInTheDocument();
    });
  });

  it('should persist settings to localStorage when saved', async () => {
    const mockSetItem = jest.fn();
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn().mockReturnValue(null),
        setItem: mockSetItem,
        removeItem: jest.fn(),
        clear: jest.fn(),
      },
      writable: true,
    });

    renderComponent();
    
    const cleanupDelayInput = screen.getByLabelText(/cleanup delay/i);
    fireEvent.change(cleanupDelayInput, { target: { value: '96' } });
    
    const saveButton = screen.getByText('Save Settings');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(mockSetItem).toHaveBeenCalledWith(
        'techlabs-settings',
        expect.stringContaining('"cleanupDelay":96')
      );
    });
  });

  it('should load saved settings from localStorage on mount', () => {
    // Mock localStorage with saved settings
    const savedSettings = JSON.stringify({
      autoCleanup: false,
      cleanupDelay: 120
    });
    
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn().mockReturnValue(savedSettings),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      },
      writable: true,
    });
    
    renderComponent();
    
    // Should load the saved values
    const cleanupDelayInput = screen.getByLabelText(/cleanup delay/i);
    const autoCleanupCheckbox = screen.getByRole('checkbox');
    
    expect(cleanupDelayInput).toHaveValue(120);
    expect(autoCleanupCheckbox).not.toBeChecked();
  });

  it('should not show tab navigation since there is only one tab', () => {
    renderComponent();
    
    // Should not show tab navigation when there's only one tab
    const tabNavigation = screen.queryByRole('tablist');
    expect(tabNavigation).not.toBeInTheDocument();
  });

  it('should have proper page title and description', () => {
    renderComponent();
    
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Configure application settings and preferences')).toBeInTheDocument();
  });
});