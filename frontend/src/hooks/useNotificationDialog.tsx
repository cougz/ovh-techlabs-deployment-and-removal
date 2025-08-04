/**
 * useNotificationDialog hook for POPUP-REPLACEMENT-001
 * Custom hook for managing notification dialog state
 */

import React, { useState, useCallback } from 'react';
import NotificationDialog from '../components/NotificationDialog';

type NotificationOptions = {
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  buttonLabel?: string;
};

type UseNotificationDialogReturn = {
  showNotification: (options: NotificationOptions) => void;
  hideNotification: () => void;
  NotificationDialog: React.FC;
};

const useNotificationDialog = (): UseNotificationDialogReturn => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<NotificationOptions>({
    title: '',
    message: '',
    type: 'info'
  });

  const showNotification = useCallback((notificationOptions: NotificationOptions) => {
    setOptions(notificationOptions);
    setIsOpen(true);
  }, []);

  const hideNotification = useCallback(() => {
    setIsOpen(false);
  }, []);

  const NotificationDialogComponent: React.FC = useCallback(() => {
    return (
      <NotificationDialog
        isOpen={isOpen}
        onClose={hideNotification}
        title={options.title}
        message={options.message}
        type={options.type}
        buttonLabel={options.buttonLabel}
      />
    );
  }, [isOpen, options, hideNotification]);

  return {
    showNotification,
    hideNotification,
    NotificationDialog: NotificationDialogComponent
  };
};

export default useNotificationDialog;