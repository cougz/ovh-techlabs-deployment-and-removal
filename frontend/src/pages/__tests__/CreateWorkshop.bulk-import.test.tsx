import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import CreateWorkshop from '../CreateWorkshop';
import { workshopApi, attendeeApi } from '../../services/api';

// Mock the API modules
jest.mock('../../services/api');
const mockedWorkshopApi = workshopApi as jest.Mocked<typeof workshopApi>;
const mockedAttendeeApi = attendeeApi as jest.Mocked<typeof attendeeApi>;

// Mock navigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
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
        <CreateWorkshop />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('CreateWorkshop - Bulk Import', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedWorkshopApi.createWorkshop.mockResolvedValue({
      id: 'workshop-123',
      name: 'Test Workshop',
      description: 'Test Description',
      start_date: '2024-01-01T10:00:00Z',
      end_date: '2024-01-01T18:00:00Z',
    });
    mockedAttendeeApi.createAttendee.mockResolvedValue({
      id: 'attendee-123',
      username: 'john-doe',
      email: 'john@example.com',
      workshop_id: 'workshop-123',
    });
  });

  it('should render bulk import toggle switch', () => {
    renderComponent();
    
    // Find the toggle button by its class since it doesn't have accessible text
    const toggle = document.querySelector('.relative.inline-flex.h-6.w-11');
    expect(toggle).toBeInTheDocument();
    
    const individualLabel = screen.getByText('Individual');
    const bulkLabel = screen.getByText('Bulk Import');
    expect(individualLabel).toBeInTheDocument();
    expect(bulkLabel).toBeInTheDocument();
  });

  it('should toggle to bulk import mode', () => {
    renderComponent();
    
    const toggle = document.querySelector('.relative.inline-flex.h-6.w-11');
    fireEvent.click(toggle!);
    
    const csvTextarea = screen.getByLabelText('CSV Data');
    expect(csvTextarea).toBeInTheDocument();
    expect(csvTextarea).toHaveAttribute('placeholder', expect.stringContaining('Max-Mustermann,max-mustermann@techlab.ovh'));
  });

  it('should show individual attendee message by default', () => {
    renderComponent();
    
    const message = screen.getByText('Add Attendees Later');
    expect(message).toBeInTheDocument();
    expect(screen.getByText(/You can add attendees individually after creating/)).toBeInTheDocument();
  });

  it('should parse valid CSV data and show preview', () => {
    renderComponent();
    
    const toggle = document.querySelector('.relative.inline-flex.h-6.w-11');
    fireEvent.click(toggle!);
    
    const csvTextarea = screen.getByLabelText('CSV Data');
    fireEvent.change(csvTextarea, {
      target: { value: 'john-doe,john@example.com\njane-smith,jane@example.com' }
    });
    
    expect(screen.getByText('Ready to Import')).toBeInTheDocument();
    expect(screen.getByText('2 attendee(s) will be created after the workshop is set up.')).toBeInTheDocument();
    expect(screen.getByText(/2 valid attendees found/)).toBeInTheDocument();
  });

  it('should show CSV validation errors', () => {
    renderComponent();
    
    const toggle = document.querySelector('.relative.inline-flex.h-6.w-11');
    fireEvent.click(toggle!);
    
    const csvTextarea = screen.getByLabelText('CSV Data');
    fireEvent.change(csvTextarea, {
      target: { value: 'john-doe\ninvalid-line' }
    });
    
    expect(screen.getByText('CSV Validation Errors')).toBeInTheDocument();
    expect(screen.getByText(/Line 1:.*Missing email address/)).toBeInTheDocument();
    expect(screen.getByText(/Line 2:.*Missing email address/)).toBeInTheDocument();
  });

  it('should show validation errors for invalid email format', () => {
    renderComponent();
    
    const toggle = document.querySelector('.relative.inline-flex.h-6.w-11');
    fireEvent.click(toggle!);
    
    const csvTextarea = screen.getByLabelText('CSV Data');
    fireEvent.change(csvTextarea, {
      target: { value: 'john-doe,not-an-email' }
    });
    
    expect(screen.getByText('CSV Validation Errors')).toBeInTheDocument();
    expect(screen.getByText(/Line 1:.*Invalid email format/)).toBeInTheDocument();
  });

  it('should show validation errors for duplicate usernames', () => {
    renderComponent();
    
    const toggle = document.querySelector('.relative.inline-flex.h-6.w-11');
    fireEvent.click(toggle!);
    
    const csvTextarea = screen.getByLabelText('CSV Data');
    fireEvent.change(csvTextarea, {
      target: { value: 'john-doe,john1@example.com\njohn-doe,john2@example.com' }
    });
    
    expect(screen.getByText('CSV Validation Errors')).toBeInTheDocument();
    expect(screen.getByText(/Line 2:.*Username already exists.*first seen on line 1/)).toBeInTheDocument();
  });

  it('should create workshop with bulk attendees', async () => {
    renderComponent();
    
    // Fill out required workshop fields
    fireEvent.change(screen.getByLabelText('Workshop Name *'), {
      target: { value: 'Test Workshop' }
    });
    
    // Switch to bulk import mode
    const toggle = document.querySelector('.relative.inline-flex.h-6.w-11');
    fireEvent.click(toggle!);
    
    // Add CSV data
    const csvTextarea = screen.getByLabelText('CSV Data');
    fireEvent.change(csvTextarea, {
      target: { value: 'john-doe,john@example.com\njane-smith,jane@example.com' }
    });
    
    // Submit form
    const submitButton = screen.getByRole('button', { name: 'Create Workshop' });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockedWorkshopApi.createWorkshop).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Workshop'
        })
      );
    });
    
    await waitFor(() => {
      expect(mockedAttendeeApi.createAttendee).toHaveBeenCalledTimes(2);
    });
    
    expect(mockedAttendeeApi.createAttendee).toHaveBeenCalledWith('workshop-123', {
      username: 'john-doe',
      email: 'john@example.com'
    });
    
    expect(mockedAttendeeApi.createAttendee).toHaveBeenCalledWith('workshop-123', {
      username: 'jane-smith',
      email: 'jane@example.com'
    });
  });

  it('should show bulk import progress', async () => {
    // Make the attendee creation slower to see the progress
    let resolveAttendeeCreation: (value: any) => void;
    const attendeePromise = new Promise(resolve => {
      resolveAttendeeCreation = resolve;
    });
    mockedAttendeeApi.createAttendee.mockReturnValueOnce(attendeePromise);
    
    renderComponent();
    
    fireEvent.change(screen.getByLabelText('Workshop Name *'), {
      target: { value: 'Test Workshop' }
    });
    
    const toggle = document.querySelector('.relative.inline-flex.h-6.w-11');
    fireEvent.click(toggle!);
    
    const csvTextarea = screen.getByLabelText('CSV Data');
    fireEvent.change(csvTextarea, {
      target: { value: 'john-doe,john@example.com' }
    });
    
    const submitButton = screen.getByRole('button', { name: 'Create Workshop' });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Creating Attendees')).toBeInTheDocument();
    });
    
    // Resolve the promise to complete the test
    resolveAttendeeCreation!({
      id: 'attendee-123',
      username: 'john-doe',
      email: 'john@example.com',
      workshop_id: 'workshop-123'
    });
  });

  it('should handle attendee creation errors', async () => {
    mockedAttendeeApi.createAttendee.mockRejectedValueOnce({
      response: { data: { detail: 'Username already exists' } }
    });
    
    renderComponent();
    
    fireEvent.change(screen.getByLabelText('Workshop Name *'), {
      target: { value: 'Test Workshop' }
    });
    
    const toggle = document.querySelector('.relative.inline-flex.h-6.w-11');
    fireEvent.click(toggle!);
    
    const csvTextarea = screen.getByLabelText('CSV Data');
    fireEvent.change(csvTextarea, {
      target: { value: 'john-doe,john@example.com' }
    });
    
    const submitButton = screen.getByRole('button', { name: 'Create Workshop' });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to create 1 attendee(s)')).toBeInTheDocument();
    });
    
    expect(screen.getByText(/john-doe \(john@example.com\): Username already exists/)).toBeInTheDocument();
  });

  it('should validate CSV data is required when bulk import is enabled', () => {
    renderComponent();
    
    const toggle = document.querySelector('.relative.inline-flex.h-6.w-11');
    fireEvent.click(toggle!);
    
    const submitButton = screen.getByRole('button', { name: 'Create Workshop' });
    fireEvent.click(submitButton);
    
    expect(screen.getByText('CSV data is required for bulk import')).toBeInTheDocument();
  });

  it('should validate CSV errors prevent form submission', () => {
    renderComponent();
    
    fireEvent.change(screen.getByLabelText('Workshop Name *'), {
      target: { value: 'Test Workshop' }
    });
    
    const toggle = document.querySelector('.relative.inline-flex.h-6.w-11');
    fireEvent.click(toggle!);
    
    const csvTextarea = screen.getByLabelText('CSV Data');
    fireEvent.change(csvTextarea, {
      target: { value: 'invalid-csv-data' }
    });
    
    const submitButton = screen.getByRole('button', { name: 'Create Workshop' });
    fireEvent.click(submitButton);
    
    expect(screen.getByText(/Please fix \d+ error/)).toBeInTheDocument();
    expect(mockedWorkshopApi.createWorkshop).not.toHaveBeenCalled();
  });

  it('should clear CSV data when switching back to individual mode', () => {
    renderComponent();
    
    const toggle = document.querySelector('.relative.inline-flex.h-6.w-11');
    fireEvent.click(toggle!);
    
    const csvTextarea = screen.getByLabelText('CSV Data');
    fireEvent.change(csvTextarea, {
      target: { value: 'john-doe,john@example.com' }
    });
    
    expect(csvTextarea).toHaveValue('john-doe,john@example.com');
    
    // Switch back to individual
    fireEvent.click(toggle);
    
    expect(screen.queryByLabelText('CSV Data')).not.toBeInTheDocument();
    expect(screen.getByText('Add Attendees Later')).toBeInTheDocument();
  });
});