/**
 * Test for Settings page notification modal integration
 * Verifies that native alert() calls have been replaced with custom NotificationDialog
 */

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

describe('Settings - NotificationDialog Integration', () => {
  beforeEach(() => {
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn().mockReturnValue(null),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      },
      writable: true,
    });

    // Mock successful API responses
    mockSettingsApi.getLoginPrefixConfig.mockResolvedValue({
      login_prefix: '',
      export_format: 'OVHcloud Login'
    });
    mockSettingsApi.setLoginPrefixConfig.mockResolvedValue(undefined);

    // Mock window.alert to ensure it's NOT called
    jest.spyOn(window, 'alert').mockImplementation(() => {});

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should show success notification dialog instead of native alert on successful save', async () => {
    renderComponent();
    
    const saveButton = screen.getByText('Save Settings');
    fireEvent.click(saveButton);
    
    // Wait for save operation to complete
    await waitFor(() => {
      // Should show custom notification dialog with success message
      expect(screen.getByText('Settings Saved')).toBeInTheDocument();
      expect(screen.getByText('Settings saved successfully!')).toBeInTheDocument();
    });

    // Should NOT call native alert
    expect(window.alert).not.toHaveBeenCalled();

    // Should show the modal overlay and proper structure
    const modalOverlay = screen.getByTestId('modal-overlay');
    expect(modalOverlay).toBeInTheDocument();
    expect(modalOverlay).toHaveClass('fixed', 'inset-0', 'z-50');
  });

  it('should show error notification dialog instead of native alert on save failure', async () => {
    // Mock API failure
    const errorMessage = 'Network error occurred';
    mockSettingsApi.setLoginPrefixConfig.mockRejectedValue(new Error(errorMessage));
    
    renderComponent();
    
    const saveButton = screen.getByText('Save Settings');
    fireEvent.click(saveButton);
    
    // Wait for save operation to complete
    await waitFor(() => {
      // Should show custom notification dialog with error message
      expect(screen.getByText('Save Failed')).toBeInTheDocument();
      expect(screen.getByText(`Failed to save settings: ${errorMessage}`)).toBeInTheDocument();
    });

    // Should NOT call native alert
    expect(window.alert).not.toHaveBeenCalled();

    // Should show the modal overlay and proper structure
    const modalOverlay = screen.getByTestId('modal-overlay');
    expect(modalOverlay).toBeInTheDocument();
    expect(modalOverlay).toHaveClass('fixed', 'inset-0', 'z-50');
  });

  it('should close notification dialog when OK button is clicked', async () => {
    renderComponent();
    
    const saveButton = screen.getByText('Save Settings');
    fireEvent.click(saveButton);
    
    // Wait for notification to appear
    await waitFor(() => {
      expect(screen.getByText('Settings Saved')).toBeInTheDocument();
    });

    // Click OK button to close dialog
    const okButton = screen.getByText('OK');
    fireEvent.click(okButton);

    // Dialog should disappear
    await waitFor(() => {
      expect(screen.queryByText('Settings Saved')).not.toBeInTheDocument();
      expect(screen.queryByTestId('modal-overlay')).not.toBeInTheDocument();
    });
  });

  it('should close notification dialog when clicking outside modal', async () => {
    renderComponent();
    
    const saveButton = screen.getByText('Save Settings');
    fireEvent.click(saveButton);
    
    // Wait for notification to appear
    await waitFor(() => {
      expect(screen.getByText('Settings Saved')).toBeInTheDocument();
    });

    // Click on overlay to close dialog
    const modalOverlay = screen.getByTestId('modal-overlay');
    fireEvent.click(modalOverlay);

    // Dialog should disappear
    await waitFor(() => {
      expect(screen.queryByText('Settings Saved')).not.toBeInTheDocument();
      expect(screen.queryByTestId('modal-overlay')).not.toBeInTheDocument();
    });
  });

  it('should close notification dialog when pressing Escape key', async () => {
    renderComponent();
    
    const saveButton = screen.getByText('Save Settings');
    fireEvent.click(saveButton);
    
    // Wait for notification to appear
    await waitFor(() => {
      expect(screen.getByText('Settings Saved')).toBeInTheDocument();
    });

    // Press Escape key
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

    // Dialog should disappear
    await waitFor(() => {
      expect(screen.queryByText('Settings Saved')).not.toBeInTheDocument();
      expect(screen.queryByTestId('modal-overlay')).not.toBeInTheDocument();
    });
  });

  it('should show proper button styling for success notification', async () => {
    renderComponent();
    
    const saveButton = screen.getByText('Save Settings');
    fireEvent.click(saveButton);
    
    // Wait for notification to appear
    await waitFor(() => {
      expect(screen.getByText('Settings Saved')).toBeInTheDocument();
    });

    // Should show success button styling
    const okButton = screen.getByText('OK');
    expect(okButton).toHaveClass('btn-success');
  });

  it('should show proper button styling for error notification', async () => {
    // Mock API failure
    mockSettingsApi.setLoginPrefixConfig.mockRejectedValue(new Error('Test error'));
    
    renderComponent();
    
    const saveButton = screen.getByText('Save Settings');
    fireEvent.click(saveButton);
    
    // Wait for notification to appear
    await waitFor(() => {
      expect(screen.getByText('Save Failed')).toBeInTheDocument();
    });

    // Should show error button styling
    const okButton = screen.getByText('OK');
    expect(okButton).toHaveClass('btn-danger');
  });

  it('should handle unknown error types properly in notification', async () => {
    // Mock API failure with non-Error object
    mockSettingsApi.setLoginPrefixConfig.mockRejectedValue('String error');
    
    renderComponent();
    
    const saveButton = screen.getByText('Save Settings');
    fireEvent.click(saveButton);
    
    // Wait for notification to appear
    await waitFor(() => {
      expect(screen.getByText('Save Failed')).toBeInTheDocument();
      expect(screen.getByText('Failed to save settings: Unknown error')).toBeInTheDocument();
    });

    // Should NOT call native alert
    expect(window.alert).not.toHaveBeenCalled();
  });

  it('should maintain saving state during notification display', async () => {
    renderComponent();
    
    const saveButton = screen.getByText('Save Settings');
    
    // Button should initially say "Save Settings"
    expect(saveButton).toHaveTextContent('Save Settings');
    
    fireEvent.click(saveButton);
    
    // While saving, button should show "Saving..."
    expect(saveButton).toHaveTextContent('Saving...');
    expect(saveButton).toBeDisabled();
    
    // Wait for save to complete and notification to appear
    await waitFor(() => {
      expect(screen.getByText('Settings Saved')).toBeInTheDocument();
    });
    
    // After save completes, button should return to normal state
    expect(saveButton).toHaveTextContent('Save Settings');
    expect(saveButton).not.toBeDisabled();
  });
});