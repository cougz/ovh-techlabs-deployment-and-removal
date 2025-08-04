/**
 * Tests for NotificationDialog component - POPUP-REPLACEMENT-001
 * Tests notification dialog for success, error, and warning messages
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import NotificationDialog from '../NotificationDialog';

describe('NotificationDialog', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should not render when closed', () => {
      render(
        <NotificationDialog
          isOpen={false}
          onClose={mockOnClose}
          title="Test"
          message="Test message"
          type="success"
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render when open', () => {
      render(
        <NotificationDialog
          isOpen={true}
          onClose={mockOnClose}
          title="Success"
          message="Settings saved successfully!"
          type="success"
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Success')).toBeInTheDocument();
      expect(screen.getByText('Settings saved successfully!')).toBeInTheDocument();
    });

    it('should render with custom button label', () => {
      render(
        <NotificationDialog
          isOpen={true}
          onClose={mockOnClose}
          title="Error"
          message="Something went wrong"
          type="error"
          buttonLabel="Try Again"
        />
      );

      expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
    });

    it('should render with default button label', () => {
      render(
        <NotificationDialog
          isOpen={true}
          onClose={mockOnClose}
          title="Info"
          message="Info message"
          type="info"
        />
      );

      expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
    });
  });

  describe('Types and Styling', () => {
    it('should apply success styling', () => {
      render(
        <NotificationDialog
          isOpen={true}
          onClose={mockOnClose}
          title="Success"
          message="Success message"
          type="success"
        />
      );

      const button = screen.getByRole('button', { name: 'OK' });
      expect(button).toHaveClass('btn-success');
    });

    it('should apply error styling', () => {
      render(
        <NotificationDialog
          isOpen={true}
          onClose={mockOnClose}
          title="Error"
          message="Error message"
          type="error"
        />
      );

      const button = screen.getByRole('button', { name: 'OK' });
      expect(button).toHaveClass('btn-danger');
    });

    it('should apply warning styling', () => {
      render(
        <NotificationDialog
          isOpen={true}
          onClose={mockOnClose}
          title="Warning"
          message="Warning message"
          type="warning"
        />
      );

      const button = screen.getByRole('button', { name: 'OK' });
      expect(button).toHaveClass('btn-warning');
    });

    it('should apply info styling as default', () => {
      render(
        <NotificationDialog
          isOpen={true}
          onClose={mockOnClose}
          title="Info"
          message="Info message"
          type="info"
        />
      );

      const button = screen.getByRole('button', { name: 'OK' });
      expect(button).toHaveClass('btn-primary');
    });
  });

  describe('Interactions', () => {
    it('should call onClose when button clicked', () => {
      render(
        <NotificationDialog
          isOpen={true}
          onClose={mockOnClose}
          title="Test"
          message="Test message"
          type="success"
        />
      );

      const button = screen.getByRole('button', { name: 'OK' });
      fireEvent.click(button);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when close button clicked', () => {
      render(
        <NotificationDialog
          isOpen={true}
          onClose={mockOnClose}
          title="Test"
          message="Test message"
          type="success"
        />
      );

      const closeButton = screen.getByLabelText('Close modal');
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when overlay clicked', () => {
      render(
        <NotificationDialog
          isOpen={true}
          onClose={mockOnClose}
          title="Test"
          message="Test message"
          type="success"
        />
      );

      const overlay = screen.getByTestId('modal-overlay');
      fireEvent.click(overlay);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when Escape key pressed', () => {
      render(
        <NotificationDialog
          isOpen={true}
          onClose={mockOnClose}
          title="Test"
          message="Test message"
          type="success"
        />
      );

      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(
        <NotificationDialog
          isOpen={true}
          onClose={mockOnClose}
          title="Test Notification"
          message="Test message"
          type="success"
        />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby');
      
      const titleId = dialog.getAttribute('aria-labelledby');
      expect(screen.getByText('Test Notification')).toHaveAttribute('id', titleId);
    });

    it('should focus on the OK button when opened', () => {
      render(
        <NotificationDialog
          isOpen={true}
          onClose={mockOnClose}
          title="Test"
          message="Test message"
          type="success"
        />
      );

      const button = screen.getByRole('button', { name: 'OK' });
      expect(button).toHaveFocus();
    });
  });
});