import React from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface BulkDeleteConfirmationProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  resourceType: string;
  selectedCount: number;
  isDeleting: boolean;
}

const BulkDeleteConfirmation: React.FC<BulkDeleteConfirmationProps> = ({
  isOpen,
  onClose,
  onConfirm,
  resourceType,
  selectedCount,
  isDeleting
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
        <div className="mt-3 text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30">
            <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mt-4">
            Confirm Bulk Deletion
          </h3>
          <div className="mt-2 px-7 py-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Are you sure you want to delete {selectedCount} {resourceType}?
              This action cannot be undone.
            </p>
          </div>
          <div className="items-center px-4 py-3">
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="px-4 py-2 bg-red-600 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
            >
              {isDeleting ? 'Deleting...' : `Delete ${selectedCount} ${resourceType}`}
            </button>
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="mt-3 px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-400 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkDeleteConfirmation;