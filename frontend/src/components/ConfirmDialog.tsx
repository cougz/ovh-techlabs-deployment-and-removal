/**
 * ConfirmDialog component for CONFIRM-DIALOG-001
 * Replaces window.confirm() with custom themed confirmation dialog
 */

import React from 'react';
import Modal from './Modal';

export type ConfirmDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  variant?: 'default' | 'warning' | 'danger';
  cancelLabel?: string;
  confirmLabel?: string;
};

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  variant = 'default',
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm'
}) => {
  const getConfirmButtonClass = () => {
    switch (variant) {
      case 'warning':
        return 'btn-warning';
      case 'danger':
        return 'btn-danger';
      default:
        return 'btn-primary';
    }
  };

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

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

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={getConfirmButtonClass()}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;