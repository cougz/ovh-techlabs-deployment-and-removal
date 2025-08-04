import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

interface DropdownPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  transformOrigin: string;
}

const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  options,
  placeholder = "Select...",
  className = "",
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<DropdownPosition>({ 
    top: 0, 
    left: 0, 
    width: 0, 
    maxHeight: 200,
    transformOrigin: 'top left' 
  });
  
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY
    };

    let top = triggerRect.bottom + viewport.scrollY + 4;
    let left = triggerRect.left + viewport.scrollX;
    let maxHeight = 200;
    let transformOrigin = 'top left';

    // Check if dropdown would go off the bottom edge
    if (top + maxHeight > viewport.scrollY + viewport.height - 16) {
      // Flip to top
      top = triggerRect.top + viewport.scrollY - 4;
      maxHeight = Math.min(200, triggerRect.top - 16);
      transformOrigin = 'bottom left';
      
      // If still not enough space, position at top with scroll
      if (maxHeight < 100) {
        top = viewport.scrollY + 16;
        maxHeight = triggerRect.top - 32;
        transformOrigin = 'top left';
      }
    }

    // Check if dropdown would go off the right edge
    if (left + triggerRect.width > viewport.scrollX + viewport.width - 16) {
      left = viewport.scrollX + viewport.width - triggerRect.width - 16;
    }

    // Ensure dropdown doesn't go off the left edge
    if (left < viewport.scrollX + 16) {
      left = viewport.scrollX + 16;
    }

    setPosition({
      top,
      left,
      width: triggerRect.width,
      maxHeight,
      transformOrigin
    });
  }, []);

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

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        triggerRef.current &&
        dropdownRef.current &&
        !triggerRef.current.contains(event.target as Node) &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const selectedOption = options.find(option => option.value === value);

  const handleOptionClick = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const dropdown = isOpen ? (
    <div
      ref={dropdownRef}
      className="fixed bg-white rounded-md shadow-lg border border-gray-200 z-50 py-1"
      style={{
        top: position.top,
        left: position.left,
        width: position.width,
        maxHeight: position.maxHeight,
        transformOrigin: position.transformOrigin,
      }}
    >
      <div className="max-h-full overflow-auto">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => handleOptionClick(option.value)}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 focus:bg-gray-50 focus:outline-none ${
              option.value === value ? 'bg-primary-50 text-primary-700' : 'text-gray-900'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`relative w-full rounded-md border border-gray-300 bg-white py-2 pl-3 pr-10 text-left shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 sm:text-sm ${
          disabled ? 'cursor-not-allowed bg-gray-50 text-gray-500' : 'cursor-pointer'
        } ${className}`}
      >
        <span className="block truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
          <ChevronDownIcon
            className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </span>
      </button>
      
      {dropdown && createPortal(dropdown, document.body)}
    </>
  );
};

export default Select;