import React from 'react';
import { InformationCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import type { WorkshopTemplate, WorkshopTemplateName } from '../types';

interface TemplateDropdownProps {
  templates: WorkshopTemplate[];
  selectedTemplate: WorkshopTemplateName;
  onTemplateChange: (template: WorkshopTemplateName) => void;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
}

const TemplateDropdown: React.FC<TemplateDropdownProps> = ({
  templates,
  selectedTemplate,
  onTemplateChange,
  isLoading = false,
  error = null,
  className = ''
}) => {
  const selectedTemplateData = templates.find(t => t.name === selectedTemplate);
  const dropdownId = 'template-dropdown';
  const descriptionId = `${dropdownId}-description`;

  const handleTemplateChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as WorkshopTemplateName;
    onTemplateChange(value);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Label */}
      <label 
        htmlFor={dropdownId} 
        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        Workshop Template *
      </label>

      {/* Dropdown */}
      <select
        id={dropdownId}
        value={selectedTemplate}
        onChange={handleTemplateChange}
        disabled={isLoading || templates.length === 0}
        aria-describedby={descriptionId}
        className={`
          block w-full rounded-md border-gray-300 shadow-sm 
          focus:border-primary-500 focus:ring-primary-500 sm:text-sm
          dark:bg-gray-700 dark:border-gray-600 dark:text-white
          disabled:bg-gray-100 disabled:text-gray-500 dark:disabled:bg-gray-800
          ${error ? 'border-danger-300 focus:border-danger-500 focus:ring-danger-500' : ''}
        `}
      >
        {isLoading ? (
          <option value="">Loading templates...</option>
        ) : templates.length === 0 ? (
          <option value="">No templates available</option>
        ) : (
          templates.map((template) => (
            <option key={template.name} value={template.name}>
              {template.name}
            </option>
          ))
        )}
      </select>

      {/* Loading State */}
      {isLoading && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Loading templates, please wait...
        </p>
      )}

      {/* Error State */}
      {error && (
        <div className="flex items-start space-x-2">
          <ExclamationTriangleIcon className="h-4 w-4 text-danger-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-danger-600 dark:text-danger-400">
            {error}
          </p>
        </div>
      )}

      {/* Template Description */}
      {selectedTemplateData && !isLoading && !error && (
        <div className="bg-primary-50 dark:bg-gray-800 border border-primary-200 dark:border-gray-700 rounded-md p-3">
          <div className="flex items-start space-x-2">
            <InformationCircleIcon className="h-4 w-4 text-primary-500 dark:text-primary-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p id={descriptionId} className="text-sm text-primary-800 dark:text-primary-200">
                {selectedTemplateData.description}
              </p>
              {selectedTemplateData.resources && selectedTemplateData.resources.length > 0 && (
                <p className="text-xs text-primary-700 dark:text-primary-300">
                  Creates: {selectedTemplateData.resources.map(resource => {
                    // Convert resource names to human-readable format
                    return resource.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                  }).join(', ')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Help Text */}
      {!isLoading && !error && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Select a template to configure the workshop resources and deployment settings.
        </p>
      )}
    </div>
  );
};

export default TemplateDropdown;