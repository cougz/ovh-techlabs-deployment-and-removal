/**
 * Updated WorkshopList component using centralized state management
 * Addresses STATE-MANAGEMENT-REVAMP-001 inconsistent state display
 */

import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  EllipsisVerticalIcon,
  CalendarIcon,
  UserGroupIcon,
  CheckCircleIcon,
  ClockIcon,
  PlayIcon,
  StopIcon,
  TrashIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

import { WorkshopStatus, WorkshopSummary } from '../types';
import { useWorkshopsQuery, useDeployWorkshopMutation, useCleanupWorkshopMutation } from '../state/queryIntegration';
import { useAppStore } from '../state/store';
import { getStateDescription } from '../state/stateMachine';
import DropdownMenu from '../components/DropdownMenu';

const WorkshopList: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<WorkshopStatus | 'all'>('all');
  const [showActions, setShowActions] = useState<string | null>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Use integrated query hook
  const { workshops, isLoading, error, refetch } = useWorkshopsQuery();
  
  // Get effective states from store
  const { getEffectiveWorkshopState, isLoading: isLoadingState, getError } = useAppStore();
  
  // Mutations with optimistic updates
  const deployMutation = useDeployWorkshopMutation();
  const cleanupMutation = useCleanupWorkshopMutation();

  // Filter workshops based on search and status
  const filteredWorkshops = workshops.filter((workshop: WorkshopSummary) => {
    const effectiveStatus = getEffectiveWorkshopState(workshop.id);
    const matchesSearch = workshop.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (workshop.description && workshop.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || effectiveStatus === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: WorkshopStatus, isOptimistic = false) => {
    const className = `h-5 w-5 ${isOptimistic ? 'opacity-60' : ''}`;
    
    switch (status) {
      case 'active':
        return <CheckCircleIcon className={`${className} text-success-500`} />;
      case 'completed':
        return <CheckCircleIcon className={`${className} text-primary-500`} />;
      case 'deploying':
        return <ClockIcon className={`${className} text-warning-500 animate-spin`} />;
      case 'failed':
        return <XMarkIcon className={`${className} text-danger-500`} />;
      case 'deleting':
        return <ClockIcon className={`${className} text-danger-500 animate-spin`} />;
      default:
        return <ClockIcon className={`${className} text-gray-500`} />;
    }
  };

  const getStatusClass = (status: WorkshopStatus, isOptimistic = false) => {
    const baseClass = isOptimistic ? 'opacity-60' : '';
    
    switch (status) {
      case 'active':
        return `status-active ${baseClass}`;
      case 'completed':
        return `status-completed ${baseClass}`;
      case 'deploying':
        return `status-deploying ${baseClass}`;
      case 'failed':
        return `status-failed ${baseClass}`;
      case 'deleting':
        return `status-deleting ${baseClass}`;
      default:
        return `status-planning ${baseClass}`;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleAction = async (action: string, workshopId: string) => {
    try {
      switch (action) {
        case 'deploy':
          await deployMutation.mutateAsync(workshopId);
          break;
        case 'cleanup':
          await cleanupMutation.mutateAsync(workshopId);
          break;
        case 'delete':
          if (window.confirm('Are you sure you want to delete this workshop? This action cannot be undone.')) {
            // TODO: Implement delete mutation
            console.log('Delete workshop:', workshopId);
          }
          break;
      }
    } catch (error) {
      console.error(`Failed to ${action} workshop:`, error);
    } finally {
      setShowActions(null);
    }
  };

  if (isLoading) {
    return (
      <div className="animate-fade-in">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Workshops</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage all workshop environments
          </p>
        </div>
        
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card">
              <div className="card-body">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-3/4 mb-4"></div>
                  <div className="flex space-x-4">
                    <div className="h-3 bg-gray-200 rounded w-20"></div>
                    <div className="h-3 bg-gray-200 rounded w-20"></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="animate-fade-in">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Workshops</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage all workshop environments
          </p>
        </div>
        
        <div className="card">
          <div className="card-body">
            <div className="text-center py-8">
              <XMarkIcon className="mx-auto h-12 w-12 text-danger-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Error loading workshops</h3>
              <p className="mt-1 text-sm text-gray-500">
                There was a problem loading the workshop data.
              </p>
              <div className="mt-6">
                <button
                  onClick={() => refetch()}
                  className="btn-primary"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Workshops</h1>
            <p className="mt-1 text-sm text-gray-600">
              Manage all workshop environments
            </p>
          </div>
          <Link
            to="/workshops/new"
            className="btn-primary"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            New Workshop
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search workshops..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
          />
        </div>
        
        <div className="relative">
          <FunnelIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as WorkshopStatus | 'all')}
            className="block w-full pl-10 pr-8 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
          >
            <option value="all">All Status</option>
            <option value="planning">Planning</option>
            <option value="deploying">Deploying</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="deleting">Deleting</option>
          </select>
        </div>
      </div>

      {/* Workshop List */}
      {filteredWorkshops.length === 0 ? (
        <div className="card">
          <div className="card-body">
            <div className="text-center py-8">
              {workshops.length === 0 ? (
                <>
                  <CalendarIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No workshops</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Get started by creating a new workshop.
                  </p>
                  <div className="mt-6">
                    <Link
                      to="/workshops/new"
                      className="btn-primary"
                    >
                      <PlusIcon className="h-4 w-4 mr-2" />
                      New Workshop
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No workshops found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Try adjusting your search or filter criteria.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredWorkshops.map((workshop) => {
            const effectiveStatus = getEffectiveWorkshopState(workshop.id);
            const workshopLoading = isLoadingState(workshop.id);
            const workshopError = getError(workshop.id);
            
            return (
              <div key={workshop.id} className="card hover:shadow-md transition-shadow duration-200">
                <div className="card-body">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(effectiveStatus, workshopLoading)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <Link
                              to={`/workshops/${workshop.id}`}
                              className="text-lg font-medium text-gray-900 hover:text-primary-600 truncate"
                            >
                              {workshop.name}
                            </Link>
                            <span className={`${getStatusClass(effectiveStatus, workshopLoading)} whitespace-nowrap`}>
                              {effectiveStatus}
                            </span>
                            {workshopLoading && (
                              <span className="text-xs text-gray-400">(updating...)</span>
                            )}
                          </div>
                          {workshop.description && (
                            <p className="text-sm text-gray-500 mt-1 truncate">
                              {workshop.description}
                            </p>
                          )}
                          {workshopError && (
                            <p className="text-sm text-danger-600 mt-1">
                              {workshopError}
                            </p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            {getStateDescription(effectiveStatus, 'workshop')}
                          </p>
                        </div>
                      </div>
                      
                      <div className="mt-4 flex items-center space-x-6 text-sm text-gray-500">
                        <div className="flex items-center">
                          <CalendarIcon className="h-4 w-4 mr-1" />
                          <span>
                            {formatDate(workshop.start_date)} - {formatDate(workshop.end_date)}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <UserGroupIcon className="h-4 w-4 mr-1" />
                          <span>
                            {workshop.active_attendees}/{workshop.attendee_count} attendees
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        ref={(el) => { triggerRefs.current[workshop.id] = el; }}
                        onClick={() => setShowActions(showActions === workshop.id ? null : workshop.id)}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-50"
                        disabled={workshopLoading}
                      >
                        <EllipsisVerticalIcon className="h-5 w-5" />
                      </button>
                      
                      <DropdownMenu
                        isOpen={showActions === workshop.id}
                        onClose={() => setShowActions(null)}
                        trigger={{ current: triggerRefs.current[workshop.id] }}
                      >
                        <div className="py-1">
                          {effectiveStatus === 'planning' && (
                            <button
                              onClick={() => handleAction('deploy', workshop.id)}
                              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              disabled={workshopLoading}
                            >
                              <PlayIcon className="h-4 w-4 mr-2" />
                              Deploy Workshop
                            </button>
                          )}
                          {(effectiveStatus === 'active' || effectiveStatus === 'completed') && (
                            <button
                              onClick={() => handleAction('cleanup', workshop.id)}
                              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              disabled={workshopLoading}
                            >
                              <StopIcon className="h-4 w-4 mr-2" />
                              Cleanup Resources
                            </button>
                          )}
                          <Link
                            to={`/workshops/${workshop.id}`}
                            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            onClick={() => setShowActions(null)}
                          >
                            <UserGroupIcon className="h-4 w-4 mr-2" />
                            Manage Attendees
                          </Link>
                          {workshop.status !== 'deleting' && (
                            <button
                              onClick={() => handleAction('delete', workshop.id)}
                              className="flex items-center w-full px-4 py-2 text-sm text-danger-600 hover:bg-danger-50"
                              disabled={workshopLoading}
                            >
                              <TrashIcon className="h-4 w-4 mr-2" />
                              Delete Workshop
                            </button>
                          )}
                        </div>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WorkshopList;