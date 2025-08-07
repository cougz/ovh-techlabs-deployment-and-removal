import React, { useState, useEffect } from 'react';
import {
  CloudIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CalendarIcon,
  CheckCircleIcon,
  XCircleIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import BulkDeleteConfirmation from '../../components/BulkDeleteConfirmation';

interface PCIProject {
  service_id: string;
  project_id: string;
  display_name: string;
  state: string;
  creation_date?: string;
  next_billing_date?: string;
  termination_date?: string;
}

const PCIProjects: React.FC = () => {
  const [projects, setProjects] = useState<PCIProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteResults, setDeleteResults] = useState<any>(null);

  const fetchProjects = async (useCache = true) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/ovh/pci-projects?use_cache=${useCache}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.statusText}`);
      }

      const data = await response.json();
      setProjects(data);
      setSelectedProjects(new Set()); // Clear selections on refresh
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchProjects(false);
  };

  const handleSelectAll = () => {
    if (selectedProjects.size === filteredProjects.length) {
      setSelectedProjects(new Set());
    } else {
      setSelectedProjects(new Set(filteredProjects.map(p => p.service_id)));
    }
  };

  const handleSelectProject = (serviceId: string) => {
    const newSelected = new Set(selectedProjects);
    if (newSelected.has(serviceId)) {
      newSelected.delete(serviceId);
    } else {
      newSelected.add(serviceId);
    }
    setSelectedProjects(newSelected);
  };

  const handleBulkDelete = async () => {
    setIsDeleting(true);
    setDeleteResults(null);
    
    try {
      const response = await fetch('/api/ovh/pci-projects/bulk-delete', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          service_ids: Array.from(selectedProjects)
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to delete projects: ${response.statusText}`);
      }

      const result = await response.json();
      setDeleteResults(result);
      
      // Refresh the list after deletion
      setTimeout(() => {
        fetchProjects(false);
        setShowDeleteConfirm(false);
        setDeleteResults(null);
      }, 3000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete projects');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredProjects = projects.filter(project => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      project.display_name.toLowerCase().includes(query) ||
      project.project_id.toLowerCase().includes(query) ||
      project.service_id.toString().toLowerCase().includes(query) ||
      project.state.toLowerCase().includes(query)
    );
  });

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
      case 'active':
      case 'ok':
        return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
      case 'suspended':
      case 'paused':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30';
      case 'terminated':
      case 'deleted':
        return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700';
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

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
            Manage OVH Public Cloud Infrastructure projects
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {selectedProjects.size > 0 && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 transition-colors"
            >
              <TrashIcon className="h-4 w-4 mr-2" />
              Delete ({selectedProjects.size})
            </button>
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

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search projects by name, ID, or state..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-ovh-500 focus:ring-ovh-500"
          />
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

      {/* Delete Results */}
      {deleteResults && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
          <h3 className="text-sm font-medium text-blue-800 dark:text-blue-400">Deletion Results</h3>
          <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
            Task ID: {deleteResults.task_id}
          </p>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            {deleteResults.message}
          </p>
        </div>
      )}

      {/* Projects Table */}
      <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
        {loading ? (
          <div className="text-center py-12">
            <ArrowPathIcon className="h-8 w-8 text-gray-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Loading projects...</p>
          </div>
        ) : filteredProjects.length === 0 ? (
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
                      checked={selectedProjects.size === filteredProjects.length && filteredProjects.length > 0}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-ovh-600 focus:ring-ovh-500 border-gray-300 rounded"
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredProjects.map((project) => (
                  <tr key={project.service_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedProjects.has(project.service_id)}
                        onChange={() => handleSelectProject(project.service_id)}
                        className="h-4 w-4 text-ovh-600 focus:ring-ovh-500 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {project.display_name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          ID: {project.project_id}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Service: {project.service_id}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStateColor(project.state)}`}>
                        {project.state === 'active' || project.state === 'ok' ? (
                          <CheckCircleIcon className="h-3 w-3 mr-1" />
                        ) : (
                          <XCircleIcon className="h-3 w-3 mr-1" />
                        )}
                        {project.state}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center">
                        <CalendarIcon className="h-4 w-4 mr-1" />
                        {formatDate(project.creation_date)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(project.next_billing_date)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => {
                          setSelectedProjects(new Set([project.service_id]));
                          setShowDeleteConfirm(true);
                        }}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Total projects: <span className="font-medium">{projects.length}</span>
          {searchQuery && (
            <span className="ml-4">
              Showing: <span className="font-medium text-ovh-600">{filteredProjects.length}</span>
            </span>
          )}
          {selectedProjects.size > 0 && (
            <span className="ml-4">
              Selected: <span className="font-medium text-red-600">{selectedProjects.size}</span>
            </span>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <BulkDeleteConfirmation
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleBulkDelete}
        resourceType="PCI Projects"
        selectedCount={selectedProjects.size}
        isDeleting={isDeleting}
      />
    </div>
  );
};

export default PCIProjects;