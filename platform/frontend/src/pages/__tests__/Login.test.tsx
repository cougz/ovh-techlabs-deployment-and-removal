import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { store } from '../../store';
import Login from '../Login';

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <Provider store={store}>
      <BrowserRouter>
        {ui}
      </BrowserRouter>
    </Provider>
  );
};

describe('Login Component', () => {
  beforeEach(() => {
    // Clean up between tests
    store.dispatch({ type: 'auth/clearError' });
  });

  it('should display OVHcloud logo instead of graduation cap icon', () => {
    renderWithProviders(<Login />);
    
    const ovhLogo = screen.getByLabelText('OVHcloud logo');
    expect(ovhLogo).toBeInTheDocument();
    
    // Should not have graduation cap icon
    const graduationCapIcon = screen.queryByTestId('graduation-cap-icon');
    expect(graduationCapIcon).not.toBeInTheDocument();
  });

  it('should display OVHcloud logo with proper sizing', () => {
    renderWithProviders(<Login />);
    
    const ovhLogo = screen.getByLabelText('OVHcloud logo');
    expect(ovhLogo).toHaveAttribute('height', '60');
    expect(ovhLogo).toHaveAttribute('width', 'auto');
  });

  it('should display correct title and subtitle', () => {
    renderWithProviders(<Login />);
    
    const title = screen.getByText('TechLabs Automation');
    expect(title).toBeInTheDocument();
    
    const subtitle = screen.getByText('Workshop Environment Management System');
    expect(subtitle).toBeInTheDocument();
  });

  it('should handle form submission', async () => {
    renderWithProviders(<Login />);
    
    const usernameInput = screen.getByPlaceholderText('Username');
    const passwordInput = screen.getByPlaceholderText('Password');
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    fireEvent.change(usernameInput, { target: { value: 'admin' } });
    fireEvent.change(passwordInput, { target: { value: 'admin' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Signing in...')).toBeInTheDocument();
    });
  });

  it('should show validation errors for empty fields', async () => {
    renderWithProviders(<Login />);
    
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Username is required')).toBeInTheDocument();
      expect(screen.getByText('Password is required')).toBeInTheDocument();
    });
  });

  it('should display default credentials information', () => {
    renderWithProviders(<Login />);
    
    const defaultCredentials = screen.getByText('Default credentials: admin / admin');
    expect(defaultCredentials).toBeInTheDocument();
  });
});