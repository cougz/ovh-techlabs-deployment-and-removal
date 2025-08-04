import React, { useState, useEffect } from 'react';
import { settingsApi } from '../services/api';
import useNotificationDialog from '../hooks/useNotificationDialog';

const Settings: React.FC = () => {
  const [settings, setSettings] = useState({
    autoCleanup: true,
    cleanupDelay: 72
  });
  
  const [loginPrefixConfig, setLoginPrefixConfig] = useState({
    login_prefix: '',
    export_format: 'OVHcloud Login'
  });
  
  const [isLoading, setIsLoading] = useState(false);
  
  // Notification dialog
  const { NotificationDialog, showNotification } = useNotificationDialog();

  // Load settings from localStorage and API on mount
  useEffect(() => {
    const loadSettings = async () => {
      // Load local settings
      const savedSettings = localStorage.getItem('techlabs-settings');
      if (savedSettings) {
        try {
          const parsedSettings = JSON.parse(savedSettings);
          setSettings(parsedSettings);
        } catch (error) {
          console.error('Failed to parse saved settings:', error);
        }
      }
      
      // Load login prefix config from API
      try {
        const prefixConfig = await settingsApi.getLoginPrefixConfig();
        setLoginPrefixConfig(prefixConfig);
      } catch (error) {
        console.error('Failed to load login prefix config:', error);
      }
    };
    
    loadSettings();
  }, []);

  const handleSettingChange = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };
  
  const handleLoginPrefixChange = (key: string, value: string) => {
    setLoginPrefixConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Save local settings to localStorage
      localStorage.setItem('techlabs-settings', JSON.stringify(settings));
      
      // Save login prefix config to API
      await settingsApi.setLoginPrefixConfig(loginPrefixConfig);
      
      // Show success confirmation
      showNotification({
        title: 'Settings Saved',
        message: 'Settings saved successfully!',
        type: 'success'
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
      showNotification({
        title: 'Save Failed',
        message: 'Failed to save settings: ' + (error instanceof Error ? error.message : 'Unknown error'),
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderGeneralSettings = () => (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">User Credentials</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="login-prefix" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Login Prefix
            </label>
            <input
              id="login-prefix"
              type="text"
              value={loginPrefixConfig.login_prefix}
              onChange={(e) => handleLoginPrefixChange('login_prefix', e.target.value)}
              className="block w-full max-w-sm rounded-md border-gray-300 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-100 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              placeholder="e.g., 0541-8821-89/"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Prefix applied to all attendee usernames in credential exports. Must end with '/' if not empty.
              {loginPrefixConfig.login_prefix && (
                <span className="block mt-1 text-primary-600 dark:text-primary-400">
                  Preview: {loginPrefixConfig.login_prefix}username
                </span>
              )}
            </p>
          </div>
          
          <div>
            <label htmlFor="export-format" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Export Format Label
            </label>
            <input
              id="export-format"
              type="text"
              value={loginPrefixConfig.export_format}
              onChange={(e) => handleLoginPrefixChange('export_format', e.target.value)}
              className="block w-full max-w-sm rounded-md border-gray-300 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-100 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              placeholder="OVHcloud Login"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Label used in attendee credential exports</p>
          </div>
        </div>
      </div>
      
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Workshop Management</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Auto-cleanup workshops</label>
              <p className="text-sm text-gray-500 dark:text-gray-400">Automatically delete workshop resources after completion</p>
            </div>
            <input
              type="checkbox"
              checked={settings.autoCleanup}
              onChange={(e) => handleSettingChange('autoCleanup', e.target.checked)}
              className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
          </div>
          
          <div>
            <label htmlFor="cleanup-delay" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Cleanup delay (hours)
            </label>
            <input
              id="cleanup-delay"
              type="number"
              min="1"
              max="168"
              value={settings.cleanupDelay}
              onChange={(e) => handleSettingChange('cleanupDelay', parseInt(e.target.value))}
              className="block w-20 rounded-md border-gray-300 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-100 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Time to wait after workshop end before cleanup</p>
          </div>
        </div>
      </div>
    </div>
  );


  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          Configure application settings and preferences
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800 shadow dark:shadow-none rounded-lg">
        {/* Content - No tabs since there's only one section */}
        <div className="px-6 py-6">
          {renderGeneralSettings()}
        </div>

        {/* Save button */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-slate-700 border-t border-gray-200 dark:border-slate-600 flex justify-end">
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="btn-primary"
          >
            {isLoading ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Notification Dialog */}
      <NotificationDialog />
    </div>
  );
};

export default Settings;