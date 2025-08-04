/**
 * NotificationDialog component for POPUP-REPLACEMENT-001
 * Replaces alert() with custom themed notification dialog
 */

import React, { useEffect, useRef } from 'react';
import Modal from './Modal';

export type NotificationDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  buttonLabel?: string;
};

const NotificationDialog: React.FC<NotificationDialogProps> = ({
  isOpen,
  onClose,
  title,
  message,
  type,
  buttonLabel = 'OK'
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);

  const getButtonClass = () => {
    switch (type) {
      case 'success':
        return 'btn-success';
      case 'error':
        return 'btn-danger';
      case 'warning':
        return 'btn-warning';
      default:
        return 'btn-primary';
    }
  };

  // Focus the button when dialog opens
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      buttonRef.current.focus();
    }
  }, [isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
    >
      <div className="space-y-4">
        {/* Message */}
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          {message}
        </p>

        {/* Action */}
        <div className="flex justify-end pt-4">
          <button
            ref={buttonRef}
            type="button"
            onClick={onClose}
            className={getButtonClass()}
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default NotificationDialog;