import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DeploymentLogs from '../DeploymentLogs';

interface LogEntry {
  id: string;
  action: string;
  status: string;
  terraform_output?: string;
  error_message?: string;
  started_at: string;
  completed_at?: string;
}

describe('DeploymentLogs Component', () => {
  const mockLogs: LogEntry[] = [
    {
      id: 'log-1',
      action: 'create_project',
      status: 'completed',
      terraform_output: 'Project created successfully\nProject ID: test-project-123',
      started_at: '2024-07-01T10:00:00Z',
    },
    {
      id: 'log-2',
      action: 'deploy_resources',
      status: 'running',
      terraform_output: 'Deploying compute instances...',
      started_at: '2024-07-01T10:05:00Z',
    },
    {
      id: 'log-3',
      action: 'deploy_network',
      status: 'failed',
      terraform_output: 'Network deployment failed',
      error_message: 'Insufficient quota for public IP allocation',
      started_at: '2024-07-01T10:08:00Z',
    },
  ];

  describe('when logs are provided', () => {
    it('should display deployment logs count in collapsed state', () => {
      render(<DeploymentLogs logs={mockLogs} isLoading={false} />);
      expect(screen.getByText('Deployment Logs (3)')).toBeInTheDocument();
    });

    it('should expand and show log details when clicked', () => {
      render(<DeploymentLogs logs={mockLogs} isLoading={false} />);
      
      // Click to expand logs
      fireEvent.click(screen.getByText('Deployment Logs (3)'));
      
      expect(screen.getByText('create_project')).toBeInTheDocument();
      expect(screen.getByText('deploy_resources')).toBeInTheDocument();
      expect(screen.getByText('deploy_network')).toBeInTheDocument();
    });

    it('should show status indicators when expanded', () => {
      render(<DeploymentLogs logs={mockLogs} isLoading={false} />);
      
      fireEvent.click(screen.getByText('Deployment Logs (3)'));
      
      expect(screen.getByText('completed')).toBeInTheDocument();
      expect(screen.getByText('running')).toBeInTheDocument();
      expect(screen.getByText('failed')).toBeInTheDocument();
    });

    it('should display error messages for failed logs', () => {
      render(<DeploymentLogs logs={mockLogs} isLoading={false} />);
      
      fireEvent.click(screen.getByText('Deployment Logs (3)'));
      
      expect(screen.getByText('Insufficient quota for public IP allocation')).toBeInTheDocument();
    });
  });

  describe('terraform output expansion', () => {
    it('should show details toggle buttons', () => {
      render(<DeploymentLogs logs={mockLogs} isLoading={false} />);
      
      fireEvent.click(screen.getByText('Deployment Logs (3)'));
      
      const showDetailsButtons = screen.getAllByText('Show Details');
      expect(showDetailsButtons.length).toBeGreaterThan(0);
    });

    it('should expand terraform output when Show Details is clicked', () => {
      render(<DeploymentLogs logs={mockLogs} isLoading={false} />);
      
      fireEvent.click(screen.getByText('Deployment Logs (3)'));
      
      const firstShowDetails = screen.getAllByText('Show Details')[0];
      fireEvent.click(firstShowDetails);
      
      // Check for part of the terraform output that should be visible
      expect(screen.getByText(/Project created successfully/)).toBeInTheDocument();
    });

    it('should show Hide Details button when expanded', () => {
      render(<DeploymentLogs logs={mockLogs} isLoading={false} />);
      
      fireEvent.click(screen.getByText('Deployment Logs (3)'));
      
      const firstShowDetails = screen.getAllByText('Show Details')[0];
      fireEvent.click(firstShowDetails);
      
      expect(screen.getByText('Hide Details')).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('should show loading skeleton when isLoading is true', () => {
      render(<DeploymentLogs logs={[]} isLoading={true} />);
      
      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });

    it('should not show logs content when loading', () => {
      render(<DeploymentLogs logs={mockLogs} isLoading={true} />);
      
      expect(screen.queryByText('Deployment Logs')).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('should show empty message when no logs and expanded', () => {
      render(<DeploymentLogs logs={[]} isLoading={false} />);
      
      fireEvent.click(screen.getByText('Deployment Logs (0)'));
      
      expect(screen.getByText(/no deployment logs available/i)).toBeInTheDocument();
    });
  });

  describe('accessibility and interaction', () => {
    it('should handle collapse and expand correctly', () => {
      render(<DeploymentLogs logs={mockLogs} isLoading={false} />);
      
      // Start collapsed - logs should not be visible
      expect(screen.queryByText('create_project')).not.toBeInTheDocument();
      
      // Expand
      fireEvent.click(screen.getByText('Deployment Logs (3)'));
      expect(screen.getByText('create_project')).toBeInTheDocument();
      
      // Collapse again
      fireEvent.click(screen.getByText('Deployment Logs (3)'));
      expect(screen.queryByText('create_project')).not.toBeInTheDocument();
    });

    it('should handle individual log detail expansion', () => {
      render(<DeploymentLogs logs={mockLogs} isLoading={false} />);
      
      fireEvent.click(screen.getByText('Deployment Logs (3)'));
      
      // Initially terraform output should not be visible
      expect(screen.queryByText('Project created successfully')).not.toBeInTheDocument();
      
      // Expand first log details
      const showDetailsButtons = screen.getAllByText('Show Details');
      fireEvent.click(showDetailsButtons[0]);
      
      // Now terraform output should be visible
      expect(screen.getByText(/Project created successfully/)).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('should handle logs without error messages', () => {
      const logsWithoutErrors = mockLogs.filter(log => !log.error_message);
      
      render(<DeploymentLogs logs={logsWithoutErrors} isLoading={false} />);
      
      fireEvent.click(screen.getByText('Deployment Logs (2)'));
      
      expect(screen.queryByText('Error:')).not.toBeInTheDocument();
    });

    it('should format timestamps correctly', () => {
      render(<DeploymentLogs logs={mockLogs} isLoading={false} />);
      
      fireEvent.click(screen.getByText('Deployment Logs (3)'));
      
      // Should show some date format - use getAllByText since there are multiple timestamps
      const timestamps = screen.getAllByText(/2024/);
      expect(timestamps.length).toBeGreaterThan(0);
    });
  });
});