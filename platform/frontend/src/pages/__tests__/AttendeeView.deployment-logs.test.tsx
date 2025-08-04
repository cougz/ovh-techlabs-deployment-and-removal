import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import AttendeeView from '../AttendeeView';
import { attendeeApi, deploymentApi } from '../../services/api';

// Mock the APIs
jest.mock('../../services/api');
const mockedAttendeeApi = attendeeApi as jest.Mocked<typeof attendeeApi>;
const mockedDeploymentApi = deploymentApi as jest.Mocked<typeof deploymentApi>;

// Mock navigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: 'test-attendee-id' }),
}));

const renderComponent = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AttendeeView />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('AttendeeView - Deployment Logs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock attendee with active status
    mockedAttendeeApi.getAttendee.mockResolvedValue({
      id: 'test-attendee-id',
      username: 'Cristiano-Ronaldo',
      email: 'Cristiano.Ronaldo@techlabs.ovh',
      workshop_id: 'test-workshop-id',
      status: 'active',
      ovh_project_id: '7af93fb8849940d5bc35e117ac045efc',
      ovh_user_urn: 'urn:v1:eu:identity:user:cc1882189-ovh/Cristiano-Ronaldo',
      created_at: '2025-07-21T15:58:41Z',
      updated_at: '2025-07-21T15:58:41Z'
    });

    // Mock deployment logs with correct timestamp field
    mockedDeploymentApi.getAttendeeDeploymentLogs.mockResolvedValue([
      {
        id: 'deployment-log-1',
        attendee_id: 'test-attendee-id',
        action: 'deploy',
        status: 'completed',
        terraform_output: `ovh_me_identity_user.workshop_user: Creating...
ovh_me_identity_user.workshop_user: Creation complete after 0s [id=Cristiano-Ronaldo]
ovh_cloud_project.workshop_project: Creating...
ovh_cloud_project.workshop_project: Still creating... [00m10s elapsed]
ovh_cloud_project.workshop_project: Still creating... [00m20s elapsed]
ovh_cloud_project.workshop_project: Creation complete after 28s [id=7af93fb8849940d5bc35e117ac045efc]
ovh_iam_policy.workshop_policy: Creating...
ovh_iam_policy.workshop_policy: Creation complete after 0s [id=72e78c67-c2cf-4294-aafc-830c8a2aedd7]

Apply complete! Resources: 3 added, 0 changed, 0 destroyed.

Outputs:

password = <sensitive>
project_id = "7af93fb8849940d5bc35e117ac045efc"
project_urn = "urn:v1:eu:resource:publicCloudProject:7af93fb8849940d5bc35e117ac045efc"
user_urn = "urn:v1:eu:identity:user:cc1882189-ovh/Cristiano-Ronaldo"
username = "Cristiano-Ronaldo"`,
        error_message: null,
        started_at: '2025-07-21T16:00:00Z',
        completed_at: '2025-07-21T16:00:28Z'
      }
    ]);
  });

  it('should display deployment logs with proper timestamps instead of N/A', async () => {
    renderComponent();

    // Wait for attendee data to load
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Cristiano-Ronaldo' })).toBeInTheDocument();
    });

    // Wait for deployment logs to load
    await waitFor(() => {
      expect(screen.getByText('Deployment History')).toBeInTheDocument();
    });

    // Should show deployment action and status
    expect(screen.getByText('deploy')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
    
    // Should show timestamp instead of N/A
    const timestampPattern = /7\/21\/2025|2025-07-21/; // Either US or ISO format
    expect(screen.getByText(timestampPattern)).toBeInTheDocument();
    
    // Should NOT show N/A for timestamp
    expect(screen.queryByText('N/A')).not.toBeInTheDocument();
    
    // Verify API calls were made correctly
    expect(mockedAttendeeApi.getAttendee).toHaveBeenCalledWith('test-attendee-id');
    expect(mockedDeploymentApi.getAttendeeDeploymentLogs).toHaveBeenCalledWith('test-attendee-id');
  });

  it('should display Terraform output when expanded', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('View Terraform Output')).toBeInTheDocument();
    });

    // Should show Terraform deployment details
    expect(screen.getByText(/Apply complete! Resources: 3 added, 0 changed, 0 destroyed/)).toBeInTheDocument();
    expect(screen.getByText(/ovh_cloud_project.workshop_project: Creation complete/)).toBeInTheDocument();
    expect(screen.getByText(/project_id = "7af93fb8849940d5bc35e117ac045efc"/)).toBeInTheDocument();
  });

  it('should handle deployment logs with no Terraform output', async () => {
    // Mock logs without terraform_output
    mockedDeploymentApi.getAttendeeDeploymentLogs.mockResolvedValue([
      {
        id: 'deployment-log-2',
        attendee_id: 'test-attendee-id',
        action: 'destroy',
        status: 'failed',
        terraform_output: null,
        error_message: 'Permission denied: IAM policy deletion failed',
        started_at: '2025-07-21T16:30:00Z',
        completed_at: '2025-07-21T16:30:15Z'
      }
    ]);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('destroy')).toBeInTheDocument();
      expect(screen.getByText('failed')).toBeInTheDocument();
    });

    // Should show error message
    expect(screen.getByText('Permission denied: IAM policy deletion failed')).toBeInTheDocument();
    
    // Should not show Terraform output section
    expect(screen.queryByText('View Terraform Output')).not.toBeInTheDocument();
  });
});