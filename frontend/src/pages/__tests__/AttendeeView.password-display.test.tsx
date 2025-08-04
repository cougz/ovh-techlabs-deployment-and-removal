import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import AttendeeView from '../AttendeeView';
import { attendeeApi } from '../../services/api';

// Mock the API
jest.mock('../../services/api');
const mockedAttendeeApi = attendeeApi as jest.Mocked<typeof attendeeApi>;

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

describe('AttendeeView - Password Display', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock attendee with active status
    mockedAttendeeApi.getAttendee.mockResolvedValue({
      id: 'test-attendee-id',
      username: 'max-mustermann',
      email: 'max.mustermann@test.de',
      workshop_id: 'test-workshop-id',
      status: 'active',
      ovh_project_id: '8a6ae298839a49fc9650968f6483bcbe',
      ovh_user_urn: 'urn:v1:eu:identity:user:cc1882189-ovh/max-mustermann',
      created_at: '2025-07-21T15:58:41Z',
      updated_at: '2025-07-21T15:58:41Z'
    });

    // Mock credentials with password from Terraform
    mockedAttendeeApi.getAttendeeCredentials.mockResolvedValue({
      username: 'max-mustermann',
      password: 'terraform-generated-password-123',
      ovh_project_id: '8a6ae298839a49fc9650968f6483bcbe',
      ovh_user_urn: 'urn:v1:eu:identity:user:cc1882189-ovh/max-mustermann'
    });
  });

  it('should display Terraform-generated password for active attendee', async () => {
    renderComponent();

    // Wait for attendee data to load (check page title which is unique)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'max-mustermann' })).toBeInTheDocument();
    });

    // Wait for credentials section to appear
    await waitFor(() => {
      expect(screen.getByText('Access Credentials')).toBeInTheDocument();
    });

    // Click Show button to reveal credentials
    const showButton = screen.getByText('Show');
    await act(async () => {
      fireEvent.click(showButton);
    });

    // Wait for credentials to load and display
    await waitFor(() => {
      expect(screen.getByText('terraform-generated-password-123')).toBeInTheDocument();
    });

    // Verify the password is displayed in a secure way
    const passwordElement = screen.getByText('terraform-generated-password-123');
    expect(passwordElement).toBeInTheDocument();

    // Verify API calls were made
    expect(mockedAttendeeApi.getAttendee).toHaveBeenCalledWith('test-attendee-id');
    expect(mockedAttendeeApi.getAttendeeCredentials).toHaveBeenCalledWith('test-attendee-id');
  });

  it('should show credentials section for active attendees', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Access Credentials')).toBeInTheDocument();
    });

    // Initially shows "Show" button
    expect(screen.getByText('Show')).toBeInTheDocument();

    // Click Show button to reveal credentials
    await act(async () => {
      fireEvent.click(screen.getByText('Show'));
    });

    await waitFor(() => {
      expect(screen.getAllByText('Username')).toHaveLength(2); // One in attendee info, one in credentials
      expect(screen.getByText('Password')).toBeInTheDocument();
      expect(screen.getByText('terraform-generated-password-123')).toBeInTheDocument();
    });
  });

  it('should not show password for non-active attendees', () => {
    // Mock attendee with planning status
    mockedAttendeeApi.getAttendee.mockResolvedValue({
      id: 'test-attendee-id',
      username: 'max-mustermann',
      email: 'max.mustermann@test.de',
      workshop_id: 'test-workshop-id',
      status: 'planning',
      ovh_project_id: null,
      ovh_user_urn: null,
      created_at: '2025-07-21T15:58:41Z',
      updated_at: '2025-07-21T15:58:41Z'
    });

    renderComponent();

    // Should not try to fetch credentials for non-active attendees
    expect(mockedAttendeeApi.getAttendeeCredentials).not.toHaveBeenCalled();
  });

  it('should handle password display with copy functionality', async () => {
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Access Credentials')).toBeInTheDocument();
    });

    // Click Show button to reveal credentials
    fireEvent.click(screen.getByText('Show'));

    await waitFor(() => {
      expect(screen.getByText('terraform-generated-password-123')).toBeInTheDocument();
    });

    // Find copy buttons by their clipboard icon presence
    const copyButtons = screen.getAllByRole('button');
    const passwordCopyButton = copyButtons.find(button => 
      button.closest('div')?.textContent?.includes('terraform-generated-password-123')
    );
    expect(passwordCopyButton).toBeInTheDocument();

    // Test copy functionality
    await act(async () => {
      fireEvent.click(passwordCopyButton!);
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('terraform-generated-password-123');
  });

  it('should handle credentials loading error gracefully', async () => {
    mockedAttendeeApi.getAttendeeCredentials.mockRejectedValue(
      new Error('No credentials available - attendee not deployed')
    );

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'max-mustermann' })).toBeInTheDocument();
    });

    // Credentials section should still appear
    expect(screen.getByText('Access Credentials')).toBeInTheDocument();
    
    // Click Show button
    await act(async () => {
      fireEvent.click(screen.getByText('Show'));
    });

    // Should show helper text when credentials fail to load
    await waitFor(() => {
      expect(screen.getByText('Click "Show" to view credentials')).toBeInTheDocument();
    });
  });
});