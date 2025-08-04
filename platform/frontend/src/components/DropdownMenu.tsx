import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface DropdownPosition {
  top: number;
  left: number;
  transformOrigin: string;
}

interface DropdownMenuProps {
  isOpen: boolean;
  onClose: () => void;
  trigger: React.RefObject<HTMLElement>;
  children: React.ReactNode;
  className?: string;
  offset?: { x: number; y: number };
}

const DropdownMenu: React.FC<DropdownMenuProps> = ({
  isOpen,
  onClose,
  trigger,
  children,
  className = '',
  offset = { x: 0, y: 8 }
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<DropdownPosition>({ top: 0, left: 0, transformOrigin: 'top right' });

  const calculatePosition = useCallback(() => {
    if (!trigger.current || !menuRef.current) return;

    const triggerRect = trigger.current.getBoundingClientRect();
    const menuRect = menuRef.current.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY
    };

    // Start with default position (bottom-right of trigger)
    let top = triggerRect.bottom + viewport.scrollY + offset.y;
    let left = triggerRect.right + viewport.scrollX - menuRect.width + offset.x;
    let transformOrigin = 'top right';

    // Check if menu would go off the right edge
    if (left < viewport.scrollX + 16) {
      // Flip to left-aligned
      left = triggerRect.left + viewport.scrollX + offset.x;
      transformOrigin = 'top left';
    }

    // Check if menu would go off the bottom edge
    if (top + menuRect.height > viewport.scrollY + viewport.height - 16) {
      // Flip to top
      top = triggerRect.top + viewport.scrollY - menuRect.height - offset.y;
      transformOrigin = transformOrigin.replace('top', 'bottom');
    }

    // Ensure menu doesn't go off the left edge
    if (left < viewport.scrollX + 16) {
      left = viewport.scrollX + 16;
    }

    // Ensure menu doesn't go off the right edge
    if (left + menuRect.width > viewport.scrollX + viewport.width - 16) {
      left = viewport.scrollX + viewport.width - menuRect.width - 16;
    }

    // Ensure menu doesn't go off the top edge
    if (top < viewport.scrollY + 16) {
      top = viewport.scrollY + 16;
    }

    setPosition({ top, left, transformOrigin });
  }, [trigger, offset]);

  // Calculate position when menu opens or window resizes
  useEffect(() => {
    if (!isOpen) return;
    
    calculatePosition();
    
    const handleResize = () => calculatePosition();
    const handleScroll = () => calculatePosition();
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen, calculatePosition]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        trigger.current &&
        !menuRef.current.contains(event.target as Node) &&
        !trigger.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose, trigger]);

  if (!isOpen) return null;

  const menu = (
    <div
      ref={menuRef}
      className={`fixed bg-white dark:bg-slate-800 rounded-md shadow-lg border border-gray-200 dark:border-slate-600 z-50 min-w-48 ${className}`}
      style={{
        top: position.top,
        left: position.left,
        transformOrigin: position.transformOrigin,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );

  // Render in portal to escape container overflow
  return createPortal(menu, document.body);
};

export default DropdownMenu;