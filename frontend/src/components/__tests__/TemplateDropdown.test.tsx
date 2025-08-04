import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TemplateDropdown from '../TemplateDropdown';
import type { WorkshopTemplate } from '../../types';

// Mock templates for testing
const mockTemplates: WorkshopTemplate[] = [
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

describe('TemplateDropdown', () => {
  const defaultProps = {
    templates: mockTemplates,
    selectedTemplate: 'Generic',
    onTemplateChange: jest.fn(),
    isLoading: false,
    error: null
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render the template dropdown with label', () => {
      render(<TemplateDropdown {...defaultProps} />);
      
      expect(screen.getByLabelText(/workshop template/i)).toBeInTheDocument();
      expect(screen.getByText(/workshop template/i)).toBeInTheDocument();
    });

    it('should show Generic as default selected template', () => {
      render(<TemplateDropdown {...defaultProps} />);
      
      const dropdown = screen.getByDisplayValue('Generic');
      expect(dropdown).toBeInTheDocument();
    });

    it('should display template description as help text', () => {
      render(<TemplateDropdown {...defaultProps} />);
      
      expect(screen.getByText(/creates: iam user, iam policy, ovhcloud public cloud project/i)).toBeInTheDocument();
    });
  });

  describe('Template Selection', () => {
    it('should call onTemplateChange when template is selected', () => {
      const mockOnChange = jest.fn();
      render(<TemplateDropdown {...defaultProps} onTemplateChange={mockOnChange} />);
      
      const dropdown = screen.getByLabelText(/workshop template/i);
      fireEvent.change(dropdown, { target: { value: 'Generic' } });
      
      expect(mockOnChange).toHaveBeenCalledWith('Generic');
    });

    it('should update displayed description when template changes', () => {
      const multipleTemplates: WorkshopTemplate[] = [
        ...mockTemplates,
        {
          name: 'Advanced',
          description: 'Advanced template with additional resources',
          resources: ['ovh_public_cloud_project', 'kubernetes_cluster'],
          is_active: true
        }
      ];

      const { rerender } = render(
        <TemplateDropdown 
          {...defaultProps} 
          templates={multipleTemplates}
          selectedTemplate="Generic"
        />
      );
      
      expect(screen.getByText(/creates: iam user, iam policy, ovhcloud public cloud project/i)).toBeInTheDocument();
      
      // Simulate template change
      rerender(
        <TemplateDropdown 
          {...defaultProps} 
          templates={multipleTemplates}
          selectedTemplate="Advanced"
        />
      );
      
      expect(screen.getByText(/advanced template with additional resources/i)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading state when isLoading is true', () => {
      render(<TemplateDropdown {...defaultProps} isLoading={true} />);
      
      const dropdown = screen.getByLabelText(/workshop template/i);
      expect(dropdown).toBeDisabled();
      expect(screen.getByText(/loading templates, please wait/i)).toBeInTheDocument();
    });

    it('should disable dropdown during loading', () => {
      render(<TemplateDropdown {...defaultProps} isLoading={true} />);
      
      const dropdown = screen.getByLabelText(/workshop template/i);
      expect(dropdown).toBeDisabled();
    });
  });

  describe('Error State', () => {
    it('should show error message when error is provided', () => {
      const errorMessage = 'Failed to load templates';
      render(<TemplateDropdown {...defaultProps} error={errorMessage} />);
      
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toHaveClass('text-danger-600');
    });

    it('should still render dropdown when there is an error', () => {
      render(<TemplateDropdown {...defaultProps} error="Some error" />);
      
      expect(screen.getByLabelText(/workshop template/i)).toBeInTheDocument();
    });
  });

  describe('Empty Templates', () => {
    it('should show placeholder when no templates are available', () => {
      render(<TemplateDropdown {...defaultProps} templates={[]} />);
      
      expect(screen.getByText(/no templates available/i)).toBeInTheDocument();
    });

    it('should disable dropdown when no templates are available', () => {
      render(<TemplateDropdown {...defaultProps} templates={[]} />);
      
      const dropdown = screen.getByLabelText(/workshop template/i);
      expect(dropdown).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<TemplateDropdown {...defaultProps} />);
      
      const dropdown = screen.getByLabelText(/workshop template/i);
      expect(dropdown).toHaveAttribute('aria-describedby');
    });

    it('should be keyboard navigable', () => {
      render(<TemplateDropdown {...defaultProps} />);
      
      const dropdown = screen.getByLabelText(/workshop template/i);
      
      // Focus the dropdown
      dropdown.focus();
      expect(dropdown).toHaveFocus();
      
      // Should be able to change value with keyboard
      fireEvent.keyDown(dropdown, { key: 'ArrowDown' });
      expect(dropdown).toHaveFocus();
    });

    it('should associate description with dropdown using aria-describedby', () => {
      render(<TemplateDropdown {...defaultProps} />);
      
      const dropdown = screen.getByLabelText(/workshop template/i);
      const describedBy = dropdown.getAttribute('aria-describedby');
      
      expect(describedBy).toBeTruthy();
      expect(screen.getByText(/creates: iam user, iam policy, ovhcloud public cloud project/i)).toHaveAttribute('id', describedBy);
    });
  });

  describe('Dark Mode Support', () => {
    it('should apply dark mode classes when in dark mode', () => {
      // Mock dark mode context
      document.documentElement.classList.add('dark');
      
      render(<TemplateDropdown {...defaultProps} />);
      
      const dropdown = screen.getByLabelText(/workshop template/i);
      expect(dropdown).toHaveClass('dark:bg-gray-700', 'dark:border-gray-600', 'dark:text-white');
      
      // Cleanup
      document.documentElement.classList.remove('dark');
    });
  });

  describe('Template Resources Display', () => {
    it('should show template resources in description', () => {
      const templateWithResources: WorkshopTemplate[] = [
        {
          name: 'Generic',
          description: 'Creates: IAM User, IAM Policy, OVHcloud Public Cloud Project',
          resources: ['ovh_public_cloud_project', 'user', 'policy'],
          is_active: true
        }
      ];

      render(<TemplateDropdown {...defaultProps} templates={templateWithResources} />);
      
      // Should show resource count or list
      expect(screen.getByText(/creates.*project.*user.*policy/i)).toBeInTheDocument();
    });
  });
});