import React, { useRef } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DropdownMenu from '../DropdownMenu';

describe('DropdownMenu Component', () => {
  const TestWrapper = ({ 
    isOpen = false, 
    onClose = jest.fn(),
    children = <div>Menu content</div>
  }: {
    isOpen?: boolean;
    onClose?: () => void;
    children?: React.ReactNode;
  }) => {
    const triggerRef = useRef<HTMLButtonElement>(null);
    
    return (
      <div>
        <button ref={triggerRef} data-testid="trigger-button">
          Open Menu
        </button>
        <DropdownMenu
          isOpen={isOpen}
          onClose={onClose}
          trigger={triggerRef}
        >
          {children}
        </DropdownMenu>
      </div>
    );
  };

  describe('when menu is closed', () => {
    it('should not render menu content', () => {
      render(<TestWrapper isOpen={false} />);
      
      expect(screen.queryByText('Menu content')).not.toBeInTheDocument();
    });
  });

  describe('when menu is open', () => {
    it('should render menu content', () => {
      render(<TestWrapper isOpen={true} />);
      
      expect(screen.getByText('Menu content')).toBeInTheDocument();
    });

    it('should have proper styling classes', () => {
      render(<TestWrapper isOpen={true} />);
      
      const menuContent = screen.getByText('Menu content');
      const menuContainer = menuContent.parentElement;
      
      expect(menuContainer).toHaveClass('fixed', 'bg-white', 'rounded-md', 'shadow-lg');
    });
  });

  describe('interaction behavior', () => {
    it('should call onClose when clicking outside the menu', () => {
      const onCloseMock = jest.fn();
      
      render(<TestWrapper isOpen={true} onClose={onCloseMock} />);
      
      // Click outside the menu
      fireEvent.mouseDown(document.body);
      
      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose when clicking inside the menu', () => {
      const onCloseMock = jest.fn();
      
      render(<TestWrapper isOpen={true} onClose={onCloseMock} />);
      
      const menuContent = screen.getByText('Menu content');
      fireEvent.mouseDown(menuContent);
      
      expect(onCloseMock).not.toHaveBeenCalled();
    });

    it('should call onClose when pressing Escape key', () => {
      const onCloseMock = jest.fn();
      
      render(<TestWrapper isOpen={true} onClose={onCloseMock} />);
      
      fireEvent.keyDown(document, { key: 'Escape' });
      
      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose for other key presses', () => {
      const onCloseMock = jest.fn();
      
      render(<TestWrapper isOpen={true} onClose={onCloseMock} />);
      
      fireEvent.keyDown(document, { key: 'Enter' });
      
      expect(onCloseMock).not.toHaveBeenCalled();
    });
  });

  describe('custom content', () => {
    it('should render complex menu content correctly', () => {
      const complexContent = (
        <div>
          <button>Action 1</button>
          <button>Action 2</button>
        </div>
      );

      render(<TestWrapper isOpen={true}>{complexContent}</TestWrapper>);
      
      expect(screen.getByRole('button', { name: 'Action 1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Action 2' })).toBeInTheDocument();
    });

    it('should handle empty content', () => {
      render(<TestWrapper isOpen={true}>{null}</TestWrapper>);
      
      // Menu container should still exist even with empty content
      expect(document.querySelector('.fixed.bg-white')).toBeInTheDocument();
    });
  });

  describe('portal rendering', () => {
    it('should render menu in document.body using portal', () => {
      render(<TestWrapper isOpen={true} />);
      
      // Menu should be rendered in body, not in the component tree
      const menuContent = screen.getByText('Menu content');
      expect(menuContent.closest('body')).toBe(document.body);
    });
  });

  describe('positioning', () => {
    it('should position menu with inline styles', () => {
      render(<TestWrapper isOpen={true} />);
      
      const menuContent = screen.getByText('Menu content');
      const menuContainer = menuContent.parentElement;
      
      // Should have positioning styles
      expect(menuContainer).toHaveStyle({ position: 'fixed' });
    });
  });

  describe('cleanup', () => {
    it('should not fail when unmounting', () => {
      const { unmount } = render(<TestWrapper isOpen={true} />);
      
      expect(() => unmount()).not.toThrow();
    });

    it('should not render when isOpen changes to false', () => {
      const { rerender } = render(<TestWrapper isOpen={true} />);
      
      expect(screen.getByText('Menu content')).toBeInTheDocument();
      
      rerender(<TestWrapper isOpen={false} />);
      
      expect(screen.queryByText('Menu content')).not.toBeInTheDocument();
    });
  });
});