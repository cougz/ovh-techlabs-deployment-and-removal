// SPDX-FileCopyrightText: 2025 OVHcloud
// SPDX-License-Identifier: MIT

import React, { useState } from 'react';
import Modal from './Modal';

interface EditDeletionDateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (date: string | null) => void;
  currentDate?: string;
  workshopName: string;
  workshopEndDate: string;
}

const EditDeletionDateDialog: React.FC<EditDeletionDateDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  currentDate,
  workshopName,
  workshopEndDate,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(
    currentDate ? new Date(currentDate).toISOString().slice(0, 16) : ''
  );
  const [clearDeletion, setClearDeletion] = useState(false);

  const handleConfirm = () => {
    if (clearDeletion) {
      onConfirm(null);
    } else if (selectedDate) {
      onConfirm(new Date(selectedDate).toISOString());
    }
    onClose();
  };

  const minDate = new Date(workshopEndDate).toISOString().slice(0, 16);
  const now = new Date().toISOString().slice(0, 16);
  const effectiveMinDate = minDate > now ? minDate : now;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Deletion Date">
      <div className="space-y-4">
        
        <div className="mb-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Workshop: <span className="font-medium">{workshopName}</span>
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Workshop ends: {new Date(workshopEndDate).toLocaleString()}
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={clearDeletion}
                onChange={(e) => setClearDeletion(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Clear deletion schedule (prevent automatic cleanup)
              </span>
            </label>
          </div>

          {!clearDeletion && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                New deletion date and time
              </label>
              <input
                type="datetime-local"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={effectiveMinDate}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                         bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Must be after workshop end date and not in the past
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 
                     hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!clearDeletion && !selectedDate}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 
                     hover:bg-blue-700 disabled:bg-gray-400 rounded-md transition-colors"
          >
            Update
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default EditDeletionDateDialog;