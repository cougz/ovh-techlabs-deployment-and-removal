import React from 'react';


interface ProgressBarProps {
  percentage: number;
  status?: string;
  showPercentage?: boolean;
  description?: string;
  animated?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  percentage,
  status = 'active',
  showPercentage = true,
  description,
  animated = true,
  size = 'md',
  className = ''
}) => {
  // Ensure percentage is between 0 and 100
  const clampedPercentage = Math.max(0, Math.min(100, percentage));

  // Size classes for the progress bar
  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4'
  }[size];

  // Color classes based on status
  const getProgressColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'completed':
        return 'bg-success-500';
      case 'deploying':
        return 'bg-warning-500';
      case 'failed':
        return 'bg-danger-500';
      case 'deleting':
        return 'bg-orange-500';
      default:
        return 'bg-primary-500';
    }
  };

  const progressColor = getProgressColor(status);
  const animationClass = animated && status === 'deploying' ? 'animate-pulse' : '';

  return (
    <div className={`w-full ${className}`}>
      {(showPercentage || description) && (
        <div className="flex justify-between items-center mb-2">
          {description && (
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {description}
            </span>
          )}
          {showPercentage && (
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {Math.round(clampedPercentage)}%
            </span>
          )}
        </div>
      )}
      
      <div className={`w-full ${sizeClasses} bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden`}>
        <div
          className={`${sizeClasses} ${progressColor} ${animationClass} rounded-full transition-all duration-300 ease-in-out`}
          style={{ width: `${clampedPercentage}%` }}
          role="progressbar"
          aria-valuenow={clampedPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={description || `${Math.round(clampedPercentage)}% complete`}
        />
      </div>
    </div>
  );
};

export default ProgressBar;