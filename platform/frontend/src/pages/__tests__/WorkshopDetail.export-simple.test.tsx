import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import WorkshopDetail from '../WorkshopDetail';
import { workshopApi, attendeeApi } from '../../services/api';

// Mock the APIs
jest.mock('../../services/api');
const mockedWorkshopApi = workshopApi as jest.Mocked<typeof workshopApi>;
const mockedAttendeeApi = attendeeApi as jest.Mocked<typeof attendeeApi>;

// Mock navigate
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
  useParams: () => ({ id: 'test-workshop-id' }),
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
        <WorkshopDetail />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('WorkshopDetail - Export Button', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
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

    mockedAttendeeApi.getWorkshopAttendees.mockResolvedValue([]);
  });

  it('should display Export Attendee List button', async () => {
    renderComponent();

    // Wait for the workshop data to load
    await screen.findByText('Test Workshop');

    // Check that Export Attendee List button is now present
    expect(screen.getByText('Export Attendee List')).toBeInTheDocument();
  });
});