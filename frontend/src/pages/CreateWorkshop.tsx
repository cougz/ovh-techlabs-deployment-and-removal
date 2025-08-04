import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import {
  CalendarIcon,
  ClockIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';

import { workshopApi, attendeeApi, templateApi } from '../services/api';
import { CreateWorkshopRequest, CreateAttendeeRequest, WorkshopTemplateName } from '../types';
import TemplateDropdown from '../components/TemplateDropdown';
import { parseCsvAttendees, validateAttendeeData, CsvAttendeeData, CsvParseError, CsvValidationError } from '../utils/csvImport';
import { WorkshopTemplateNameSchema } from '../types/schemas';

interface FormData {
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  timezone: string;
  template: WorkshopTemplateName;
}

interface FormErrors {
  name?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  timezone?: string;
  template?: string;
  general?: string;
  csv?: string;
}

interface BulkImportProgress {
  isImporting: boolean;
  completed: number;
  total: number;
  errors: Array<{ attendee: string; error: string }>;
}

const CreateWorkshop: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Load available templates
  const {
    data: templates = [],
    isLoading: templatesLoading,
    error: templatesError
  } = useQuery('templates', templateApi.listTemplates, {
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    timezone: 'UTC',
    template: 'Generic'
  });
  
  const [errors, setErrors] = useState<FormErrors>({});
  const [isBulkImport, setIsBulkImport] = useState(false);
  const [csvData, setCsvData] = useState('');
  const [parsedAttendees, setParsedAttendees] = useState<CsvAttendeeData[]>([]);
  const [csvErrors, setCsvErrors] = useState<(CsvParseError | CsvValidationError)[]>([]);
  const [bulkImportProgress, setBulkImportProgress] = useState<BulkImportProgress>({
    isImporting: false,
    completed: 0,
    total: 0,
    errors: []
  });
  const [cleanupDelay, setCleanupDelay] = useState<number>(1); // Default 1 hour

  const createWorkshopMutation = useMutation(
    (data: CreateWorkshopRequest) => workshopApi.createWorkshop(data),
    {
      onSuccess: async (workshop) => {
        queryClient.invalidateQueries('workshops');
        
        // Handle bulk import if enabled
        if (isBulkImport && parsedAttendees.length > 0) {
          await handleBulkAttendeeCreation(workshop.id);
        }
        
        navigate(`/workshops/${workshop.id}`);
      },
      onError: (error: any) => {
        console.error('Failed to create workshop:', error);
        setErrors({
          general: error.response?.data?.detail || 'Failed to create workshop. Please try again.'
        });
      }
    }
  );

  const handleCsvDataChange = (value: string) => {
    setCsvData(value);
    
    if (!value.trim()) {
      setParsedAttendees([]);
      setCsvErrors([]);
      // Clear CSV errors when empty
      if (errors.csv) {
        setErrors(prev => ({ ...prev, csv: undefined }));
      }
      return;
    }
    
    const parseResult = parseCsvAttendees(value);
    
    if (!parseResult.success) {
      setCsvErrors(parseResult.errors);
      setParsedAttendees([]);
      return;
    }
    
    const validationResult = validateAttendeeData(parseResult.data);
    
    if (!validationResult.success) {
      setCsvErrors(validationResult.errors);
      setParsedAttendees([]);
      return;
    }
    
    // Clear errors if validation passes
    setCsvErrors([]);
    setParsedAttendees(validationResult.data);
    
    // Clear CSV form errors when CSV becomes valid
    if (errors.csv) {
      setErrors(prev => ({ ...prev, csv: undefined }));
    }
  };

  const handleBulkAttendeeCreation = async (workshopId: string) => {
    if (parsedAttendees.length === 0) return;
    
    setBulkImportProgress({
      isImporting: true,
      completed: 0,
      total: parsedAttendees.length,
      errors: []
    });
    
    const errors: Array<{ attendee: string; error: string }> = [];
    
    for (const attendee of parsedAttendees) {
      try {
        const attendeeData: CreateAttendeeRequest = {
          username: attendee.username,
          email: attendee.email
        };
        
        await attendeeApi.createAttendee(workshopId, attendeeData);
        
        setBulkImportProgress(prev => ({
          ...prev,
          completed: prev.completed + 1
        }));
      } catch (error: any) {
        const errorMessage = error.response?.data?.detail || 'Failed to create attendee';
        errors.push({
          attendee: `${attendee.username} (${attendee.email})`,
          error: errorMessage
        });
      }
    }
    
    setBulkImportProgress(prev => ({
      ...prev,
      isImporting: false,
      errors
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    
    // Enhanced name validation with additional checks
    if (!formData.name.trim()) {
      newErrors.name = 'Workshop name is required';
    } else if (formData.name.length < 3) {
      newErrors.name = 'Workshop name must be at least 3 characters';
    } else if (formData.name.length > 100) {
      newErrors.name = 'Workshop name must be less than 100 characters';
    } else if (!/^[a-zA-Z0-9\s\-_.()]+$/.test(formData.name)) {
      newErrors.name = 'Workshop name contains invalid characters';
    }
    
    // Enhanced description validation
    if (formData.description && formData.description.length > 500) {
      newErrors.description = 'Description must be less than 500 characters';
    }
    
    if (!formData.start_date) {
      newErrors.start_date = 'Start date is required';
    }
    
    if (!formData.end_date) {
      newErrors.end_date = 'End date is required';
    }
    
    // Template validation using Zod schema
    if (!formData.template) {
      newErrors.template = 'Template is required';
    } else {
      try {
        WorkshopTemplateNameSchema.parse(formData.template);
      } catch (error) {
        newErrors.template = 'Invalid template selection';
      }
    }
    
    // Enhanced date validation with timezone awareness
    if (formData.start_date && formData.end_date) {
      const startDate = new Date(formData.start_date);
      const endDate = new Date(formData.end_date);
      const now = new Date();
      
      // Validate date objects are valid
      if (isNaN(startDate.getTime())) {
        newErrors.start_date = 'Invalid start date format';
      } else if (startDate < new Date(now.getTime() - 5 * 60 * 1000)) { // Allow 5 minutes buffer
        newErrors.start_date = 'Start date cannot be in the past';
      }
      
      if (isNaN(endDate.getTime())) {
        newErrors.end_date = 'Invalid end date format';
      } else if (endDate <= startDate) {
        newErrors.end_date = 'End date must be after start date';
      }
      
      // Enhanced duration validation
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
        const duration = endDate.getTime() - startDate.getTime();
        const hours = duration / (1000 * 60 * 60);
        
        if (hours < 0.5) {
          newErrors.end_date = 'Workshop must be at least 30 minutes long';
        } else if (hours > 720) { // 30 days
          newErrors.end_date = 'Workshop cannot be longer than 30 days';
        }
        
        // Validate workshop doesn't span too many days for practical reasons
        const days = hours / 24;
        if (days > 7) {
          newErrors.end_date = 'Workshops longer than 7 days may cause resource management issues';
        }
      }
    }
    
    // Timezone validation
    if (!formData.timezone) {
      newErrors.timezone = 'Timezone is required';
    } else {
      const validTimezones = ['UTC', 'Europe/Madrid', 'Asia/Kolkata', 'America/New_York', 'Europe/London'];
      if (!validTimezones.includes(formData.timezone)) {
        newErrors.timezone = 'Invalid timezone selection';
      }
    }
    
    // Validate CSV if bulk import is enabled
    if (isBulkImport) {
      if (!csvData.trim()) {
        newErrors.csv = 'CSV data is required for bulk import';
      } else if (csvErrors.length > 0) {
        const errorCount = csvErrors.length;
        const errorText = errorCount === 1 ? 'error' : 'errors';
        newErrors.csv = `Please fix ${errorCount} ${errorText} in the CSV data`;
      } else if (parsedAttendees.length === 0) {
        newErrors.csv = 'No valid attendees found in CSV data';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    const workshopData: CreateWorkshopRequest = {
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      start_date: new Date(formData.start_date).toISOString(),
      end_date: new Date(formData.end_date).toISOString(),
      timezone: formData.timezone,
      template: formData.template
    };
    
    createWorkshopMutation.mutate(workshopData);
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear field-specific errors when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
    
    // Clear general errors when user modifies form
    if (errors.general) {
      setErrors(prev => ({ ...prev, general: undefined }));
    }
  };

  const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Set default dates (workshop starts in 1 hour, ends in 25 hours)
  React.useEffect(() => {
    const now = new Date();
    const startDate = new Date(now.getTime() + 60 * 60 * 1000); // +1 hour
    const endDate = new Date(now.getTime() + 25 * 60 * 60 * 1000); // +25 hours
    
    setFormData(prev => ({
      ...prev,
      start_date: formatDateForInput(startDate),
      end_date: formatDateForInput(endDate)
    }));
  }, []);

  // Load cleanup delay from settings
  React.useEffect(() => {
    const loadCleanupDelay = () => {
      try {
        const savedSettings = localStorage.getItem('techlabs-settings');
        if (savedSettings) {
          const settings = JSON.parse(savedSettings);
          if (settings.cleanupDelay && typeof settings.cleanupDelay === 'number') {
            setCleanupDelay(settings.cleanupDelay);
          }
        }
      } catch (error) {
        console.error('Failed to load cleanup delay from settings:', error);
      }
    };

    loadCleanupDelay();

    // Listen for storage changes to update cleanup delay when settings change
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'techlabs-settings') {
        loadCleanupDelay();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create Workshop</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          Set up a new workshop environment for your attendees
        </p>
      </div>

      <div className="max-w-2xl">
        {errors.general && (
          <div className="mb-6 bg-danger-50 border border-danger-200 rounded-md p-4">
            <div className="flex">
              <ExclamationTriangleIcon className="h-5 w-5 text-danger-400 mr-2 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-danger-800">Error</h4>
                <p className="text-sm text-danger-700 mt-1">{errors.general}</p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Workshop Details</h3>
            </div>
            <div className="card-body space-y-6">
              {/* Workshop Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Workshop Name *
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={`block w-full rounded-md border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
                    errors.name ? 'border-danger-300 focus:border-danger-500 focus:ring-danger-500' : ''
                  }`}
                  placeholder="e.g., Kubernetes Fundamentals Workshop"
                  maxLength={100}
                />
                {errors.name && (
                  <p className="mt-2 text-sm text-danger-600 dark:text-danger-400">{errors.name}</p>
                )}
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Choose a descriptive name for your workshop
                </p>
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  id="description"
                  rows={4}
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className={`block w-full rounded-md border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
                    errors.description ? 'border-danger-300 focus:border-danger-500 focus:ring-danger-500' : ''
                  }`}
                  placeholder="Optional description of the workshop content, objectives, and target audience..."
                  maxLength={500}
                />
                {errors.description && (
                  <p className="mt-2 text-sm text-danger-600 dark:text-danger-400">{errors.description}</p>
                )}
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {formData.description.length}/500 characters
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Workshop Template</h3>
            </div>
            <div className="card-body">
              <TemplateDropdown
                templates={templates}
                selectedTemplate={formData.template}
                onTemplateChange={(template) => handleInputChange('template', template)}
                isLoading={templatesLoading}
                error={templatesError ? String(templatesError) : null}
              />
              {errors.template && (
                <p className="mt-2 text-sm text-danger-600 dark:text-danger-400">{errors.template}</p>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Schedule</h3>
            </div>
            <div className="card-body space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Start Date */}
                <div>
                  <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Start Date & Time *
                  </label>
                  <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500" />
                    <input
                      type="datetime-local"
                      id="start_date"
                      value={formData.start_date}
                      onChange={(e) => handleInputChange('start_date', e.target.value)}
                      className={`block w-full pl-10 rounded-md border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
                        errors.start_date ? 'border-danger-300 focus:border-danger-500 focus:ring-danger-500' : ''
                      }`}
                    />
                  </div>
                  {errors.start_date && (
                    <p className="mt-2 text-sm text-danger-600 dark:text-danger-400">{errors.start_date}</p>
                  )}
                </div>

                {/* End Date */}
                <div>
                  <label htmlFor="end_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    End Date & Time *
                  </label>
                  <div className="relative">
                    <ClockIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500" />
                    <input
                      type="datetime-local"
                      id="end_date"
                      value={formData.end_date}
                      onChange={(e) => handleInputChange('end_date', e.target.value)}
                      className={`block w-full pl-10 rounded-md border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
                        errors.end_date ? 'border-danger-300 focus:border-danger-500 focus:ring-danger-500' : ''
                      }`}
                    />
                  </div>
                  {errors.end_date && (
                    <p className="mt-2 text-sm text-danger-600 dark:text-danger-400">{errors.end_date}</p>
                  )}
                </div>
              </div>

              <div className="bg-primary-50 dark:bg-slate-800 border border-primary-200 dark:border-slate-600 rounded-md p-4">
                <div className="flex">
                  <InformationCircleIcon className="h-5 w-5 text-primary-400 dark:text-primary-300 mr-2 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-primary-800 dark:text-primary-200">Important Notes</h4>
                    <ul className="text-sm text-primary-700 dark:text-primary-300 mt-1 list-disc list-inside space-y-1">
                      <li>Workshop resources will be automatically deployed when the workshop starts</li>
                      <li>All resources will be cleaned up {cleanupDelay} {cleanupDelay === 1 ? 'hour' : 'hours'} after the workshop ends</li>
                      <li>Attendees can be added after creating the workshop</li>
                      <li>You can manually deploy or cleanup resources at any time</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Attendees</h3>
            </div>
            <div className="card-body space-y-6">
              {/* Bulk Import Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">Import Method</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Choose how you want to add attendees to this workshop
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <span className={`text-sm ${!isBulkImport ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                    Individual
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsBulkImport(!isBulkImport);
                      // Clear CSV data when switching modes
                      if (isBulkImport) {
                        setCsvData('');
                        setParsedAttendees([]);
                        setCsvErrors([]);
                      }
                      // Individual mode doesn't have persistent state to clear
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                      isBulkImport ? 'bg-primary-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isBulkImport ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className={`text-sm ${isBulkImport ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                    Bulk Import
                  </span>
                </div>
              </div>

              {isBulkImport ? (
                /* Bulk Import Section */
                <div className="space-y-4">
                  <div>
                    <label htmlFor="csvData" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      CSV Data
                    </label>
                    <textarea
                      id="csvData"
                      rows={8}
                      value={csvData}
                      onChange={(e) => handleCsvDataChange(e.target.value)}
                      className={`block w-full rounded-md border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm font-mono ${
                        errors.csv || csvErrors.length > 0 ? 'border-danger-300 focus:border-danger-500 focus:ring-danger-500' : ''
                      }`}
                      placeholder="Max-Mustermann,max-mustermann@techlab.ovh&#10;John-Doe,john-doe@example.com&#10;Jane-Smith,jane-smith@example.com"
                    />
                    {errors.csv && (
                      <p className="mt-2 text-sm text-danger-600 dark:text-danger-400">{errors.csv}</p>
                    )}
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Format: username,email (one attendee per line). {parsedAttendees.length > 0 && `${parsedAttendees.length} valid attendees found.`}
                    </p>
                  </div>

                  {/* CSV Errors */}
                  {csvErrors.length > 0 && (
                    <div className="bg-danger-50 dark:bg-red-900/20 border border-danger-200 dark:border-red-800 rounded-md p-4">
                      <div className="flex">
                        <ExclamationTriangleIcon className="h-5 w-5 text-danger-400 dark:text-danger-300 mr-2 mt-0.5 flex-shrink-0" />
                        <div className="w-full">
                          <h4 className="text-sm font-medium text-danger-800 dark:text-danger-200">CSV Validation Errors</h4>
                          <div className="mt-2 text-sm text-danger-700 dark:text-danger-300">
                            <ul className="list-disc list-inside space-y-1">
                              {csvErrors.map((error, index) => (
                                <li key={index}>
                                  Line {error.lineNumber}: {error.message}
                                  {'field' in error && ` (${error.field}: "${error.value}")`}
                                  {'line' in error && ` - "${error.line}"`}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Bulk Import Progress */}
                  {bulkImportProgress.isImporting && (
                    <div className="bg-primary-50 dark:bg-slate-800 border border-primary-200 dark:border-slate-600 rounded-md p-4">
                      <div className="flex">
                        <UserGroupIcon className="h-5 w-5 text-primary-400 dark:text-primary-300 mr-2 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-medium text-primary-800 dark:text-primary-200">Creating Attendees</h4>
                          <p className="text-sm text-primary-700 dark:text-primary-300 mt-1">
                            Progress: {bulkImportProgress.completed} of {bulkImportProgress.total} attendees created
                          </p>
                          <div className="w-full bg-primary-200 dark:bg-slate-600 rounded-full h-2 mt-2">
                            <div 
                              className="bg-primary-600 dark:bg-primary-500 h-2 rounded-full transition-all duration-300" 
                              style={{ width: `${(bulkImportProgress.completed / bulkImportProgress.total) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Bulk Import Errors */}
                  {bulkImportProgress.errors.length > 0 && (
                    <div className="bg-danger-50 border border-danger-200 rounded-md p-4">
                      <div className="flex">
                        <ExclamationTriangleIcon className="h-5 w-5 text-danger-400 mr-2 mt-0.5 flex-shrink-0" />
                        <div className="w-full">
                          <h4 className="text-sm font-medium text-danger-800">
                            Failed to create {bulkImportProgress.errors.length} attendee(s)
                          </h4>
                          <div className="mt-2 text-sm text-danger-700">
                            <ul className="list-disc list-inside space-y-1">
                              {bulkImportProgress.errors.map((error, index) => (
                                <li key={index}>
                                  {error.attendee}: {error.error}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Parsed Attendees Preview */}
                  {parsedAttendees.length > 0 && csvErrors.length === 0 && (
                    <div className="bg-success-50 border border-success-200 rounded-md p-4">
                      <div className="flex">
                        <UserGroupIcon className="h-5 w-5 text-success-400 mr-2 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-medium text-success-800">Ready to Import</h4>
                          <p className="text-sm text-success-700 mt-1">
                            {parsedAttendees.length} attendee(s) will be created after the workshop is set up.
                          </p>
                          <div className="mt-2 text-sm text-success-600">
                            <details className="cursor-pointer">
                              <summary className="font-medium hover:text-success-800">
                                Preview attendees ({parsedAttendees.length})
                              </summary>
                              <ul className="mt-2 list-disc list-inside space-y-1 ml-4">
                                {parsedAttendees.slice(0, 10).map((attendee, index) => (
                                  <li key={index}>
                                    {attendee.username} ({attendee.email})
                                  </li>
                                ))}
                                {parsedAttendees.length > 10 && (
                                  <li className="text-success-500">
                                    ... and {parsedAttendees.length - 10} more
                                  </li>
                                )}
                              </ul>
                            </details>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Individual Attendee Section */
                <div className="bg-primary-50 dark:bg-slate-800 border border-primary-200 dark:border-slate-600 rounded-md p-4">
                  <div className="flex">
                    <InformationCircleIcon className="h-5 w-5 text-primary-400 dark:text-primary-300 mr-2 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-primary-800 dark:text-primary-200">Add Attendees Later</h4>
                      <p className="text-sm text-primary-700 dark:text-primary-300 mt-1">
                        You can add attendees individually after creating the workshop. Go to the workshop details page to manage attendees.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate('/workshops')}
              className="btn-secondary"
              disabled={createWorkshopMutation.isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={createWorkshopMutation.isLoading}
            >
              {createWorkshopMutation.isLoading ? 'Creating...' : 'Create Workshop'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateWorkshop;