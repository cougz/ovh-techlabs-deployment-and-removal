import React from 'react';
import {
  CheckCircleIcon,
  ClockIcon,
  XMarkIcon,
  TrashIcon,
  QueueListIcon,
  WrenchScrewdriverIcon,
  PauseIcon,
  DocumentIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import {
  CheckBadgeIcon
} from '@heroicons/react/24/solid';
import {
  getStatusBadgeClass,
  getStatusIconClass,
  getStatusLabel,
  getStatusIconName
} from '../utils/statusUtils';

interface StatusIndicatorProps {
  status: string;
  showLabel?: boolean;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'badge' | 'icon' | 'full';
  className?: string;
  animated?: boolean;
}

const iconComponents = {
  CheckCircleIcon,
  ClockIcon,
  XMarkIcon,
  CheckBadgeIcon,
  TrashIcon,
  QueueListIcon,
  WrenchScrewdriverIcon,
  PauseIcon,
  DocumentIcon,
  ExclamationTriangleIcon
};

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  showLabel = true,
  showIcon = true,
  size = 'md',
  variant = 'full',
  className = '',
  animated = true
}) => {
  const iconName = getStatusIconName(status);
  const IconComponent = iconComponents[iconName as keyof typeof iconComponents] || ClockIcon;
  const label = getStatusLabel(status);

  // Size classes for icons
  const iconSizeClass = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  }[size];

  // Size classes for text
  const textSizeClass = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  }[size];

  if (variant === 'badge') {
    return (
      <span className={`${getStatusBadgeClass(status)} ${textSizeClass} ${className}`}>
        {showIcon && (
          <IconComponent 
            className={`${iconSizeClass} ${getStatusIconClass(status)} ${animated ? '' : 'animate-none'} mr-1`}
            aria-hidden="true"
          />
        )}
        {showLabel && label}
      </span>
    );
  }

  if (variant === 'icon') {
    return (
      <IconComponent 
        className={`${iconSizeClass} ${getStatusIconClass(status)} ${animated ? '' : 'animate-none'} ${className}`}
        aria-label={label}
        title={label}
      />
    );
  }

  // Full variant - icon and label side by side
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {showIcon && (
        <IconComponent 
          className={`${iconSizeClass} ${getStatusIconClass(status)} ${animated ? '' : 'animate-none'}`}
          aria-hidden="true"
        />
      )}
      {showLabel && (
        <span className={`${textSizeClass} font-medium text-gray-900 dark:text-gray-100`}>
          {label}
        </span>
      )}
    </div>
  );
};

export default StatusIndicator;