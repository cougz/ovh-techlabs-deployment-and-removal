import React, { useState, useEffect } from 'react';
import {
  ShieldCheckIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CalendarIcon,
  LockClosedIcon,
  UserGroupIcon,
  DocumentTextIcon,
  InformationCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';

interface IAMPolicy {
  id: string;
  name: string;
  description: string;
  owner: string;
  read_only: boolean;
  identities: string[];
  resources: string[];
  permissions: Record<string, any>;
  created_at?: string;
}

const IAMPolicies: React.FC = () => {
  const [policies, setPolicies] = useState<IAMPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPolicies, setExpandedPolicies] = useState<Set<string>>(new Set());

  const fetchPolicies = async (useCache = true) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/ovh/iam-policies?use_cache=${useCache}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch policies: ${response.statusText}`);
      }

      const data = await response.json();
      // The API returns policies as a direct array, not wrapped in an object
      setPolicies(Array.isArray(data) ? data : []);
      setFromCache(false); // Cache info is not provided in current API response
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch policies');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchPolicies(false);
  };

  const filteredPolicies = policies.filter(policy => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      policy.name.toLowerCase().includes(query) ||
      policy.description.toLowerCase().includes(query) ||
      policy.owner.toLowerCase().includes(query) ||
      policy.id.toLowerCase().includes(query)
    );
  });

  const togglePolicyExpansion = (policyId: string) => {
    const newExpanded = new Set(expandedPolicies);
    if (newExpanded.has(policyId)) {
      newExpanded.delete(policyId);
    } else {
      newExpanded.add(policyId);
    }
    setExpandedPolicies(newExpanded);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MMM dd, yyyy HH:mm');
    } catch {
      return dateString;
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <ShieldCheckIcon className="h-8 w-8 mr-2 text-ovh-600" />
            IAM Policies
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage OVH Identity and Access Management policies
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

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search policies by name, description, owner, or ID..."
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

      {/* Policies List */}
      <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:p-6">
          {loading ? (
            <div className="text-center py-12">
              <ArrowPathIcon className="h-8 w-8 text-gray-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Loading policies...</p>
            </div>
          ) : filteredPolicies.length === 0 ? (
            <div className="text-center py-12">
              <ShieldCheckIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No policies found</h3>
              <p className="text-gray-500 dark:text-gray-400">
                {searchQuery ? 'No policies match your search criteria.' : 'You don\'t have any IAM policies yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPolicies.map((policy) => {
                const isExpanded = expandedPolicies.has(policy.id);
                return (
                  <div
                    key={policy.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                  >
                    {/* Policy Header */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => togglePolicyExpansion(policy.id)}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          >
                            {isExpanded ? (
                              <ChevronDownIcon className="h-5 w-5" />
                            ) : (
                              <ChevronRightIcon className="h-5 w-5" />
                            )}
                          </button>
                          <div className="flex items-center">
                            <ShieldCheckIcon className="h-5 w-5 text-ovh-600 dark:text-ovh-400 mr-2" />
                            <div>
                              <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                                {policy.name}
                              </h3>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                ID: {policy.id}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {policy.read_only && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                              <LockClosedIcon className="h-3 w-3 mr-1" />
                              Read Only
                            </span>
                          )}
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Owner: {policy.owner}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Policy Content */}
                    <div className="px-4 py-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-1">
                            <DocumentTextIcon className="h-4 w-4 mr-1" />
                            Description
                          </div>
                          <p className="text-sm text-gray-900 dark:text-white">
                            {policy.description || 'No description'}
                          </p>
                        </div>
                        <div>
                          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-1">
                            <UserGroupIcon className="h-4 w-4 mr-1" />
                            Identities
                          </div>
                          <p className="text-sm text-gray-900 dark:text-white">
                            {policy.identities.length} identities
                          </p>
                        </div>
                        <div>
                          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-1">
                            <CalendarIcon className="h-4 w-4 mr-1" />
                            Created
                          </div>
                          <p className="text-sm text-gray-900 dark:text-white">
                            {formatDate(policy.created_at)}
                          </p>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Identities */}
                            <div>
                              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                                Identities ({policy.identities.length})
                              </h4>
                              {policy.identities.length > 0 ? (
                                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-md p-3 max-h-40 overflow-y-auto">
                                  <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                                    {policy.identities.map((identity, index) => (
                                      <li key={index} className="break-all">
                                        {identity}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  No identities assigned
                                </p>
                              )}
                            </div>

                            {/* Resources */}
                            <div>
                              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                                Resources ({policy.resources.length})
                              </h4>
                              {policy.resources.length > 0 ? (
                                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-md p-3 max-h-40 overflow-y-auto">
                                  <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                                    {policy.resources.map((resource, index) => (
                                      <li key={index} className="break-all font-mono">
                                        {resource}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  No resources specified
                                </p>
                              )}
                            </div>

                            {/* Permissions */}
                            <div className="lg:col-span-2">
                              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                                Permissions
                              </h4>
                              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-md p-3">
                                <pre className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                                  {JSON.stringify(policy.permissions, null, 2)}
                                </pre>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Total policies: <span className="font-medium">{policies.length}</span>
          {searchQuery && (
            <span className="ml-4">
              Showing: <span className="font-medium text-ovh-600">{filteredPolicies.length}</span>
            </span>
          )}
          <span className="ml-4">
            Read-only: <span className="font-medium">{policies.filter(p => p.read_only).length}</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default IAMPolicies;