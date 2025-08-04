import React, { useState } from 'react';
import { 
  ChevronDownIcon, 
  ChevronUpIcon,
  DocumentTextIcon,
  XMarkIcon,
  CheckCircleIcon,
  ClockIcon 
} from '@heroicons/react/24/outline';

interface LogEntry {
  id: string;
  action: string;
  status: string;
  terraform_output?: string;
  error_message?: string;
  started_at: string;
  completed_at?: string;
}

interface DeploymentLogsProps {
  logs: LogEntry[];
  isLoading?: boolean;
}

const DeploymentLogs: React.FC<DeploymentLogsProps> = ({ 
  logs, 
  isLoading = false 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="h-4 w-4 text-success-500" />;
      case 'failed':
        return <XMarkIcon className="h-4 w-4 text-danger-500" />;
      case 'running':
      case 'started':
        return <ClockIcon className="h-4 w-4 text-warning-500 animate-spin" />;
      default:
        return <ClockIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-success-700 bg-success-50 border-success-200';
      case 'failed':
        return 'text-danger-700 bg-danger-50 border-danger-200';
      case 'running':
      case 'started':
        return 'text-warning-700 bg-warning-50 border-warning-200';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const toggleLogExpansion = (logId: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogs(newExpanded);
  };

  const formatTimestamp = (timestamp: string | null | undefined) => {
    if (!timestamp) {
      return 'N/A';
    }
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      return date.toLocaleString();
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const stripAnsiCodes = (text: string | null | undefined) => {
    if (!text) return '';
    // Remove ANSI escape sequences
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1b\[[0-9;]*m/g, '');
  };

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
        <div className="h-20 bg-gray-200 rounded"></div>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center text-sm text-gray-600 hover:text-gray-800 transition-colors"
      >
        <DocumentTextIcon className="h-4 w-4 mr-1" />
        <span>Deployment Logs ({logs.length})</span>
        {isExpanded ? (
          <ChevronUpIcon className="h-4 w-4 ml-1" />
        ) : (
          <ChevronDownIcon className="h-4 w-4 ml-1" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-2">
          {logs.length === 0 ? (
            <div className="text-sm text-gray-500 italic py-4 text-center">
              {isLoading ? "Loading deployment logs..." : "No deployment logs available"}
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className={`border rounded-lg p-3 ${getStatusColor(log.status)}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(log.status)}
                    <span className="text-sm font-medium capitalize">
                      {log.action}
                    </span>
                    <span className="text-xs px-2 py-1 bg-white rounded">
                      {log.status}
                    </span>
                  </div>
                  <span className="text-xs">
                    {formatTimestamp(log.started_at)}
                  </span>
                </div>

                {log.error_message && (
                  <div className="mt-2 p-2 bg-danger-100 border border-danger-300 rounded text-sm">
                    <strong className="text-danger-800">Error:</strong>
                    <div className="mt-1 text-danger-700 font-mono text-xs whitespace-pre-wrap">
                      {stripAnsiCodes(log.error_message)}
                    </div>
                  </div>
                )}

                {(log.terraform_output || log.error_message) && (
                  <div className="mt-2">
                    <button
                      onClick={() => toggleLogExpansion(log.id)}
                      className="text-xs text-gray-600 hover:text-gray-800 flex items-center"
                    >
                      {expandedLogs.has(log.id) ? (
                        <>
                          <ChevronUpIcon className="h-3 w-3 mr-1" />
                          Hide Details
                        </>
                      ) : (
                        <>
                          <ChevronDownIcon className="h-3 w-3 mr-1" />
                          Show Details
                        </>
                      )}
                    </button>

                    {expandedLogs.has(log.id) && log.terraform_output && (
                      <div className="mt-2 p-2 bg-gray-900 text-gray-100 rounded text-xs font-mono overflow-auto max-h-64">
                        <div className="whitespace-pre-wrap">{stripAnsiCodes(log.terraform_output)}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default DeploymentLogs;