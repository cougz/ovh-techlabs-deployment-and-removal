/**
 * Tests for ConfirmDialog component
 * Validates CONFIRM-DIALOG-001 confirmation dialog implementation
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ConfirmDialog from '../ConfirmDialog';

describe('ConfirmDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onConfirm: jest.fn(),
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed?',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should render dialog when isOpen is true', () => {
      render(<ConfirmDialog {...defaultProps} />);
      
      expect(screen.getByText('Confirm Action')).toBeInTheDocument();
      expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();
    });

    it('should not render dialog when isOpen is false', () => {
      render(<ConfirmDialog {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByText('Confirm Action')).not.toBeInTheDocument();
      expect(screen.queryByText('Are you sure you want to proceed?')).not.toBeInTheDocument();
    });

    it('should render both Cancel and Confirm buttons', () => {
      render(<ConfirmDialog {...defaultProps} />);
      
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onClose when Cancel button is clicked', () => {
      const onClose = jest.fn();
      render(<ConfirmDialog {...defaultProps} onClose={onClose} />);
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onConfirm when Confirm button is clicked', () => {
      const onConfirm = jest.fn();
      render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);
      
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      fireEvent.click(confirmButton);
      
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when overlay is clicked', () => {
      const onClose = jest.fn();
      render(<ConfirmDialog {...defaultProps} onClose={onClose} />);
      
      const overlay = screen.getByTestId('modal-overlay');
      fireEvent.click(overlay);
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when Escape key is pressed', () => {
      const onClose = jest.fn();
      render(<ConfirmDialog {...defaultProps} onClose={onClose} />);
      
      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Variants', () => {
    it('should apply default styling by default', () => {
      render(<ConfirmDialog {...defaultProps} />);
      
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      expect(confirmButton).toHaveClass('btn-primary');
    });

    it('should apply warning styling for warning variant', () => {
      render(<ConfirmDialog {...defaultProps} variant="warning" />);
      
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      expect(confirmButton).toHaveClass('btn-warning');
    });

    it('should apply danger styling for danger variant', () => {
      render(<ConfirmDialog {...defaultProps} variant="danger" />);
      
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      expect(confirmButton).toHaveClass('btn-danger');
    });
  });

  describe('Button Labels', () => {
    it('should use custom button labels when provided', () => {
      render(
        <ConfirmDialog 
          {...defaultProps} 
          cancelLabel="No, Keep It"
          confirmLabel="Yes, Delete It"
        />
      );
      
      expect(screen.getByRole('button', { name: 'No, Keep It' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Yes, Delete It' })).toBeInTheDocument();
    });

    it('should use default labels when not provided', () => {
      render(<ConfirmDialog {...defaultProps} />);
      
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
    });
  });

  describe('Integration Examples', () => {
    it('should render deploy workshop confirmation correctly', () => {
      render(
        <ConfirmDialog
          isOpen={true}
          onClose={jest.fn()}
          onConfirm={jest.fn()}
          title="Deploy Workshop"
          message="Deploy workshop resources for 2 attendees?"
          variant="default"
          confirmLabel="Deploy"
        />
      );
      
      expect(screen.getByText('Deploy Workshop')).toBeInTheDocument();
      expect(screen.getByText('Deploy workshop resources for 2 attendees?')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Deploy' })).toBeInTheDocument();
    });

    it('should render delete confirmation correctly', () => {
      render(
        <ConfirmDialog
          isOpen={true}
          onClose={jest.fn()}
          onConfirm={jest.fn()}
          title="Delete Workshop"
          message="Are you sure you want to delete this workshop? This action cannot be undone."
          variant="danger"
          confirmLabel="Delete"
        />
      );
      
      expect(screen.getByText('Delete Workshop')).toBeInTheDocument();
      expect(screen.getByText('Are you sure you want to delete this workshop? This action cannot be undone.')).toBeInTheDocument();
      const deleteButton = screen.getByRole('button', { name: 'Delete' });
      expect(deleteButton).toHaveClass('btn-danger');
    });

    it('should render cleanup confirmation correctly', () => {
      render(
        <ConfirmDialog
          isOpen={true}
          onClose={jest.fn()}
          onConfirm={jest.fn()}
          title="Cleanup Resources"
          message="This will destroy all workshop resources. Are you sure?"
          variant="warning"
          confirmLabel="Cleanup"
        />
      );
      
      expect(screen.getByText('Cleanup Resources')).toBeInTheDocument();
      expect(screen.getByText('This will destroy all workshop resources. Are you sure?')).toBeInTheDocument();
      const cleanupButton = screen.getByRole('button', { name: 'Cleanup' });
      expect(cleanupButton).toHaveClass('btn-warning');
    });
  });
});