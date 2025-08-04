import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Settings from '../Settings';

describe('Settings Terraform Alert Dark Mode', () => {
  beforeEach(() => {
    // Add dark class to document element
    document.documentElement.classList.add('dark');
  });
  
  afterEach(() => {
    document.documentElement.classList.remove('dark');
  });

  it('should have dark mode styling for Terraform alert box', () => {
    render(<Settings />);
    
    // Switch to terraform tab to see the alert box
    const terraformTab = screen.getByRole('button', { name: /terraform/i });
    fireEvent.click(terraformTab);
    
    // Find the alert container with "Important" text
    const alertContainer = document.querySelector('.bg-yellow-50.border.border-yellow-200');
    
    // FAILING TEST: Alert container should have dark background
    expect(alertContainer).toHaveClass('dark:bg-stone-800');
    expect(alertContainer).toHaveClass('dark:border-stone-600');
  });

  it('should have proper warning icon color in dark mode', () => {
    render(<Settings />);
    
    // Switch to terraform tab
    const terraformTab = screen.getByRole('button', { name: /terraform/i });
    fireEvent.click(terraformTab);
    
    // Find the warning icon (ExclamationTriangleIcon)
    const warningIcon = document.querySelector('.text-yellow-400');
    
    // FAILING TEST: Warning icon should have amber color for visibility
    expect(warningIcon).toHaveClass('dark:text-amber-400');
  });

  it('should have readable alert heading text in dark mode', () => {
    render(<Settings />);
    
    // Switch to terraform tab
    const terraformTab = screen.getByRole('button', { name: /terraform/i });
    fireEvent.click(terraformTab);
    
    // Find the "Important" heading
    const alertHeading = screen.getByText('Important');
    
    // FAILING TEST: Alert heading should be light amber
    expect(alertHeading).toHaveClass('dark:text-amber-200');
  });

  it('should have readable alert message text in dark mode', () => {
    render(<Settings />);
    
    // Switch to terraform tab
    const terraformTab = screen.getByRole('button', { name: /terraform/i });
    fireEvent.click(terraformTab);
    
    // Find the alert message text
    const alertMessage = screen.getByText(/Changes to Terraform settings may affect ongoing deployments/i);
    
    // FAILING TEST: Alert message should be light gray for readability
    expect(alertMessage).toHaveClass('dark:text-stone-200');
  });

  it('should maintain warning semantic while fitting dark theme', () => {
    render(<Settings />);
    
    // Switch to terraform tab
    const terraformTab = screen.getByRole('button', { name: /terraform/i });
    fireEvent.click(terraformTab);
    
    // Find the alert container
    const alertContainer = document.querySelector('.bg-yellow-50.border.border-yellow-200');
    
    // PASSING TEST: Should have light mode class but with dark mode override
    expect(alertContainer).toHaveClass('bg-yellow-50');
    expect(alertContainer).toHaveClass('dark:bg-stone-800');
    
    // Verify dark mode border override
    expect(alertContainer).toHaveClass('border-yellow-200');
    expect(alertContainer).toHaveClass('dark:border-stone-600');
  });
});