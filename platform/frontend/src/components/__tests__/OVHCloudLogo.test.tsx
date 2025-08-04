import React from 'react';
import { render, screen } from '@testing-library/react';
import OVHCloudLogo from '../OVHCloudLogo';

describe('OVHCloudLogo', () => {
  it('should render the OVHcloud logo', () => {
    render(<OVHCloudLogo />);
    
    const logo = screen.getByTitle('OVHcloud_master_logo_fullcolor_RGB').closest('svg');
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute('viewBox', '0 0 298.03 47.18');
  });

  it('should apply custom width and height', () => {
    render(<OVHCloudLogo width="150" height="30" />);
    
    const logo = screen.getByTitle('OVHcloud_master_logo_fullcolor_RGB').closest('svg');
    expect(logo).toHaveAttribute('width', '150');
    expect(logo).toHaveAttribute('height', '30');
  });

  it('should apply custom className', () => {
    render(<OVHCloudLogo className="custom-class" />);
    
    const logo = screen.getByTitle('OVHcloud_master_logo_fullcolor_RGB').closest('svg');
    expect(logo).toHaveClass('custom-class');
  });

  it('should use default dimensions when not specified', () => {
    render(<OVHCloudLogo />);
    
    const logo = screen.getByTitle('OVHcloud_master_logo_fullcolor_RGB').closest('svg');
    expect(logo).toHaveAttribute('width', '120');
    expect(logo).toHaveAttribute('height', '24');
  });

  it('should use currentColor for theming', () => {
    render(<OVHCloudLogo />);
    
    const logo = screen.getByTitle('OVHcloud_master_logo_fullcolor_RGB').closest('svg');
    expect(logo?.innerHTML).toContain('fill:currentColor');
  });

  it('should have proper aria-label for accessibility', () => {
    render(<OVHCloudLogo />);
    
    const logo = screen.getByTitle('OVHcloud_master_logo_fullcolor_RGB').closest('svg');
    expect(logo).toHaveAttribute('aria-label', 'OVHcloud logo');
  });

  it('should have proper role attribute', () => {
    render(<OVHCloudLogo />);
    
    const logo = screen.getByTitle('OVHcloud_master_logo_fullcolor_RGB').closest('svg');
    expect(logo).toHaveAttribute('role', 'img');
  });

  it('should maintain aspect ratio with width="auto"', () => {
    render(<OVHCloudLogo width="auto" height="32" />);
    
    const logo = screen.getByTitle('OVHcloud_master_logo_fullcolor_RGB').closest('svg');
    expect(logo).toHaveAttribute('width', 'auto');
    expect(logo).toHaveAttribute('height', '32');
  });

  it('should support CSS color inheritance', () => {
    render(<OVHCloudLogo className="text-red-500" />);
    
    const logo = screen.getByTitle('OVHcloud_master_logo_fullcolor_RGB').closest('svg');
    expect(logo).toHaveClass('text-red-500');
  });

  it('should remove hardcoded fill colors and use CSS classes', () => {
    render(<OVHCloudLogo />);
    
    const logo = screen.getByTitle('OVHcloud_master_logo_fullcolor_RGB').closest('svg');
    const paths = logo?.querySelectorAll('path');
    
    paths?.forEach(path => {
      expect(path.getAttribute('fill')).toBeNull();
    });
  });

  it('should have proper CSS classes for styling', () => {
    render(<OVHCloudLogo />);
    
    const logo = screen.getByTitle('OVHcloud_master_logo_fullcolor_RGB').closest('svg');
    const ovhPaths = logo?.querySelectorAll('.ovh-logo-primary, .ovh-logo-secondary');
    
    expect(ovhPaths?.length).toBeGreaterThan(0);
  });
});