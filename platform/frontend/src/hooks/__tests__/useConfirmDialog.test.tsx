/**
 * Tests for useConfirmDialog hook
 * Validates custom hook for ConfirmDialog state management
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import useConfirmDialog from '../useConfirmDialog';

describe('useConfirmDialog', () => {
  describe('Hook Interface', () => {
    it('should return correct interface', () => {
      const { result } = renderHook(() => useConfirmDialog());
      
      expect(result.current).toHaveProperty('isOpen');
      expect(result.current).toHaveProperty('showConfirmDialog');
      expect(result.current).toHaveProperty('hideConfirmDialog');
      expect(result.current).toHaveProperty('ConfirmDialog');
      
      expect(typeof result.current.isOpen).toBe('boolean');
      expect(typeof result.current.showConfirmDialog).toBe('function');
      expect(typeof result.current.hideConfirmDialog).toBe('function');
      expect(typeof result.current.ConfirmDialog).toBe('function');
    });

    it('should start with dialog closed', () => {
      const { result } = renderHook(() => useConfirmDialog());
      
      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('State Management', () => {
    it('should open dialog when showConfirmDialog is called', () => {
      const { result } = renderHook(() => useConfirmDialog());
      
      act(() => {
        result.current.showConfirmDialog({
          title: 'Test',
          message: 'Test message',
          onConfirm: jest.fn(),
        });
      });
      
      expect(result.current.isOpen).toBe(true);
    });

    it('should close dialog when hideConfirmDialog is called', () => {
      const { result } = renderHook(() => useConfirmDialog());
      
      // Open dialog first
      act(() => {
        result.current.showConfirmDialog({
          title: 'Test',
          message: 'Test message',
          onConfirm: jest.fn(),
        });
      });
      
      expect(result.current.isOpen).toBe(true);
      
      // Close dialog
      act(() => {
        result.current.hideConfirmDialog();
      });
      
      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('ConfirmDialog Component', () => {
    const TestComponent: React.FC = () => {
      const { ConfirmDialog, showConfirmDialog } = useConfirmDialog();
      
      const handleClick = () => {
        showConfirmDialog({
          title: 'Delete Item',
          message: 'Are you sure you want to delete this item?',
          onConfirm: jest.fn(),
          variant: 'danger',
          confirmLabel: 'Delete',
        });
      };
      
      return (
        <div>
          <button onClick={handleClick}>Show Dialog</button>
          <ConfirmDialog />
        </div>
      );
    };

    it('should render dialog with correct props when shown', () => {
      render(<TestComponent />);
      
      const showButton = screen.getByText('Show Dialog');
      fireEvent.click(showButton);
      
      expect(screen.getByText('Delete Item')).toBeInTheDocument();
      expect(screen.getByText('Are you sure you want to delete this item?')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });

    it('should call onConfirm when confirm button is clicked', () => {
      const onConfirm = jest.fn();
      
      const TestComponentWithCallback: React.FC = () => {
        const { ConfirmDialog, showConfirmDialog } = useConfirmDialog();
        
        const handleClick = () => {
          showConfirmDialog({
            title: 'Test',
            message: 'Test message',
            onConfirm,
          });
        };
        
        return (
          <div>
            <button onClick={handleClick}>Show Dialog</button>
            <ConfirmDialog />
          </div>
        );
      };

      render(<TestComponentWithCallback />);
      
      const showButton = screen.getByText('Show Dialog');
      fireEvent.click(showButton);
      
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      fireEvent.click(confirmButton);
      
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('should close dialog after confirmation', () => {
      const TestComponentWithState: React.FC = () => {
        const { ConfirmDialog, showConfirmDialog, isOpen } = useConfirmDialog();
        
        const handleClick = () => {
          showConfirmDialog({
            title: 'Test',
            message: 'Test message',
            onConfirm: jest.fn(),
          });
        };
        
        return (
          <div>
            <button onClick={handleClick}>Show Dialog</button>
            <div>Dialog is {isOpen ? 'open' : 'closed'}</div>
            <ConfirmDialog />
          </div>
        );
      };

      render(<TestComponentWithState />);
      
      // Initially closed
      expect(screen.getByText('Dialog is closed')).toBeInTheDocument();
      
      // Show dialog
      const showButton = screen.getByText('Show Dialog');
      fireEvent.click(showButton);
      
      expect(screen.getByText('Dialog is open')).toBeInTheDocument();
      
      // Confirm and close
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      fireEvent.click(confirmButton);
      
      expect(screen.getByText('Dialog is closed')).toBeInTheDocument();
    });
  });

  describe('Integration Patterns', () => {
    it('should work with deployment confirmation pattern', () => {
      const deployWorkshop = jest.fn();
      
      const DeploymentComponent: React.FC = () => {
        const { ConfirmDialog, showConfirmDialog } = useConfirmDialog();
        
        const handleDeploy = () => {
          showConfirmDialog({
            title: 'Deploy Workshop',
            message: 'Deploy workshop resources for 2 attendees?',
            onConfirm: deployWorkshop,
            variant: 'default',
            confirmLabel: 'Deploy',
          });
        };
        
        return (
          <div>
            <button onClick={handleDeploy}>Deploy Workshop</button>
            <ConfirmDialog />
          </div>
        );
      };

      render(<DeploymentComponent />);
      
      // Trigger deployment
      const deployButton = screen.getByText('Deploy Workshop');
      fireEvent.click(deployButton);
      
      // Verify dialog content
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Deploy workshop resources for 2 attendees?')).toBeInTheDocument();
      
      // Confirm deployment
      const confirmButton = screen.getByRole('button', { name: 'Deploy' });
      fireEvent.click(confirmButton);
      
      expect(deployWorkshop).toHaveBeenCalledTimes(1);
    });
  });
});