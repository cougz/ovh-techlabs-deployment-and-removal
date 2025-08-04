/**
 * useConfirmDialog hook
 * Custom hook for managing ConfirmDialog state and rendering
 */

import React, { useState, useCallback } from 'react';
import ConfirmDialog, { ConfirmDialogProps } from '../components/ConfirmDialog';

type ConfirmDialogConfig = Omit<ConfirmDialogProps, 'isOpen' | 'onClose'>;

type UseConfirmDialogReturn = {
  isOpen: boolean;
  showConfirmDialog: (config: ConfirmDialogConfig) => void;
  hideConfirmDialog: () => void;
  ConfirmDialog: React.FC;
};

const useConfirmDialog = (): UseConfirmDialogReturn => {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<ConfirmDialogConfig | null>(null);

  const showConfirmDialog = useCallback((dialogConfig: ConfirmDialogConfig) => {
    setConfig(dialogConfig);
    setIsOpen(true);
  }, []);

  const hideConfirmDialog = useCallback(() => {
    setIsOpen(false);
    // Clear config after animation completes
    setTimeout(() => setConfig(null), 300);
  }, []);

  const ConfirmDialogComponent: React.FC = useCallback(() => {
    if (!config) return null;

    return (
      <ConfirmDialog
        {...config}
        isOpen={isOpen}
        onClose={hideConfirmDialog}
      />
    );
  }, [config, isOpen, hideConfirmDialog]);

  return {
    isOpen,
    showConfirmDialog,
    hideConfirmDialog,
    ConfirmDialog: ConfirmDialogComponent,
  };
};

export default useConfirmDialog;