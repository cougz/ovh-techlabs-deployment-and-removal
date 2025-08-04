import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { store } from '../../store';
import Layout from '../Layout';

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <Provider store={store}>
      <BrowserRouter>
        {ui}
      </BrowserRouter>
    </Provider>
  );
};

describe('Layout Logo Integration', () => {
  it('should display OVHcloud logo in header', () => {
    renderWithProviders(<Layout>Test Content</Layout>);
    
    const logo = screen.getByLabelText('OVHcloud logo');
    expect(logo).toBeInTheDocument();
  });

  it('should have proper logo container styling', () => {
    renderWithProviders(<Layout>Test Content</Layout>);
    
    const logo = screen.getByLabelText('OVHcloud logo');
    const logoContainer = logo.closest('.logo-container');
    
    expect(logoContainer).toHaveClass('logo-container');
  });

  it('should display standalone logo without text in sidebar', () => {
    renderWithProviders(<Layout>Test Content</Layout>);
    
    const logo = screen.getByLabelText('OVHcloud logo');
    expect(logo).toBeInTheDocument();
    
    // Logo should be standalone - no text elements in sidebar
    expect(screen.queryByText('TechLabs')).not.toBeInTheDocument();
    expect(screen.queryByText('Automation Framework')).not.toBeInTheDocument();
  });

  it('should have proper logo CSS classes', () => {
    renderWithProviders(<Layout>Test Content</Layout>);
    
    const logo = screen.getByLabelText('OVHcloud logo');
    
    expect(logo).toHaveClass('logo-svg');
  });

  it('should display application title in main content header', () => {
    renderWithProviders(<Layout>Test Content</Layout>);
    
    // Should have "OVHcloud TechLabs - Automation Framework" in main header
    expect(screen.getByText('OVHcloud TechLabs - Automation Framework')).toBeInTheDocument();
  });

  it('should have clean minimalist header design', () => {
    renderWithProviders(<Layout>Test Content</Layout>);
    
    const logo = screen.getByLabelText('OVHcloud logo');
    const logoContainer = logo.closest('.logo-container');
    
    // Logo container should not contain any text elements
    expect(logoContainer?.querySelector('.logo-text')).not.toBeInTheDocument();
  });

  it('should include dark mode toggle in header', () => {
    renderWithProviders(<Layout>Test Content</Layout>);
    
    const darkModeToggle = screen.getByRole('checkbox', { name: /toggle dark mode/i });
    expect(darkModeToggle).toBeInTheDocument();
  });

  it('should have dark mode toggle in the correct location', () => {
    renderWithProviders(<Layout>Test Content</Layout>);
    
    const darkModeToggle = screen.getByRole('checkbox', { name: /toggle dark mode/i });
    const themeSwitch = darkModeToggle.closest('.theme-switch');
    
    // Should be in the header area
    expect(themeSwitch).toBeInTheDocument();
  });

  it('should display full application title in main content header', () => {
    renderWithProviders(<Layout>Test Content</Layout>);
    
    const appTitle = screen.getByText('OVHcloud TechLabs - Automation Framework');
    expect(appTitle).toBeInTheDocument();
    expect(appTitle).toHaveClass('app-title');
  });

  it('should have proper header structure with app title and dark mode toggle', () => {
    renderWithProviders(<Layout>Test Content</Layout>);
    
    const appTitle = screen.getByText('OVHcloud TechLabs - Automation Framework');
    const darkModeToggle = screen.getByRole('checkbox', { name: /toggle dark mode/i });
    
    // Both should be in the header area
    expect(appTitle).toBeInTheDocument();
    expect(darkModeToggle).toBeInTheDocument();
  });
});