import React, { useState, useEffect } from 'react';
import {
  UsersIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CalendarIcon,
  UserIcon,
  InformationCircleIcon,
  FunnelIcon,
  XMarkIcon,
  TrashIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import BulkDeleteConfirmation from '../../components/BulkDeleteConfirmation';
import { format } from 'date-fns';

interface IAMUser {
  username: string;
  description: string;
  email: string;
  creation?: string;
  last_update?: string;
  status: string;
  group: string;
  urn: string;
}

interface FilterOptions {
  group?: string;
  status?: string;
  created_after?: string;
  search?: string;
}

const IAMUsers: React.FC = () => {
  const [users, setUsers] = useState<IAMUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({});
  const [showFilters, setShowFilters] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Get unique values for filter dropdowns
  const uniqueGroups = Array.from(new Set(users.map(u => u.group).filter(Boolean)));
  const uniqueStatuses = Array.from(new Set(users.map(u => u.status).filter(Boolean)));

  const fetchUsers = async (useCache = true, filterOptions?: FilterOptions) => {
    setLoading(true);
    setError(null);
    setSelectedUsers(new Set()); // Clear selections on refresh
    try {
      let url = `/api/ovh/iam-users?use_cache=${useCache}`;
      
      // Apply filters if provided
      if (filterOptions && Object.keys(filterOptions).length > 0) {
        const params = new URLSearchParams();
        Object.entries(filterOptions).forEach(([key, value]) => {
          if (value && value.trim()) {
            params.append(key, value);
          }
        });
        if (params.toString()) {
          url = `/api/ovh/iam-users/filter?${params.toString()}`;
        }
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.statusText}`);
      }

      const data = await response.json();
      setUsers(data || []);
      setFromCache(data.from_cache || false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchUsers(false, filters);
  };

  const handleApplyFilters = () => {
    fetchUsers(true, filters);
    setShowFilters(false);
  };

  const handleClearFilters = () => {
    setFilters({});
    fetchUsers(true);
    setShowFilters(false);
  };

  const handleSelectAll = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map(u => u.username)));
    }
  };

  const handleSelectUser = (username: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(username)) {
      newSelected.delete(username);
    } else {
      newSelected.add(username);
    }
    setSelectedUsers(newSelected);
  };

  const handleBulkDelete = async () => {
    setIsDeleting(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      const response = await fetch('/api/ovh/iam-users/bulk-delete', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          usernames: Array.from(selectedUsers)
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to delete users: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Show success message
      const successCount = result.success ? result.success.length : 0;
      const failureCount = result.failed ? result.failed.length : 0;
      
      if (successCount > 0) {
        setSuccessMessage(`✅ Successfully deleted ${successCount} user${successCount > 1 ? 's' : ''}${failureCount > 0 ? `, ${failureCount} failed` : ''}`);
      } else {
        setError(`Failed to delete users: ${failureCount} failures`);
      }
      
      // Clear selections immediately
      setSelectedUsers(new Set());
      
      // Refresh the list
      setTimeout(() => {
        fetchUsers(false, filters);
        setShowDeleteConfirm(false);
      }, 1000);
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete users');
    } finally {
      setIsDeleting(false);
    }
  };


  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MMM dd, yyyy HH:mm');
    } catch {
      return dateString;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30';
      case 'inactive': return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-700/30';
      case 'suspended': return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30';
      default: return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-700/30';
    }
  };

  const hasActiveFilters = Object.values(filters).some(value => value && value.trim());

  // Apply filters to get filtered users
  const filteredUsers = users.filter(user => {
    // Apply search filter from filters state
    if (filters.search) {
      const search = filters.search.toLowerCase();
      const matches = (
        user.username.toLowerCase().includes(search) ||
        (user.email && user.email.toLowerCase().includes(search)) ||
        (user.description && user.description.toLowerCase().includes(search))
      );
      if (!matches) return false;
    }
    
    // Apply other filters
    if (filters.group && user.group !== filters.group) return false;
    if (filters.status && user.status !== filters.status) return false;
    if (filters.created_after && user.creation) {
      const createdDate = new Date(user.creation);
      const filterDate = new Date(filters.created_after);
      if (createdDate < filterDate) return false;
    }
    
    return true;
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <UsersIcon className="h-8 w-8 mr-2 text-ovh-600" />
            IAM Users
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage OVH Identity and Access Management users
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {fromCache && (
            <div className="flex items-center text-sm text-blue-600 dark:text-blue-400">
              <InformationCircleIcon className="h-4 w-4 mr-1" />
              Cached data
            </div>
          )}
          {selectedUsers.size > 0 && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 transition-colors"
            >
              <TrashIcon className="h-4 w-4 mr-2" />
              Delete ({selectedUsers.size})
            </button>
          )}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm leading-4 font-medium rounded-md transition-colors ${
              hasActiveFilters 
                ? 'bg-ovh-50 text-ovh-700 border-ovh-300 dark:bg-ovh-900/30 dark:text-ovh-400 dark:border-ovh-700'
                : 'text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            <FunnelIcon className="h-4 w-4 mr-2" />
            Filters {hasActiveFilters && `(${Object.values(filters).filter(v => v && v.trim()).length})`}
          </button>
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
            placeholder="Search users by username, email, or description..."
            value={filters.search || ''}
            onChange={(e) => setFilters({...filters, search: e.target.value})}
            className="pl-10 w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-ovh-500 focus:ring-ovh-500"
          />
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Advanced Filters</h3>
            <button
              onClick={() => setShowFilters(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Group
              </label>
              <select
                value={filters.group || ''}
                onChange={(e) => setFilters({...filters, group: e.target.value})}
                className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-ovh-500 focus:ring-ovh-500"
              >
                <option value="">All groups</option>
                {uniqueGroups.map(group => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                value={filters.status || ''}
                onChange={(e) => setFilters({...filters, status: e.target.value})}
                className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-ovh-500 focus:ring-ovh-500"
              >
                <option value="">All statuses</option>
                {uniqueStatuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Created After
              </label>
              <input
                type="date"
                value={filters.created_after || ''}
                onChange={(e) => setFilters({...filters, created_after: e.target.value})}
                className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-ovh-500 focus:ring-ovh-500"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-4">
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Clear
            </button>
            <button
              onClick={handleApplyFilters}
              className="px-4 py-2 text-sm bg-ovh-600 text-white rounded-md hover:bg-ovh-700 transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}

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

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4">
          <div className="flex">
            <CheckCircleIcon className="h-5 w-5 text-green-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800 dark:text-green-400">Success</h3>
              <p className="mt-1 text-sm text-green-700 dark:text-green-300">{successMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:p-6">
          {loading ? (
            <div className="text-center py-12">
              <ArrowPathIcon className="h-8 w-8 text-gray-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Loading users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <UsersIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No users found</h3>
              <p className="text-gray-500 dark:text-gray-400">
                {hasActiveFilters ? 'No users match your filter criteria.' : 'You don\'t have any IAM users yet.'}
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
                        checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                        onChange={handleSelectAll}
                        className="h-4 w-4 text-ovh-600 focus:ring-ovh-500 border-gray-300 rounded"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Group
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Last Update
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredUsers.map((user) => (
                    <tr key={user.username} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedUsers.has(user.username)}
                          onChange={() => handleSelectUser(user.username)}
                          className="h-4 w-4 text-ovh-600 focus:ring-ovh-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex-shrink-0">
                            <div className="h-10 w-10 rounded-full bg-ovh-100 dark:bg-ovh-800 flex items-center justify-center">
                              <UserIcon className="h-5 w-5 text-ovh-600 dark:text-ovh-400" />
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {user.username}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {user.email || 'No email'}
                            </div>
                            {user.description && (
                              <div className="text-xs text-gray-400 dark:text-gray-500">
                                {user.description}
                              </div>
                            )}
                            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              URN: {user.urn}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(user.status)}`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {user.group || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center">
                          <CalendarIcon className="h-4 w-4 mr-1" />
                          {formatDate(user.creation)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center">
                          <CalendarIcon className="h-4 w-4 mr-1" />
                          {formatDate(user.last_update)}
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
          Total users: <span className="font-medium">{users.length}</span>
          {hasActiveFilters && (
            <span className="ml-4">
              Showing: <span className="font-medium text-ovh-600">{filteredUsers.length}</span>
            </span>
          )}
          {selectedUsers.size > 0 && (
            <span className="ml-4">
              Selected: <span className="font-medium text-red-600">{selectedUsers.size}</span>
            </span>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <BulkDeleteConfirmation
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleBulkDelete}
        resourceType="IAM Users"
        selectedCount={selectedUsers.size}
        isDeleting={isDeleting}
      />
    </div>
  );
};

export default IAMUsers;