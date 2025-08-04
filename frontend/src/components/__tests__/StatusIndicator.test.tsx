import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import StatusIndicator from '../StatusIndicator';

describe('StatusIndicator', () => {
  it('should render status indicator with badge variant', () => {
    render(
      <StatusIndicator 
        status="active" 
        variant="badge" 
        size="sm"
      />
    );

    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('should render status indicator with icon variant', () => {
    render(
      <StatusIndicator 
        status="failed" 
        variant="icon" 
        size="md"
      />
    );

    // Check for icon via title/aria-label
    const icon = screen.getByLabelText('Failed');
    expect(icon).toBeInTheDocument();
  });

  it('should render status indicator with full variant', () => {
    render(
      <StatusIndicator 
        status="deploying" 
        variant="full" 
        size="lg"
      />
    );

    expect(screen.getByText('Deploying')).toBeInTheDocument();
  });

  it('should handle different status types', () => {
    const statuses = ['active', 'deploying', 'failed', 'completed', 'planning'];
    
    statuses.forEach(status => {
      const { container, unmount } = render(
        <StatusIndicator 
          status={status} 
          variant="badge"
        />
      );
      
      // Should render without errors
      expect(container.firstChild).toBeInTheDocument();
      unmount();
    });
  });
});