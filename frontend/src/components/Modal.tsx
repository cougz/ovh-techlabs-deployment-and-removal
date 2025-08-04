/**
 * Modal component for MODAL-SYSTEM-001
 * Replaces browser native dialogs with custom themed modal
 */

import React, { useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

export type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
};

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children
}) => {
  // Handle Escape key press
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      // Restore body scroll
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const modalId = `modal-${title.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      data-testid="modal-overlay"
      onClick={handleOverlayClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity duration-300" />
      
      {/* Modal Content */}
      <div
        role="dialog"
        aria-labelledby={modalId}
        className="modal-content relative z-10 w-full max-w-md mx-4 bg-white dark:bg-slate-800 rounded-lg shadow-xl transform transition-all duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-600">
          <h3 
            id={modalId}
            className="text-lg font-semibold text-gray-900 dark:text-gray-100"
          >
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="modal-close p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors duration-200"
            aria-label="Close modal"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;