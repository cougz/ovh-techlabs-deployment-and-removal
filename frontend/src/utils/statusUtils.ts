/**
 * Centralized status utility functions for workshop and attendee status management
 */
import { WorkshopSummary, Workshop } from '../types/schemas';

/**
 * Calculate the effective status of a workshop based on attendee deployment states
 * This centralizes the logic that was duplicated across WorkshopList, Dashboard, and WorkshopDetail
 */
export function getEffectiveStatus(workshop: WorkshopSummary | Workshop): string {
  // For workshops with non-planning status, use the database status directly
  if (workshop.status !== 'planning') {
    return workshop.status;
  }

  // For planning workshops, calculate based on attendee deployment states
  if ('active_attendees' in workshop && 'attendee_count' in workshop) {
    const { active_attendees, attendee_count } = workshop;
    
    // All attendees deployed
    if (attendee_count > 0 && active_attendees === attendee_count) {
      return 'active';
    }
    
    // Some attendees deployed (partially deployed)
    if (active_attendees > 0 && active_attendees < attendee_count) {
      return 'deploying';
    }
    
    // No attendees deployed or no attendees exist
    return 'planning';
  }

  // Fallback for workshops without attendee count data
  return workshop.status;
}

/**
 * Get the appropriate CSS class for a status badge
 */
export function getStatusBadgeClass(status: string): string {
  const baseClasses = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';
  
  switch (status) {
    case 'active':
      return `${baseClasses} bg-success-100 text-success-800 dark:bg-success-900 dark:text-success-200`;
    case 'deploying':
      return `${baseClasses} bg-warning-100 text-warning-800 dark:bg-warning-900 dark:text-warning-200`;
    case 'failed':
      return `${baseClasses} bg-danger-100 text-danger-800 dark:bg-danger-900 dark:text-danger-200`;
    case 'completed':
      return `${baseClasses} bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200`;
    case 'deleting':
      return `${baseClasses} bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200`;
    case 'queued':
      return `${baseClasses} bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200`;
    case 'maintenance':
      return `${baseClasses} bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200`;
    case 'suspended':
      return `${baseClasses} bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200`;
    case 'planning':
    default:
      return `${baseClasses} bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200`;
  }
}

/**
 * Get the appropriate icon class for a status
 */
export function getStatusIconClass(status: string): string {
  switch (status) {
    case 'active':
      return 'text-success-500';
    case 'deploying':
      return 'text-warning-500 animate-spin';
    case 'failed':
      return 'text-danger-500';
    case 'completed':
      return 'text-primary-500';
    case 'deleting':
      return 'text-danger-500 animate-spin';
    case 'queued':
      return 'text-purple-500';
    case 'maintenance':
      return 'text-yellow-500';
    case 'suspended':
      return 'text-indigo-500';
    case 'planning':
    default:
      return 'text-gray-500';
  }
}

/**
 * Get human-readable status label
 */
export function getStatusLabel(status: string): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'deploying':
      return 'Deploying';
    case 'failed':
      return 'Failed';
    case 'completed':
      return 'Completed';
    case 'deleting':
      return 'Deleting';
    case 'queued':
      return 'Queued';
    case 'maintenance':
      return 'Maintenance';
    case 'suspended':
      return 'Suspended';
    case 'planning':
      return 'Planning';
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

/**
 * Get appropriate icon component name for a status
 */
export function getStatusIconName(status: string): string {
  switch (status) {
    case 'active':
      return 'CheckCircleIcon';
    case 'deploying':
      return 'ClockIcon';
    case 'failed':
      return 'ExclamationTriangleIcon';
    case 'completed':
      return 'CheckBadgeIcon';
    case 'deleting':
      return 'TrashIcon';
    case 'queued':
      return 'QueueListIcon';
    case 'maintenance':
      return 'WrenchScrewdriverIcon';
    case 'suspended':
      return 'PauseIcon';
    case 'planning':
      return 'DocumentIcon';
    default:
      return 'ClockIcon';
  }
}

/**
 * Determine if a status represents an active/running state
 */
export function isActiveStatus(status: string): boolean {
  return ['active', 'deploying', 'deleting', 'queued'].includes(status);
}

/**
 * Determine if a status represents a completed/final state
 */
export function isFinalStatus(status: string): boolean {
  return ['completed', 'failed', 'deleted'].includes(status);
}

/**
 * Get workshop deployment progress information
 */
export function getWorkshopProgress(workshop: WorkshopSummary | Workshop): {
  percentage: number;
  completedCount: number;
  totalCount: number;
  description: string;
} {
  if ('active_attendees' in workshop && 'attendee_count' in workshop) {
    const { active_attendees, attendee_count } = workshop;
    
    if (attendee_count === 0) {
      return {
        percentage: 100,
        completedCount: 0,
        totalCount: 0,
        description: 'No attendees to deploy'
      };
    }

    const percentage = Math.round((active_attendees / attendee_count) * 100);
    const effectiveStatus = getEffectiveStatus(workshop);
    
    let description = '';
    switch (effectiveStatus) {
      case 'active':
        description = `All ${attendee_count} attendees deployed`;
        break;
      case 'deploying':
        description = `${active_attendees} of ${attendee_count} attendees deployed`;
        break;
      case 'planning':
        description = 'Deployment not started';
        break;
      default:
        description = `Status: ${getStatusLabel(effectiveStatus)}`;
    }

    return {
      percentage,
      completedCount: active_attendees,
      totalCount: attendee_count,
      description
    };
  }

  // Fallback for workshops without attendee data
  return {
    percentage: 0,
    completedCount: 0,
    totalCount: 0,
    description: `Status: ${getStatusLabel(workshop.status)}`
  };
}

/**
 * Check if a workshop needs cleanup (has active resources)
 */
export function needsCleanup(workshop: WorkshopSummary | Workshop): boolean {
  const effectiveStatus = getEffectiveStatus(workshop);
  
  // Workshop needs cleanup if it's active or completed and has active attendees
  if (['active', 'completed'].includes(effectiveStatus)) {
    if ('active_attendees' in workshop) {
      return workshop.active_attendees > 0;
    }
  }
  
  return false;
}

/**
 * Sort workshops by status priority (active first, then deploying, etc.)
 */
export function sortByStatusPriority<T extends Workshop | WorkshopSummary>(workshops: T[]): T[] {
  const statusPriority: Record<string, number> = {
    'failed': 1,      // Highest priority - needs attention
    'deploying': 2,   // Currently in progress
    'active': 3,      // Running workshops
    'deleting': 4,    // Being cleaned up
    'completed': 5,   // Finished but may have resources
    'planning': 6,    // Not yet started
    'suspended': 7,   // Temporarily paused
    'maintenance': 8, // In maintenance
    'queued': 9       // Waiting to start
  };

  return [...workshops].sort((a, b) => {
    const aStatus = getEffectiveStatus(a);
    const bStatus = getEffectiveStatus(b);
    const aPriority = statusPriority[aStatus] || 10;
    const bPriority = statusPriority[bStatus] || 10;
    
    return aPriority - bPriority;
  });
}