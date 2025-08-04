import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { 
  AcademicCapIcon, 
  UserGroupIcon, 
  CloudIcon, 
  CheckCircleIcon,
  PlusIcon
} from '@heroicons/react/24/outline';

import { workshopApi } from '../services/api';
import { WorkshopSummary } from '../types';
import StatusIndicator from '../components/StatusIndicator';
import { getEffectiveStatus, sortByStatusPriority } from '../utils/statusUtils';
import { useGlobalWebSocket } from '../hooks/useGlobalWebSocket';

const Dashboard: React.FC = () => {
  // Enable global WebSocket for real-time updates
  useGlobalWebSocket({
    onStatusUpdate: (workshopId, entityType, entityId, status) => {
      console.log(`Dashboard: WebSocket status update - ${entityType} ${entityId} in workshop ${workshopId}: ${status}`);
    }
  });

  const { data: workshops = [], isLoading } = useQuery<WorkshopSummary[]>(
    'workshops',
    () => workshopApi.getWorkshops({ limit: 10 }),
    {
      refetchInterval: 30000, // Fallback polling, but WebSocket should handle real-time updates
    }
  );

  // Calculate statistics
  const stats = React.useMemo(() => {
    const totalWorkshops = workshops.length;
    const activeWorkshops = workshops.filter(w => getEffectiveStatus(w) === 'active').length;
    const totalAttendees = workshops.reduce((sum, w) => sum + w.attendee_count, 0);
    const activeAttendees = workshops.reduce((sum, w) => sum + w.active_attendees, 0);

    return {
      totalWorkshops,
      activeWorkshops,
      totalAttendees,
      activeAttendees,
    };
  }, [workshops]);

  const statCards = [
    {
      name: 'Total Workshops',
      value: stats.totalWorkshops,
      icon: AcademicCapIcon,
      color: 'bg-primary-500',
    },
    {
      name: 'Active Workshops',
      value: stats.activeWorkshops,
      icon: CloudIcon,
      color: 'bg-success-500',
    },
    {
      name: 'Total Attendees',
      value: stats.totalAttendees,
      icon: UserGroupIcon,
      color: 'bg-warning-500',
    },
    {
      name: 'Active Attendees',
      value: stats.activeAttendees,
      icon: CheckCircleIcon,
      color: 'bg-danger-500',
    },
  ];


  if (isLoading) {
    return (
      <div className="animate-fade-in">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Workshop environment overview and statistics
          </p>
        </div>
        
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card">
              <div className="card-body">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          ))}
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Workshop environment overview and statistics
            </p>
          </div>
          <Link
            to="/workshops/new"
            className="btn-primary dark:bg-primary-600 dark:hover:bg-primary-500 dark:border-primary-500 dark:shadow-lg dark:focus:ring-4 dark:focus:ring-primary-300"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            New Workshop
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-12">
        {statCards.map((item) => (
          <div key={item.name} className="card">
            <div className="card-body">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className={`p-3 rounded-md ${item.color}`}>
                    <item.icon className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-300 truncate">
                      {item.name}
                    </dt>
                    <dd className="text-2xl font-bold text-gray-900 dark:text-white">
                      {item.value}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Workshops */}
      <div className="card">
        <div className="card-header">
          <div className="flex justify-between items-center">
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">
              Recent Workshops
            </h3>
            <Link
              to="/workshops"
              className="text-sm text-primary-600 hover:text-primary-500"
            >
              View all
            </Link>
          </div>
        </div>
        <div className="card-body">
          {workshops.length === 0 ? (
            <div className="text-center py-8">
              <AcademicCapIcon 
                className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-300" 
                data-testid="empty-state-icon"
              />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No workshops</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
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
            </div>
          ) : (
            <div className="overflow-hidden">
              <ul className="divide-y divide-gray-200 dark:divide-gray-600">
                {sortByStatusPriority(workshops.slice(0, 5)).map((workshop) => {
                  const effectiveStatus = getEffectiveStatus(workshop);
                  
                  return (
                    <li key={workshop.id} className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <StatusIndicator 
                              status={effectiveStatus} 
                              variant="icon" 
                              size="md"
                            />
                          </div>
                          <div className="ml-4">
                            <div className="flex items-center">
                              <Link
                                to={`/workshops/${workshop.id}`}
                                className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-primary-600"
                              >
                                {workshop.name}
                              </Link>
                              <div className="ml-2">
                                <StatusIndicator 
                                  status={effectiveStatus} 
                                  variant="badge" 
                                  size="sm"
                                  showIcon={false}
                                />
                              </div>
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-300">
                              {workshop.attendee_count} attendees • {workshop.active_attendees} active
                            </div>
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          {new Date(workshop.start_date).toLocaleDateString()}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;