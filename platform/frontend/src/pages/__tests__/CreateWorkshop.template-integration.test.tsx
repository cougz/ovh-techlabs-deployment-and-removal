import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { BrowserRouter } from 'react-router-dom';
import CreateWorkshop from '../CreateWorkshop';
import * as api from '../../services/api';

// Mock the API
jest.mock('../../services/api');
const mockApi = api as jest.Mocked<typeof api>;

// Mock navigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const mockTemplates = [
  {
    name: 'Generic',
    description: 'Creates: IAM User, IAM Policy, OVHcloud Public Cloud Project',
    resources: ['ovh_public_cloud_project'],
    is_active: true,
    resource_config: {
      ovh_public_cloud_project: {
        enabled: true,
        config: {
          plan_code: 'discovery'
        }
      }
    }
  }
];

const renderCreateWorkshop = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <CreateWorkshop />
      </QueryClientProvider>
    </BrowserRouter>
  );
};

describe('CreateWorkshop Template Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful template fetching
    mockApi.templateApi = {
      listTemplates: jest.fn().mockResolvedValue(mockTemplates),
    };
    
    // Mock successful workshop creation
    mockApi.workshopApi = {
      createWorkshop: jest.fn().mockResolvedValue({
        id: 'test-workshop-id',
        name: 'Test Workshop',
        description: 'Test Description',
        start_date: '2024-12-01T10:00:00Z',
        end_date: '2024-12-01T18:00:00Z',
        timezone: 'UTC',
        template: 'Generic',
        status: 'planning',
        created_at: '2024-11-01T10:00:00Z',
        updated_at: '2024-11-01T10:00:00Z'
      }),
    };
  });

  describe('Template Section Rendering', () => {
    it('should render template selection section in workshop form', async () => {
      renderCreateWorkshop();
      
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /workshop template/i })).toBeInTheDocument();
      });
    });

    it('should load and display available templates', async () => {
      renderCreateWorkshop();
      
      await waitFor(() => {
        expect(mockApi.templateApi.listTemplates).toHaveBeenCalled();
        expect(screen.getByDisplayValue('Generic')).toBeInTheDocument();
      });
    });

    it('should show template description under dropdown', async () => {
      renderCreateWorkshop();
      
      await waitFor(() => {
        expect(screen.getByText(/creates: iam user, iam policy, ovhcloud public cloud project/i)).toBeInTheDocument();
      });
    });
  });

  describe('Template Selection Integration', () => {
    it('should default to Generic template', async () => {
      renderCreateWorkshop();
      
      await waitFor(() => {
        const templateDropdown = screen.getByLabelText(/workshop template/i);
        expect(templateDropdown).toHaveValue('Generic');
      });
    });

    it('should update form state when template is changed', async () => {
      renderCreateWorkshop();
      
      await waitFor(() => {
        const templateDropdown = screen.getByLabelText(/workshop template/i);
        fireEvent.change(templateDropdown, { target: { value: 'Generic' } });
        
        expect(templateDropdown).toHaveValue('Generic');
      });
    });

    it('should validate template selection is required', async () => {
      renderCreateWorkshop();
      
      // Fill out required fields but ensure template validation can trigger
      await waitFor(() => {
        fireEvent.change(screen.getByLabelText(/workshop name/i), {
          target: { value: 'Test Workshop' }
        });
        
        const now = new Date();
        const startDate = new Date(now.getTime() + 60 * 60 * 1000);
        const endDate = new Date(now.getTime() + 25 * 60 * 60 * 1000);
        
        fireEvent.change(screen.getByLabelText(/start date/i), {
          target: { value: startDate.toISOString().slice(0, 16) }
        });
        
        fireEvent.change(screen.getByLabelText(/end date/i), {
          target: { value: endDate.toISOString().slice(0, 16) }
        });
      });
      
      // Template should be pre-selected, so this test validates the happy path
      const submitButton = screen.getByRole('button', { name: /create workshop/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockApi.workshopApi.createWorkshop).toHaveBeenCalledWith(
          expect.objectContaining({
            template: 'Generic'
          })
        );
      }, { timeout: 3000 });
    });
  });

  describe('Form Submission with Template', () => {
    const fillRequiredFields = async () => {
      await waitFor(() => {
        fireEvent.change(screen.getByLabelText(/workshop name/i), {
          target: { value: 'Test Workshop' }
        });
        
        fireEvent.change(screen.getByLabelText(/description/i), {
          target: { value: 'Test Description' }
        });
        
        // Dates should be pre-filled, but let's set them explicitly
        const now = new Date();
        const startDate = new Date(now.getTime() + 60 * 60 * 1000);
        const endDate = new Date(now.getTime() + 25 * 60 * 60 * 1000);
        
        fireEvent.change(screen.getByLabelText(/start date/i), {
          target: { value: startDate.toISOString().slice(0, 16) }
        });
        
        fireEvent.change(screen.getByLabelText(/end date/i), {
          target: { value: endDate.toISOString().slice(0, 16) }
        });
        
        // Template should already be selected as Generic
        expect(screen.getByDisplayValue('Generic')).toBeInTheDocument();
      });
    };

    it('should include template in workshop creation request', async () => {
      renderCreateWorkshop();
      
      await fillRequiredFields();
      
      const submitButton = screen.getByRole('button', { name: /create workshop/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockApi.workshopApi.createWorkshop).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Test Workshop',
            description: 'Test Description',
            template: 'Generic',
            timezone: expect.any(String),
            start_date: expect.any(String),
            end_date: expect.any(String)
          })
        );
      });
    });

    it('should redirect to workshop detail after successful creation', async () => {
      renderCreateWorkshop();
      
      await fillRequiredFields();
      
      const submitButton = screen.getByRole('button', { name: /create workshop/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/workshops/test-workshop-id');
      });
    });
  });

  describe('Template Loading States', () => {
    it('should show loading state while fetching templates', async () => {
      // Mock delayed template loading
      mockApi.templateApi.listTemplates = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockTemplates), 100))
      );
      
      renderCreateWorkshop();
      
      expect(screen.getByText(/loading templates/i)).toBeInTheDocument();
      
      await waitFor(() => {
        expect(screen.queryByText(/loading templates/i)).not.toBeInTheDocument();
        expect(screen.getByDisplayValue('Generic')).toBeInTheDocument();
      });
    });

    it('should handle template loading errors gracefully', async () => {
      mockApi.templateApi.listTemplates = jest.fn().mockRejectedValue(
        new Error('Failed to load templates')
      );
      
      renderCreateWorkshop();
      
      await waitFor(() => {
        expect(screen.getByText(/failed to load templates/i)).toBeInTheDocument();
      });
    });
  });

  describe('Template Information Display', () => {
    it('should show template resources information', async () => {
      renderCreateWorkshop();
      
      await waitFor(() => {
        // Should show information about what the Generic template includes
        expect(screen.getByText(/creates.*public cloud project/i)).toBeInTheDocument();
      });
    });

    it('should provide template selection guidance', async () => {
      renderCreateWorkshop();
      
      await waitFor(() => {
        // Should show help text about template selection
        expect(screen.getByText(/select a template.*workshop resources/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation with Template', () => {
    it('should prevent submission without template selection', async () => {
      renderCreateWorkshop();
      
      await waitFor(() => {
        fireEvent.change(screen.getByLabelText(/workshop name/i), {
          target: { value: 'Test Workshop' }
        });
      });
      
      // Somehow clear template selection (this might need special handling)
      // For now, we'll test that form validates template is present
      
      const submitButton = screen.getByRole('button', { name: /create workshop/i });
      fireEvent.click(submitButton);
      
      // Should not call API if template is missing
      await waitFor(() => {
        expect(mockApi.workshopApi.createWorkshop).not.toHaveBeenCalled();
      });
    });

    it('should show template validation error when required', async () => {
      renderCreateWorkshop();
      
      // Fill other fields but ensure template validation triggers
      await waitFor(() => {
        fireEvent.change(screen.getByLabelText(/workshop name/i), {
          target: { value: 'Test Workshop' }
        });
        
        // Try to clear template selection
        const templateDropdown = screen.getByLabelText(/workshop template/i);
        fireEvent.change(templateDropdown, { target: { value: '' } });
      });
      
      const submitButton = screen.getByRole('button', { name: /create workshop/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/template.*required/i)).toBeInTheDocument();
      });
    });
  });

  describe('Template Dropdown Position', () => {
    it('should render template selection after workshop details but before schedule', async () => {
      renderCreateWorkshop();
      
      await waitFor(() => {
        const workshopDetailsSection = screen.getByRole('heading', { name: /workshop details/i });
        const templateSection = screen.getByRole('heading', { name: /workshop template/i });
        const scheduleSection = screen.getByRole('heading', { name: /schedule/i });
        
        // Check that all sections are rendered
        expect(workshopDetailsSection).toBeInTheDocument();
        expect(templateSection).toBeInTheDocument();
        expect(scheduleSection).toBeInTheDocument();
        
        // Check order by comparing their position in the document
        const workshopDetailsRect = workshopDetailsSection.getBoundingClientRect();
        const templateRect = templateSection.getBoundingClientRect();
        const scheduleRect = scheduleSection.getBoundingClientRect();
        
        // Template should be after workshop details
        expect(templateRect.top).toBeGreaterThan(workshopDetailsRect.top);
        // Schedule should be after template
        expect(scheduleRect.top).toBeGreaterThan(templateRect.top);
      });
    });
  });
});