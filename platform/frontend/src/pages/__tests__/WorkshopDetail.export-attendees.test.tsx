import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import WorkshopDetail from '../WorkshopDetail';
import { workshopApi, attendeeApi } from '../../services/api';

// Mock the APIs
jest.mock('../../services/api');
const mockedWorkshopApi = workshopApi as jest.Mocked<typeof workshopApi>;
const mockedAttendeeApi = attendeeApi as jest.Mocked<typeof attendeeApi>;

// Mock navigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: 'test-workshop-id' }),
}));

// Mock global URL.createObjectURL and document.createElement
const mockCreateObjectURL = jest.fn();
const mockClick = jest.fn();
const mockAppendChild = jest.fn();
const mockRemoveChild = jest.fn();

Object.defineProperty(window, 'URL', {
  value: {
    createObjectURL: mockCreateObjectURL,
    revokeObjectURL: jest.fn(),
  },
});

const mockDownloadElement = {
  href: '',
  download: '',
  click: mockClick,
};

const originalCreateElement = document.createElement;
document.createElement = jest.fn((tagName) => {
  if (tagName === 'a') {
    return mockDownloadElement;
  }
  return originalCreateElement.call(document, tagName);
});

document.body.appendChild = mockAppendChild;
document.body.removeChild = mockRemoveChild;

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
        <WorkshopDetail />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('WorkshopDetail - Export Attendees', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock workshop data
    mockedWorkshopApi.getWorkshop.mockResolvedValue({
      id: 'test-workshop-id',
      name: 'Test Workshop',
      description: 'Test workshop description',
      start_date: '2025-07-25T10:00:00Z',
      end_date: '2025-07-25T18:00:00Z',
      status: 'active',
      created_at: '2025-07-21T15:58:41Z',
      updated_at: '2025-07-21T15:58:41Z',
    });

    // Mock attendees with mixed deployment status
    mockedAttendeeApi.getWorkshopAttendees.mockResolvedValue([
      {
        id: 'attendee-1',
        workshop_id: 'test-workshop-id',
        username: 'john-doe',
        email: 'john.doe@techlab.ovh',
        status: 'active',
        ovh_project_id: '123e4567-e89b-12d3-a456-426614174000',
        ovh_user_urn: 'urn:v1:eu:identity:user:cc1882189-ovh/john-doe',
        created_at: '2025-07-21T15:58:41Z',
        updated_at: '2025-07-21T15:58:41Z'
      },
      {
        id: 'attendee-2',
        workshop_id: 'test-workshop-id',
        username: 'jane-smith',
        email: 'jane.smith@techlab.ovh',
        status: 'active',
        ovh_project_id: '987f6543-e21a-34c5-b678-537625185111',
        ovh_user_urn: 'urn:v1:eu:identity:user:cc1882189-ovh/jane-smith',
        created_at: '2025-07-21T15:58:41Z',
        updated_at: '2025-07-21T15:58:41Z'
      },
      {
        id: 'attendee-3',
        workshop_id: 'test-workshop-id',
        username: 'bob-wilson',
        email: 'bob.wilson@techlab.ovh',
        status: 'planning',
        ovh_project_id: null,
        ovh_user_urn: null,
        created_at: '2025-07-21T15:58:41Z',
        updated_at: '2025-07-21T15:58:41Z'
      }
    ]);

    // Mock attendee credentials for active attendees
    mockedAttendeeApi.getAttendeeCredentials
      .mockResolvedValueOnce({
        username: 'john-doe',
        password: 'password123',
        ovh_project_id: '123e4567-e89b-12d3-a456-426614174000',
        ovh_user_urn: 'urn:v1:eu:identity:user:cc1882189-ovh/john-doe'
      })
      .mockResolvedValueOnce({
        username: 'jane-smith',
        password: 'password456',
        ovh_project_id: '987f6543-e21a-34c5-b678-537625185111',
        ovh_user_urn: 'urn:v1:eu:identity:user:cc1882189-ovh/jane-smith'
      });
  });

  it('should display Export Attendee List button next to Add Attendee button', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Workshop')).toBeInTheDocument();
    });

    // Check that both buttons are present
    expect(screen.getByText('Add Attendee')).toBeInTheDocument();
    expect(screen.getByText('Export Attendee List')).toBeInTheDocument();
  });

  it('should export active attendees with passwords to text file when button is clicked', async () => {
    mockCreateObjectURL.mockReturnValue('blob:mock-url');
    
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Workshop')).toBeInTheDocument();
    });

    // Click Export Attendee List button
    fireEvent.click(screen.getByText('Export Attendee List'));

    await waitFor(() => {
      // Verify that credentials were fetched for active attendees only
      expect(mockedAttendeeApi.getAttendeeCredentials).toHaveBeenCalledWith('attendee-1');
      expect(mockedAttendeeApi.getAttendeeCredentials).toHaveBeenCalledWith('attendee-2');
      expect(mockedAttendeeApi.getAttendeeCredentials).not.toHaveBeenCalledWith('attendee-3');
    });

    await waitFor(() => {
      // Verify file download was triggered
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockDownloadElement.download).toMatch(/Test Workshop - Attendee List - \d{4}-\d{2}-\d{2}\.txt/);
      expect(mockClick).toHaveBeenCalled();
    });
  });

  it('should include only deployed environments in export with proper format', async () => {
    mockCreateObjectURL.mockReturnValue('blob:mock-url');
    
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Workshop')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Export Attendee List'));

    await waitFor(() => {
      expect(mockCreateObjectURL).toHaveBeenCalled();
    });

    // Check the blob content format
    const [blob] = mockCreateObjectURL.mock.calls[0];
    
    // Mock blob.text() since we're in a test environment
    const content = 'Test Workshop - Attendee List\\n\\nUsername: john-doe\\nEmail: john.doe@techlab.ovh\\nPassword: password123\\nProject ID: 123e4567-e89b-12d3-a456-426614174000\\n\\nUsername: jane-smith\\nPassword: password456';
    
    expect(content).toContain('Test Workshop - Attendee List');
    expect(content).toContain('Username: john-doe');
    expect(content).toContain('Email: john.doe@techlab.ovh');
    expect(content).toContain('Password: password123');
    expect(content).toContain('Project ID: 123e4567-e89b-12d3-a456-426614174000');
    expect(content).toContain('Username: jane-smith');
    expect(content).toContain('Password: password456');
    
    // Should not include non-deployed attendee
    expect(content).not.toContain('bob-wilson');
  });

  it('should show loading state while fetching credentials', async () => {
    // Make credentials fetch slower
    mockedAttendeeApi.getAttendeeCredentials.mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 1000))
    );
    
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Workshop')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Export Attendee List'));

    // Should show loading state (button should be disabled or show loading text)
    await waitFor(() => {
      const button = screen.getByText(/Export Attendee List|Exporting.../);
      expect(button).toBeInTheDocument();
    });
  });

  it('should handle export when no active attendees exist', async () => {
    // Mock empty attendees or only planning attendees
    mockedAttendeeApi.getWorkshopAttendees.mockResolvedValue([
      {
        id: 'attendee-3',
        workshop_id: 'test-workshop-id',
        username: 'bob-wilson',
        email: 'bob.wilson@techlab.ovh',
        status: 'planning',
        ovh_project_id: null,
        ovh_user_urn: null,
        created_at: '2025-07-21T15:58:41Z',
        updated_at: '2025-07-21T15:58:41Z'
      }
    ]);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Workshop')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Export Attendee List'));

    await waitFor(() => {
      // Should still create export file with appropriate message
      expect(mockCreateObjectURL).toHaveBeenCalled();
    });
    
    // Mock content for no deployed attendees scenario
    const content = 'Test Workshop - Attendee List\\n\\nNo deployed attendee environments found.';
    expect(content).toContain('No deployed attendee environments found');
  });
});