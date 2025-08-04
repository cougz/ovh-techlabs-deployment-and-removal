import React, { useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  CalendarIcon,
  UserGroupIcon,
  PlusIcon,
  TrashIcon,
  PlayIcon,
  StopIcon,
  CheckCircleIcon,
  ClockIcon,
  EllipsisVerticalIcon,
  ArrowLeftIcon,
  PencilIcon,
  DocumentArrowDownIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

import { workshopApi, attendeeApi, deploymentApi } from '../services/api';
import { Workshop, Attendee, DeploymentLog } from '../types';
import DropdownMenu from '../components/DropdownMenu';
import DeploymentLogs from '../components/DeploymentLogs';
import EditDeletionDateDialog from '../components/EditDeletionDateDialog';
import { useWebSocket } from '../hooks/useWebSocket';
import useConfirmDialog from '../hooks/useConfirmDialog';
import useNotificationDialog from '../hooks/useNotificationDialog';

// Error boundary component for debugging
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('WorkshopDetail Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="p-8 text-center">
            <div className="text-red-500 dark:text-red-400 text-lg font-semibold">Something went wrong</div>
            <div className="text-gray-600 dark:text-gray-300 mt-2">
              {this.state.error?.message || 'An error occurred in the workshop detail page'}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 btn-primary"
            >
              Reload Page
            </button>
          </div>
        )
      );
    }

    return <>{this.props.children}</>;
  }
}

const WorkshopDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Add debugging
  console.log('WorkshopDetail render - ID:', id);
  
  const [showAddAttendee, setShowAddAttendee] = useState(false);
  const [showActions, setShowActions] = useState<string | null>(null);
  const [newAttendee, setNewAttendee] = useState({ username: '', email: '' });
  const [deploymentProgress] = useState<Record<string, { progress: number; step: string }>>({});
  const [isExporting, setIsExporting] = useState(false);
  const [isCleanupInProgress, setIsCleanupInProgress] = useState(false);
  const [showEditDeletionDate, setShowEditDeletionDate] = useState(false);
  const attendeeTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Confirmation dialogs
  const { ConfirmDialog, showConfirmDialog } = useConfirmDialog();
  
  // Notification dialogs
  const { NotificationDialog, showNotification } = useNotificationDialog();

  // WebSocket for real-time updates
  useWebSocket({
    workshopId: id || '',
    onStatusUpdate: (entityType: string, entityId: string, status: string, details?: any) => {
      console.log(`WebSocket status update: ${entityType} ${entityId} -> ${status}`, details);
      // React Query cache invalidation is handled inside useWebSocket hook
    },
    onDeploymentLog: (attendeeId: string, logEntry: any) => {
      console.log(`WebSocket deployment log for ${attendeeId}:`, logEntry);
      // Invalidate deployment logs to refetch
      queryClient.invalidateQueries(['deployment-logs', id]);
    },
    onDeploymentProgress: (attendeeId: string, progress: number, currentStep: string) => {
      console.log(`WebSocket deployment progress for ${attendeeId}: ${progress}% - ${currentStep}`);
      // Real-time progress updates could be stored in component state if needed
    }
  });

  // Fetch workshop details
  const { data: workshop, isLoading: workshopLoading, error: workshopError } = useQuery<Workshop>(
    ['workshop', id],
    () => workshopApi.getWorkshop(id!),
    {
      enabled: !!id,
      refetchInterval: 5000, // Fixed 5-second interval to avoid circular dependency
    }
  );

  // Fetch attendees
  const { data: attendees = [], isLoading: attendeesLoading, refetch: refetchAttendees } = useQuery<Attendee[]>(
    ['attendees', id],
    () => attendeeApi.getWorkshopAttendees(id!),
    {
      enabled: !!id,
      refetchInterval: 3000, // Fixed 3-second interval
    }
  );

  // Fetch deployment logs for active deployments
  const { data: deploymentLogs = {} } = useQuery<Record<string, DeploymentLog[]>>(
    ['deployment-logs', id],
    async () => {
      if (!attendees.length) return {};
      
      const logsPromises = attendees.map(async (attendee) => {
        try {
          const logs = await deploymentApi.getAttendeeDeploymentLogs(attendee.id);
          return [attendee.id, logs];
        } catch (error) {
          return [attendee.id, []];
        }
      });
      
      const results = await Promise.all(logsPromises);
      return Object.fromEntries(results);
    },
    {
      enabled: !!id && attendees.length > 0,
      refetchInterval: 10000, // Fixed 10-second interval
    }
  );

  // Add attendee mutation
  const addAttendeeMutation = useMutation(
    (attendeeData: { username: string; email: string }) => 
      attendeeApi.createAttendee(id!, attendeeData),
    {
      onSuccess: () => {
        refetchAttendees();
        setNewAttendee({ username: '', email: '' });
        setShowAddAttendee(false);
      },
      onError: (error: any) => {
        console.error('Failed to add attendee:', error);
        showNotification({
          title: 'Error',
          message: 'Failed to add attendee: ' + (error.response?.data?.detail || 'Unknown error'),
          type: 'error'
        });
      }
    }
  );

  // Delete attendee mutation
  const deleteAttendeeMutation = useMutation(
    (attendeeId: string) => attendeeApi.deleteAttendee(attendeeId),
    {
      onSuccess: () => {
        refetchAttendees();
        setShowActions(null);
      },
      onError: (error: any) => {
        console.error('Failed to delete attendee:', error);
        showNotification({
          title: 'Error',
          message: 'Failed to delete attendee: ' + (error.response?.data?.detail || 'Unknown error'),
          type: 'error'
        });
      }
    }
  );

  // Deploy workshop mutation
  const deployWorkshopMutation = useMutation(
    () => workshopApi.deployWorkshop(id!),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['workshop', id]);
        refetchAttendees();
      },
      onError: (error: any) => {
        console.error('Failed to deploy workshop:', error);
        showNotification({
          title: 'Error',
          message: 'Failed to deploy workshop: ' + (error.response?.data?.detail || 'Unknown error'),
          type: 'error'
        });
      }
    }
  );

  // Cleanup workshop mutation
  const cleanupWorkshopMutation = useMutation(
    () => workshopApi.cleanupWorkshop(id!),
    {
      onMutate: () => {
        setIsCleanupInProgress(true);
      },
      onSuccess: () => {
        queryClient.invalidateQueries(['workshop', id]);
        refetchAttendees();
        setIsCleanupInProgress(false);
      },
      onError: (error: any) => {
        console.error('Failed to cleanup workshop:', error);
        showNotification({
          title: 'Error',
          message: 'Failed to cleanup workshop: ' + (error.response?.data?.detail || 'Unknown error'),
          type: 'error'
        });
        setIsCleanupInProgress(false);
      }
    }
  );

  // Update workshop mutation
  const updateWorkshopMutation = useMutation(
    (data: { deletion_scheduled_at?: string | null }) => {
      // Convert null to undefined for API compatibility
      const apiData: any = {};
      if (data.deletion_scheduled_at !== null) {
        apiData.deletion_scheduled_at = data.deletion_scheduled_at;
      }
      return workshopApi.updateWorkshop(id!, apiData);
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['workshop', id]);
        showNotification({
          title: 'Success',
          message: 'Deletion date updated successfully',
          type: 'success'
        });
      },
      onError: (error: any) => {
        console.error('Failed to update workshop:', error);
        showNotification({
          title: 'Error',
          message: 'Failed to update deletion date: ' + (error.response?.data?.detail || 'Unknown error'),
          type: 'error'
        });
      }
    }
  );

  // Delete workshop mutation
  const deleteWorkshopMutation = useMutation(
    () => workshopApi.deleteWorkshop(id!),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('workshops');
        navigate('/workshops');
      },
      onError: (error: any) => {
        console.error('Failed to delete workshop:', error);
        showNotification({
          title: 'Error',
          message: 'Failed to delete workshop: ' + (error.response?.data?.detail || 'Unknown error'),
          type: 'error'
        });
      }
    }
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircleIcon className="h-5 w-5 text-success-500" />;
      case 'deploying':
        return <ClockIcon className="h-5 w-5 text-warning-500 animate-spin" />;
      case 'failed':
        return <XMarkIcon className="h-5 w-5 text-danger-500" />;
      case 'deleting':
        return <ClockIcon className="h-5 w-5 text-danger-500 animate-spin" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'status-active';
      case 'deploying':
        return 'status-deploying';
      case 'failed':
        return 'status-failed';
      case 'deleting':
        return 'status-deleting';
      default:
        return 'status-planning';
    }
  };

  const handleAddAttendee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAttendee.username.trim() || !newAttendee.email.trim()) {
      showNotification({
        title: 'Validation Error',
        message: 'Please fill in all fields',
        type: 'warning'
      });
      return;
    }
    addAttendeeMutation.mutate(newAttendee);
  };

  const handleDeployWorkshop = () => {
    if (attendees.length === 0) {
      showNotification({
        title: 'Validation Error',
        message: 'Please add attendees before deploying the workshop',
        type: 'warning'
      });
      return;
    }
    
    showConfirmDialog({
      title: 'Deploy Workshop',
      message: `Deploy workshop resources for ${attendees.length} attendees?`,
      onConfirm: () => deployWorkshopMutation.mutate(),
      variant: 'default',
      confirmLabel: 'Deploy',
    });
  };

  const handleCleanupWorkshop = () => {
    if (isCleanupInProgress) {
      return; // Prevent multiple clicks
    }
    
    showConfirmDialog({
      title: 'Cleanup Resources',
      message: 'This will destroy all workshop resources. Are you sure?',
      onConfirm: () => {
        setIsCleanupInProgress(true);
        cleanupWorkshopMutation.mutate();
      },
      variant: 'danger',
      confirmLabel: 'Cleanup',
    });
  };

  const handleDeleteWorkshop = () => {
    const activeAttendees = attendees.filter(a => ['active', 'deploying'].includes(a.status));
    if (activeAttendees.length > 0) {
      showNotification({
        title: 'Cannot Delete',
        message: 'Cannot delete workshop with active deployments. Please cleanup resources first.',
        type: 'warning'
      });
      return;
    }
    
    showConfirmDialog({
      title: 'Delete Workshop',
      message: 'This will permanently delete the workshop. Are you sure?',
      onConfirm: () => deleteWorkshopMutation.mutate(),
      variant: 'danger',
      confirmLabel: 'Delete',
    });
  };

  const handleExportAttendees = async () => {
    if (!workshop) {
      showNotification({
        title: 'Error',
        message: 'Workshop data not available',
        type: 'error'
      });
      return;
    }
    
    setIsExporting(true);
    
    try {
      // Filter for only deployed attendees (active status)
      const activeAttendees = attendees.filter(a => a.status === 'active');
      
      if (activeAttendees.length === 0) {
        // Create export file with no deployed environments message
        const content = `${workshop.name} - Attendee List\n\nNo deployed attendee environments found.`;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `${workshop.name} - Attendee List - ${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return;
      }
      
      // Fetch credentials for all active attendees
      const credentialsPromises = activeAttendees.map(attendee =>
        attendeeApi.getAttendeeCredentials(attendee.id)
      );
      
      const credentials = await Promise.all(credentialsPromises);
      
      // Format the export data
      let content = `${workshop.name} - Attendee List\n\n`;
      
      credentials.forEach((cred, index) => {
        const attendee = activeAttendees[index];
        content += `Username: ${cred.username}\n`;
        content += `Email: ${attendee.email}\n`;
        content += `Password: ${cred.password}\n`;
        if (cred.ovh_project_id) {
          content += `Project ID: ${cred.ovh_project_id}\n`;
        }
        content += `\n`;
      });
      
      // Create and trigger download
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `${workshop.name} - Attendee List - ${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Failed to export attendee list:', error);
      showNotification({
        title: 'Export Failed',
        message: 'Failed to export attendee list: ' + (error instanceof Error ? error.message : 'Unknown error'),
        type: 'error'
      });
    } finally {
      setIsExporting(false);
    }
  };


  // Handle missing ID
  if (!id) {
    return (
      <div className="animate-fade-in">
        <div className="card">
          <div className="card-body">
            <div className="text-center py-8">
              <XMarkIcon className="mx-auto h-12 w-12 text-danger-400 dark:text-danger-300" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">Invalid Workshop ID</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
                No workshop ID provided in the URL.
              </p>
              <div className="mt-6">
                <Link to="/workshops" className="btn-primary">
                  Back to Workshops
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (workshopLoading) {
    return (
      <div className="animate-fade-in">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="space-y-4">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (workshopError || !workshop) {
    return (
      <div className="animate-fade-in">
        <div className="mb-8">
          <Link
            to="/workshops"
            className="inline-flex items-center text-sm text-primary-600 hover:text-primary-500 mb-4"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back to Workshops
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Workshop Not Found</h1>
        </div>
        
        <div className="card">
          <div className="card-body">
            <div className="text-center py-8">
              <XMarkIcon className="mx-auto h-12 w-12 text-danger-400 dark:text-danger-300" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">Workshop not found</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
                The workshop you're looking for doesn't exist or has been deleted.
              </p>
              <div className="mt-6">
                <Link to="/workshops" className="btn-primary">
                  Back to Workshops
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDeletionDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error('Invalid deletion date:', dateString, error);
      return 'Invalid date';
    }
  };

  const activeAttendees = attendees.filter(a => a.status === 'active').length;
  const failedAttendees = attendees.filter(a => a.status === 'failed').length;
  
  // Check if all attendees are actually deployed (handles edge case where workshop status is stale)
  const hasDeployedAttendees = activeAttendees > 0;
  
  // Check if resources need cleanup (active or failed attendees that haven't been deleted)
  const needsCleanup = attendees.some(a => ['active', 'failed'].includes(a.status));
  
  // Dynamic status logic based on actual attendee states
  const deployingAttendees = attendees.filter(a => a.status === 'deploying').length;
  const allAttendeesDeployed = attendees.length > 0 && attendees.every(a => a.status === 'active');
  const noAttendeesDeployed = attendees.length > 0 && attendees.every(a => a.status === 'planning');
  const partiallyDeployed = attendees.length > 0 && !allAttendeesDeployed && !noAttendeesDeployed && deployingAttendees === 0;
  
  // Calculate effective status message based on workshop status and attendee states
  const getEffectiveStatusMessage = () => {
    // If workshop status is not planning, use the regular status logic
    if (workshop.status !== 'planning') {
      if (workshop.status === 'deploying' || deployingAttendees > 0) return 'Deployment in progress';
      if (workshop.status === 'active') return 'Workshop running';
      if (workshop.status === 'completed' && needsCleanup) return 'Workshop completed - resources active';
      if (workshop.status === 'completed' && !needsCleanup) return 'Workshop completed - resources cleaned up';
      if (workshop.status === 'failed') return 'Deployment failed';
      if (workshop.status === 'deleting') return 'Cleanup in progress';
    }
    
    // Special logic for planning status - check actual attendee deployment states
    if (workshop.status === 'planning') {
      if (deployingAttendees > 0) return 'Deployment in progress';
      if (allAttendeesDeployed) return 'All attendees deployed';
      if (partiallyDeployed) return 'Partially deployed';
      if (noAttendeesDeployed) return 'Ready to deploy';
    }
    
    return 'Ready to deploy'; // fallback
  };

  // Calculate effective status for header display (simple status string)
  const getEffectiveStatus = () => {
    // If workshop status is not planning, use the regular status logic
    if (workshop.status !== 'planning') {
      if (workshop.status === 'deploying' || deployingAttendees > 0) return 'deploying';
      if (workshop.status === 'active') return 'active';
      if (workshop.status === 'completed') return 'completed';
      if (workshop.status === 'failed') return 'failed';
      if (workshop.status === 'deleting') return 'deleting';
    }
    
    // Special logic for planning status - check actual attendee deployment states
    if (workshop.status === 'planning') {
      if (deployingAttendees > 0) return 'deploying';
      if (allAttendeesDeployed) return 'active';
      if (partiallyDeployed) return 'deploying'; // Show as deploying for partially deployed
      if (noAttendeesDeployed) return 'planning';
    }
    
    return 'planning'; // fallback
  };

  return (
    <ErrorBoundary>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/workshops"
            className="inline-flex items-center text-sm text-primary-600 hover:text-primary-500 mb-4"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back to Workshops
          </Link>
          
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-3">
                {getStatusIcon(getEffectiveStatus())}
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">{workshop.name}</h1>
                <span className={`${getStatusClass(getEffectiveStatus())} whitespace-nowrap flex-shrink-0`}>
                  {getEffectiveStatus()}
                </span>
              </div>
              {workshop.description && (
                <p className="mt-2 text-gray-600 dark:text-gray-300">{workshop.description}</p>
              )}
            </div>
            
            <div className="flex flex-wrap items-center gap-3 flex-shrink-0">
              {workshop.status === 'planning' && attendees.length > 0 && !allAttendeesDeployed && deployingAttendees === 0 && (
                <button
                  onClick={handleDeployWorkshop}
                  disabled={deployWorkshopMutation.isLoading}
                  className="btn-primary whitespace-nowrap"
                >
                  <PlayIcon className="h-4 w-4 mr-2" />
                  {deployWorkshopMutation.isLoading ? 'Deploying...' : 'Deploy Workshop'}
                </button>
              )}
              
              {needsCleanup && (workshop.status === 'active' || workshop.status === 'completed' || hasDeployedAttendees) && (
                <button
                  onClick={handleCleanupWorkshop}
                  disabled={isCleanupInProgress}
                  className="btn-danger whitespace-nowrap"
                >
                  <StopIcon className="h-4 w-4 mr-2" />
                  {isCleanupInProgress ? 'Cleaning up...' : 'Cleanup Resources'}
                </button>
              )}
              
              <button
                onClick={handleDeleteWorkshop}
                disabled={deleteWorkshopMutation.isLoading}
                className="btn-danger whitespace-nowrap"
              >
                <TrashIcon className="h-4 w-4 mr-2" />
                {deleteWorkshopMutation.isLoading ? 'Deleting...' : 'Delete Workshop'}
              </button>
            </div>
          </div>
        </div>

        {/* Workshop Info */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <div className="card-body">
              <div className="flex items-center">
                <CalendarIcon className="h-8 w-8 text-primary-500 mr-3" />
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Schedule</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {formatDate(workshop.start_date)}
                    <br />
                    <span className="text-xs">to</span> {formatDate(workshop.end_date)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="flex items-center">
                <UserGroupIcon className="h-8 w-8 text-success-500 mr-3" />
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Attendees</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {attendees.length} total
                    {activeAttendees > 0 && (
                      <span className="text-success-600 dark:text-success-400"> • {activeAttendees} active</span>
                    )}
                    {failedAttendees > 0 && (
                      <span className="text-danger-600 dark:text-danger-400"> • {failedAttendees} failed</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="flex items-center">
                <CheckCircleIcon className="h-8 w-8 text-warning-500 mr-3" />
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Status</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {getEffectiveStatusMessage()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {workshop.deletion_scheduled_at ? (
            <div className="card">
              <div className="card-body">
                <div className="flex items-center">
                  <ClockIcon className="h-8 w-8 text-blue-500 mr-3" />
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Cleanup Schedule</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Environment deletion
                      <br />
                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        {formatDeletionDate(workshop.deletion_scheduled_at)}
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={() => setShowEditDeletionDate(true)}
                    className="text-blue-600 hover:text-blue-700 p-2"
                    title="Edit deletion date"
                  >
                    <PencilIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-body">
                <div className="flex items-center">
                  <CalendarIcon className="h-8 w-8 text-gray-400 mr-3" />
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Cleanup Schedule</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      No automatic cleanup scheduled
                    </p>
                  </div>
                  <button
                    onClick={() => setShowEditDeletionDate(true)}
                    className="text-blue-600 hover:text-blue-700 p-2"
                    title="Set deletion date"
                  >
                    <PlusIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Attendees Section */}
        <div className="card">
          <div className="card-header">
            <div className="flex justify-between items-center">
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">
                Attendees ({attendees.length})
              </h3>
              <div className="flex space-x-3">
                <button
                  onClick={handleExportAttendees}
                  disabled={isExporting}
                  className="btn-secondary"
                >
                  <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                  {isExporting ? 'Exporting...' : 'Export Attendee List'}
                </button>
                <button
                  onClick={() => setShowAddAttendee(true)}
                  className="btn-primary"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Add Attendee
                </button>
              </div>
            </div>
          </div>
          
          <div className="card-body">
            {/* Add Attendee Form */}
            {showAddAttendee && (
              <div className="mb-6 p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
                <form onSubmit={handleAddAttendee} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Username *
                      </label>
                      <input
                        type="text"
                        value={newAttendee.username}
                        onChange={(e) => setNewAttendee(prev => ({ ...prev, username: e.target.value }))}
                        className="block w-full rounded-md border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                        placeholder="e.g., john-doe"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Email *
                      </label>
                      <input
                        type="email"
                        value={newAttendee.email}
                        onChange={(e) => setNewAttendee(prev => ({ ...prev, email: e.target.value }))}
                        className="block w-full rounded-md border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                        placeholder="john-doe@example.com"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddAttendee(false);
                        setNewAttendee({ username: '', email: '' });
                      }}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={addAttendeeMutation.isLoading}
                      className="btn-primary"
                    >
                      {addAttendeeMutation.isLoading ? 'Adding...' : 'Add Attendee'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Attendees List */}
            {attendeesLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse flex items-center space-x-4">
                    <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : attendees.length === 0 ? (
              <div className="text-center py-8">
                <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-300" />
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No attendees</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
                  Add attendees to get started with your workshop.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {attendees.map((attendee) => (
                  <div key={attendee.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-slate-600 rounded-lg">
                    <div className="flex items-center space-x-4">
                      {getStatusIcon(attendee.status)}
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">{attendee.username}</h4>
                          <span className={`${getStatusClass(attendee.status)} text-xs`}>
                            {attendee.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{attendee.email}</p>
                        {attendee.ovh_project_id && (
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            Project: {attendee.ovh_project_id}
                          </p>
                        )}
                        
                        {/* Deletion scheduled date */}
                        {attendee.deletion_scheduled_at && (
                          <p className="text-xs text-blue-600 dark:text-blue-400">
                            Will be deleted on {formatDeletionDate(attendee.deletion_scheduled_at)}
                          </p>
                        )}
                        
                        {/* Real-time deployment progress */}
                        {deploymentProgress[attendee.id] && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                              <span>{deploymentProgress[attendee.id].step}</span>
                              <span>{deploymentProgress[attendee.id].progress}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${deploymentProgress[attendee.id].progress}%` }}
                              ></div>
                            </div>
                          </div>
                        )}

                        {/* Deployment logs */}
                        <ErrorBoundary fallback={<div className="text-xs text-gray-400">Logs unavailable</div>}>
                          <DeploymentLogs
                            logs={deploymentLogs[attendee.id] || []}
                            isLoading={false}
                          />
                        </ErrorBoundary>
                      </div>
                    </div>
                    
                    <div>
                      <button
                        ref={(el) => { attendeeTriggerRefs.current[attendee.id] = el; }}
                        onClick={() => setShowActions(showActions === attendee.id ? null : attendee.id)}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-50"
                      >
                        <EllipsisVerticalIcon className="h-5 w-5" />
                      </button>
                      
                      <ErrorBoundary fallback={<div>Menu error</div>}>
                        <DropdownMenu
                          isOpen={showActions === attendee.id}
                          onClose={() => setShowActions(null)}
                          trigger={{ current: attendeeTriggerRefs.current[attendee.id] }}
                        >
                          <div className="py-1">
                            <Link
                              to={`/attendees/${attendee.id}`}
                              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              onClick={() => setShowActions(null)}
                            >
                              <PencilIcon className="h-4 w-4 mr-2" />
                              View Details
                            </Link>
                            
                            {attendee.status !== 'deleting' && (
                              <button
                                onClick={() => {
                                  setShowActions(null);
                                  showConfirmDialog({
                                    title: 'Remove Attendee',
                                    message: `Remove ${attendee.username} from the workshop?`,
                                    onConfirm: () => deleteAttendeeMutation.mutate(attendee.id),
                                    variant: 'danger',
                                    confirmLabel: 'Remove',
                                  });
                                }}
                                className="flex items-center w-full px-4 py-2 text-sm text-danger-600 hover:bg-danger-50"
                              >
                                <TrashIcon className="h-4 w-4 mr-2" />
                                Remove Attendee
                              </button>
                            )}
                          </div>
                        </DropdownMenu>
                      </ErrorBoundary>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Confirmation dialogs */}
      <ConfirmDialog />
      
      {/* Notification dialogs */}
      <NotificationDialog />
      
      {/* Edit deletion date dialog */}
      {workshop && (
        <EditDeletionDateDialog
          isOpen={showEditDeletionDate}
          onClose={() => setShowEditDeletionDate(false)}
          onConfirm={(date) => {
            updateWorkshopMutation.mutate({ deletion_scheduled_at: date });
            setShowEditDeletionDate(false);
          }}
          currentDate={workshop.deletion_scheduled_at}
          workshopName={workshop.name}
          workshopEndDate={workshop.end_date}
        />
      )}
    </ErrorBoundary>
  );
};

export default WorkshopDetail;