/**
 * Tests for useNotificationDialog hook - POPUP-REPLACEMENT-001
 * Tests notification dialog hook for managing notification state
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import useNotificationDialog from '../useNotificationDialog';

// Test component to use the hook
const TestComponent: React.FC = () => {
  const { NotificationDialog, showNotification } = useNotificationDialog();

  return (
    <div>
      <button 
        onClick={() => showNotification({
          title: 'Success',
          message: 'Settings saved successfully!',
          type: 'success'
        })}
      >
        Show Success
      </button>
      <button 
        onClick={() => showNotification({
          title: 'Error',
          message: 'Something went wrong',
          type: 'error',
          buttonLabel: 'Retry'
        })}
      >
        Show Error
      </button>
      <button 
        onClick={() => showNotification({
          title: 'Warning',
          message: 'Please fill in all fields',
          type: 'warning'
        })}
      >
        Show Warning
      </button>
      <NotificationDialog />
    </div>
  );
};

describe('useNotificationDialog', () => {
  it('should initially not show dialog', () => {
    render(<TestComponent />);
    
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should show success notification when called', () => {
    render(<TestComponent />);
    
    const showButton = screen.getByText('Show Success');
    fireEvent.click(showButton);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getByText('Settings saved successfully!')).toBeInTheDocument();
  });

  it('should show error notification with custom button label', () => {
    render(<TestComponent />);
    
    const showButton = screen.getByText('Show Error');
    fireEvent.click(showButton);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('should show warning notification', () => {
    render(<TestComponent />);
    
    const showButton = screen.getByText('Show Warning');
    fireEvent.click(showButton);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Warning')).toBeInTheDocument();
    expect(screen.getByText('Please fill in all fields')).toBeInTheDocument();
  });

  it('should close dialog when OK button clicked', () => {
    render(<TestComponent />);
    
    const showButton = screen.getByText('Show Success');
    fireEvent.click(showButton);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const okButton = screen.getByRole('button', { name: 'OK' });
    fireEvent.click(okButton);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should close dialog when close button clicked', () => {
    render(<TestComponent />);
    
    const showButton = screen.getByText('Show Success');
    fireEvent.click(showButton);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const closeButton = screen.getByLabelText('Close modal');
    fireEvent.click(closeButton);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should close dialog when Escape key pressed', () => {
    render(<TestComponent />);
    
    const showButton = screen.getByText('Show Success');
    fireEvent.click(showButton);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should replace previous notification with new one', () => {
    render(<TestComponent />);
    
    // Show success first
    const successButton = screen.getByText('Show Success');
    fireEvent.click(successButton);

    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getByText('Settings saved successfully!')).toBeInTheDocument();

    // Show error - should replace success
    const errorButton = screen.getByText('Show Error');
    fireEvent.click(errorButton);

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.queryByText('Success')).not.toBeInTheDocument();
  });
});