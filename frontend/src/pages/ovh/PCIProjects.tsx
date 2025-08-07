import React, { useState, useEffect } from 'react';
import {
  CloudIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import useConfirmDialog from '../../hooks/useConfirmDialog';

interface PCIProject {
  service_id: string;
  project_id: string;
  display_name: string;
  state: string;
  creation_date?: string;
  next_billing_date?: string;
  termination_date?: string;
}

interface BulkDeleteResult {
  success: string[];
  failed: Array<{id: string; error: string}>;
  total: number;
}

const PCIProjects: React.FC = () => {
  const [projects, setProjects] = useState<PCIProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterState, setFilterState] = useState(''); // New state for filter
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [fromCache, setFromCache] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { showConfirmDialog, ConfirmDialog } = useConfirmDialog();

  const fetchProjects = async (useCache = true, stateFilter = '', searchFilter = '') => {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/ovh/pci-projects?use_cache=${useCache}`;
      if (stateFilter) {
        url += `&state=${stateFilter}`;
      }
      if (searchFilter) {
        url += `&search=${encodeURIComponent(searchFilter)}`;
      }
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.statusText}`);
      }

      const data = await response.json();
      setProjects(data || []);
      setFromCache(data.from_cache || false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchProjects(false, filterState, searchQuery);
  };

  const handleSearch = () => {
    fetchProjects(true, filterState, searchQuery);
  };

  const handleSelectProject = (serviceId: string) => {
    setSelectedProjects(prev => 
      prev.includes(serviceId) 
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handleSelectAll = () => {
    setSelectedProjects(prev => 
      prev.length === projects.length ? [] : projects.map(p => p.service_id)
    );
  };

  const handleBulkDelete = () => {
    if (selectedProjects.length === 0) return;

    showConfirmDialog({
      title: 'Delete PCI Projects',
      message: `Are you sure you want to delete ${selectedProjects.length} PCI project(s)? This action cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        setDeleting(true);
        setError(null);
        try {
          const response = await fetch('/api/ovh/pci-projects/bulk-delete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ service_ids: selectedProjects })
          });

          if (!response.ok) {
            throw new Error(`Bulk delete failed: ${response.statusText}`);
          }

          const result: BulkDeleteResult = await response.json();
          
          // Show results (simplified for now - could use notification dialog)
          if (result.failed.length > 0) {
            setError(`Deletion completed with failures: ${result.success.length} successful, ${result.failed.length} failed`);
          }

          // Refresh the list and clear selection
          setSelectedProjects([]);
          fetchProjects(false, filterState, searchQuery); // Pass filters here
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Bulk delete failed');
        } finally {
          setDeleting(false);
        }
      }
    });
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  const getStateColor = (state: string) => {
    switch (state.toLowerCase()) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'suspended': return 'text-yellow-600 bg-yellow-100';
      case 'terminated': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

    useEffect(() => {
    fetchProjects(true, filterState, searchQuery);
  }, [filterState, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <CloudIcon className="h-8 w-8 mr-2 text-ovh-600" />
            PCI Projects
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage your OVH Public Cloud Infrastructure projects
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {fromCache && (
            <div className="flex items-center text-sm text-blue-600 dark:text-blue-400">
              <InformationCircleIcon className="h-4 w-4 mr-1" />
              Cached data
            </div>
          )}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-ovh-600 hover:bg-ovh-700 disabled:opacity-50 transition-colors"
          >
            <ArrowPathIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Search and Actions */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, project ID, or service ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-ovh-500 focus:ring-ovh-500"
              />
            </div>
            <select
              value={filterState}
              onChange={(e) => setFilterState(e.target.value)}
              className="rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-ovh-500 focus:ring-ovh-500"
            >
              <option value="">All States</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="terminated">Terminated</option>
            </select>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-ovh-600 text-white rounded-md hover:bg-ovh-700 transition-colors"
            >
              Search
            </button>
          </div>
          {selectedProjects.length > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={deleting}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              <TrashIcon className="h-4 w-4 mr-2" />
              Delete Selected ({selectedProjects.length})
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-400">Error</h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Projects Table */}
      <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:p-6">
          {loading ? (
            <div className="text-center py-12">
              <ArrowPathIcon className="h-8 w-8 text-gray-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Loading projects...</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12">
              <CloudIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No projects found</h3>
              <p className="text-gray-500 dark:text-gray-400">
                {searchQuery ? 'No projects match your search criteria.' : 'You don\'t have any PCI projects yet.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedProjects.length === projects.length && projects.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Project
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      State
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Next Billing
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {projects.map((project) => (
                    <tr key={project.service_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedProjects.includes(project.service_id)}
                          onChange={() => handleSelectProject(project.service_id)}
                          className="rounded border-gray-300 dark:border-gray-600"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {project.display_name}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            ID: {project.project_id}
                          </div>
                          <div className="text-xs text-gray-400 dark:text-gray-500">
                            Service: {project.service_id}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStateColor(project.state)}`}>
                          {project.state}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center">
                          <CalendarIcon className="h-4 w-4 mr-1" />
                          {formatDate(project.creation_date)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center">
                          <CurrencyDollarIcon className="h-4 w-4 mr-1" />
                          {formatDate(project.next_billing_date)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Total projects: <span className="font-medium">{projects.length}</span>
          {selectedProjects.length > 0 && (
            <span className="ml-4">
              Selected: <span className="font-medium text-ovh-600">{selectedProjects.length}</span>
            </span>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog />
    </div>
  );
};

export default PCIProjects;