import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import {
  ArrowLeftIcon,
  UserIcon,
  KeyIcon,
  PlayIcon,
  StopIcon,
  TrashIcon,
  DocumentTextIcon,
  EyeIcon,
  EyeSlashIcon,
  ClipboardDocumentIcon,
  CheckCircleIcon,
  ClockIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

import { attendeeApi, deploymentApi } from '../services/api';
import { Attendee, AttendeeCredentials, DeploymentLog } from '../types';

const AttendeeView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  
  const [showCredentials, setShowCredentials] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Fetch attendee details
  const { data: attendee, isLoading: attendeeLoading, error: attendeeError } = useQuery<Attendee>(
    ['attendee', id],
    () => attendeeApi.getAttendee(id!),
    { 
      enabled: !!id,
      refetchInterval: 10000
    }
  );

  // Fetch attendee credentials
  const { data: credentials, isLoading: credentialsLoading } = useQuery<AttendeeCredentials>(
    ['attendee-credentials', id],
    () => attendeeApi.getAttendeeCredentials(id!),
    { 
      enabled: !!id && attendee?.status === 'active',
      refetchInterval: false
    }
  );

  // Fetch deployment logs
  const { data: deploymentLogs = [], isLoading: logsLoading } = useQuery<DeploymentLog[]>(
    ['deployment-logs', id],
    () => deploymentApi.getAttendeeDeploymentLogs(id!),
    { 
      enabled: !!id,
      refetchInterval: 30000
    }
  );

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

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

  if (attendeeLoading) {
    return (
      <div className="animate-fade-in">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-4">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (attendeeError || !attendee) {
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
          <h1 className="text-2xl font-bold text-gray-900">Attendee Not Found</h1>
        </div>
        
        <div className="card">
          <div className="card-body">
            <div className="text-center py-8">
              <XMarkIcon className="mx-auto h-12 w-12 text-danger-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Attendee not found</h3>
              <p className="mt-1 text-sm text-gray-500">
                The attendee you're looking for doesn't exist or has been deleted.
              </p>
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
        <Link
          to={`/workshops/${attendee.workshop_id}`}
          className="inline-flex items-center text-sm text-primary-600 hover:text-primary-500 mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to Workshop
        </Link>
        
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-3">
              {getStatusIcon(attendee.status)}
              <h1 className="text-2xl font-bold text-gray-900">{attendee.username}</h1>
              <span className={`${getStatusClass(attendee.status)} whitespace-nowrap flex-shrink-0`}>
                {attendee.status}
              </span>
            </div>
            <p className="mt-2 text-gray-600">{attendee.email}</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 flex-shrink-0">
            {(attendee.status === 'planning' || attendee.status === 'failed') && (
              <button
                onClick={() => console.log('Deploy individual attendee')}
                className="btn-primary whitespace-nowrap"
              >
                <PlayIcon className="h-4 w-4 mr-2" />
                Deploy Resources
              </button>
            )}
            
            {attendee.status === 'active' && (
              <button
                onClick={() => console.log('Destroy individual attendee')}
                className="btn-danger whitespace-nowrap"
              >
                <StopIcon className="h-4 w-4 mr-2" />
                Destroy Resources
              </button>
            )}
            
            <button
              onClick={() => console.log('Delete attendee')}
              className="btn-danger whitespace-nowrap"
            >
              <TrashIcon className="h-4 w-4 mr-2" />
              Remove Attendee
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendee Information */}
        <div className="space-y-6">
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <UserIcon className="h-5 w-5 mr-2" />
                Attendee Information
              </h3>
            </div>
            <div className="card-body space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Username</label>
                <p className="mt-1 text-sm text-gray-900">{attendee.username}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <p className="mt-1 text-sm text-gray-900">{attendee.email}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <div className="mt-1 flex items-center space-x-2">
                  {getStatusIcon(attendee.status)}
                  <span className={getStatusClass(attendee.status)}>
                    {attendee.status}
                  </span>
                </div>
              </div>
              
              {attendee.ovh_project_id && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">OVH Project ID</label>
                  <p className="mt-1 text-sm text-gray-900 font-mono">{attendee.ovh_project_id}</p>
                </div>
              )}
            </div>
          </div>

          {/* Credentials */}
          {attendee.status === 'active' && (
            <div className="card">
              <div className="card-header">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900 flex items-center">
                    <KeyIcon className="h-5 w-5 mr-2" />
                    Access Credentials
                  </h3>
                  <button
                    onClick={() => setShowCredentials(!showCredentials)}
                    className="text-sm text-primary-600 hover:text-primary-500 flex items-center"
                  >
                    {showCredentials ? (
                      <>
                        <EyeSlashIcon className="h-4 w-4 mr-1" />
                        Hide
                      </>
                    ) : (
                      <>
                        <EyeIcon className="h-4 w-4 mr-1" />
                        Show
                      </>
                    )}
                  </button>
                </div>
              </div>
              <div className="card-body">
                {credentialsLoading ? (
                  <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                    <div className="h-8 bg-gray-200 rounded"></div>
                  </div>
                ) : credentials && showCredentials ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                      <div className="flex items-center space-x-2">
                        <code className="flex-1 px-3 py-2 bg-gray-50 border rounded text-sm font-mono">
                          {credentials.username}
                        </code>
                        <button
                          onClick={() => copyToClipboard(credentials.username, 'username')}
                          className="p-2 text-gray-400 hover:text-gray-600"
                        >
                          {copiedField === 'username' ? (
                            <CheckCircleIcon className="h-4 w-4 text-success-500" />
                          ) : (
                            <ClipboardDocumentIcon className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                      <div className="flex items-center space-x-2">
                        <code className="flex-1 px-3 py-2 bg-gray-50 border rounded text-sm font-mono">
                          {credentials.password}
                        </code>
                        <button
                          onClick={() => copyToClipboard(credentials.password, 'password')}
                          className="p-2 text-gray-400 hover:text-gray-600"
                        >
                          {copiedField === 'password' ? (
                            <CheckCircleIcon className="h-4 w-4 text-success-500" />
                          ) : (
                            <ClipboardDocumentIcon className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {credentials.access_key && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Access Key</label>
                        <div className="flex items-center space-x-2">
                          <code className="flex-1 px-3 py-2 bg-gray-50 border rounded text-sm font-mono">
                            {credentials.access_key}
                          </code>
                          <button
                            onClick={() => copyToClipboard(credentials.access_key!, 'access_key')}
                            className="p-2 text-gray-400 hover:text-gray-600"
                          >
                            {copiedField === 'access_key' ? (
                              <CheckCircleIcon className="h-4 w-4 text-success-500" />
                            ) : (
                              <ClipboardDocumentIcon className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {credentials.secret_key && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Secret Key</label>
                        <div className="flex items-center space-x-2">
                          <code className="flex-1 px-3 py-2 bg-gray-50 border rounded text-sm font-mono">
                            {credentials.secret_key}
                          </code>
                          <button
                            onClick={() => copyToClipboard(credentials.secret_key!, 'secret_key')}
                            className="p-2 text-gray-400 hover:text-gray-600"
                          >
                            {copiedField === 'secret_key' ? (
                              <CheckCircleIcon className="h-4 w-4 text-success-500" />
                            ) : (
                              <ClipboardDocumentIcon className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    {attendee.status === 'active' 
                      ? 'Click "Show" to view credentials' 
                      : 'Credentials will be available once resources are deployed'
                    }
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Deployment Logs */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <DocumentTextIcon className="h-5 w-5 mr-2" />
              Deployment History
            </h3>
          </div>
          <div className="card-body">
            {logsLoading ? (
              <div className="animate-pulse space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-200 rounded"></div>
                ))}
              </div>
            ) : deploymentLogs.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                No deployment history available
              </p>
            ) : (
              <div className="space-y-4">
                {deploymentLogs.map((log) => (
                  <div key={log.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          log.status === 'completed' ? 'bg-success-100 text-success-800' :
                          log.status === 'failed' ? 'bg-danger-100 text-danger-800' :
                          log.status === 'running' ? 'bg-warning-100 text-warning-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {log.action}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          log.status === 'completed' ? 'bg-success-100 text-success-800' :
                          log.status === 'failed' ? 'bg-danger-100 text-danger-800' :
                          log.status === 'running' ? 'bg-warning-100 text-warning-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {log.status}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(log.started_at).toLocaleString()}
                      </span>
                    </div>
                    
                    {log.error_message && (
                      <div className="mt-2 p-2 bg-danger-50 border border-danger-200 rounded text-xs">
                        <strong className="text-danger-800">Error:</strong>
                        <pre className="mt-1 text-danger-700 whitespace-pre-wrap">{log.error_message}</pre>
                      </div>
                    )}
                    
                    {log.terraform_output && (
                      <details className="mt-2">
                        <summary className="text-xs text-gray-600 cursor-pointer">
                          View Terraform Output
                        </summary>
                        <pre className="mt-1 p-2 bg-gray-50 border rounded text-xs text-gray-700 whitespace-pre-wrap overflow-auto max-h-32">
                          {log.terraform_output}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendeeView;