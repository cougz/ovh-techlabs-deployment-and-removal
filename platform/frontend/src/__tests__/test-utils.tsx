import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../store/slices/authSlice';

// Define the app state type
export interface RootState {
  auth: ReturnType<typeof authReducer>;
}

// Define store setup function
export function setupStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: {
      auth: authReducer,
    },
    preloadedState,
  });
}

export type AppStore = ReturnType<typeof setupStore>;
export type AppDispatch = AppStore['dispatch'];

// Custom render function that includes providers
interface ExtendedRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  preloadedState?: Partial<RootState>;
  store?: AppStore;
  initialEntries?: string[];
  queryClient?: QueryClient;
}

export function renderWithProviders(
  ui: React.ReactElement,
  {
    preloadedState = {},
    store = setupStore(preloadedState),
    initialEntries = ['/'],
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    }),
    ...renderOptions
  }: ExtendedRenderOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={initialEntries}>
            {children}
          </MemoryRouter>
        </QueryClientProvider>
      </Provider>
    );
  }

  return { store, queryClient, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}

// Mock data factories for consistent test data
export const createMockUser = (overrides: Partial<any> = {}) => ({
  id: 'test-user-id',
  username: 'testuser',
  email: 'test@example.com',
  ...overrides,
});

export const createMockWorkshop = (overrides: Partial<any> = {}) => ({
  id: 'test-workshop-id',
  name: 'Test Workshop',
  description: 'A test workshop description',
  start_date: '2024-07-15T10:00:00Z',
  end_date: '2024-07-15T18:00:00Z',
  status: 'planning' as const,
  created_at: '2024-07-01T00:00:00Z',
  updated_at: '2024-07-01T00:00:00Z',
  ...overrides,
});

export const createMockAttendee = (overrides: Partial<any> = {}) => ({
  id: 'test-attendee-id',
  username: 'test.attendee',
  email: 'attendee@example.com',
  status: 'planning' as const,
  workshop_id: 'test-workshop-id',
  ovh_project_id: null,
  created_at: '2024-07-01T00:00:00Z',
  updated_at: '2024-07-01T00:00:00Z',
  ...overrides,
});

export const createMockDeploymentLog = (overrides: Partial<any> = {}) => ({
  id: 'test-log-id',
  attendee_id: 'test-attendee-id',
  action: 'create_project',
  status: 'completed' as const,
  terraform_output: 'Test terraform output',
  error_message: null,
  created_at: '2024-07-01T10:00:00Z',
  updated_at: '2024-07-01T10:05:00Z',
  ...overrides,
});

export const createMockCredentials = (overrides: Partial<any> = {}) => ({
  username: 'ovh-user',
  password: 'secure-password',
  access_key: 'test-access-key',
  secret_key: 'test-secret-key',
  ...overrides,
});

// Authentication state helpers
export const createAuthenticatedState = (userOverrides: Partial<any> = {}) => ({
  auth: {
    user: createMockUser(userOverrides),
    token: 'test-auth-token',
    isAuthenticated: true,
    isLoading: false,
    error: null,
  },
});

export const createUnauthenticatedState = () => ({
  auth: {
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  },
});

export const createLoadingAuthState = () => ({
  auth: {
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  },
});

export const createErrorAuthState = (error: string = 'Authentication failed') => ({
  auth: {
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
    error,
  },
});

// API mock helpers
export const mockSuccessfulApiCall = <T,>(data: T) => 
  Promise.resolve({ data });

export const mockFailedApiCall = (error: { response?: { data?: { detail?: string } } } = {}) =>
  Promise.reject(error);

// Common test scenarios
export const testLoadingState = (getByTestId: any) => {
  expect(getByTestId || document.querySelector('.animate-pulse')).toBeInTheDocument();
};

export const testErrorState = (getByText: any, errorMessage: string = 'error') => {
  expect(getByText(new RegExp(errorMessage, 'i'))).toBeInTheDocument();
};

// Date formatting test helper
export const expectFormattedDate = (getByText: any, dateString: string) => {
  const formattedDate = new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  expect(getByText(new RegExp(formattedDate))).toBeInTheDocument();
};

// Wait for async operations helper
export const waitForApiCall = () => new Promise(resolve => setTimeout(resolve, 0));

// Custom matchers for better test readability
export const expectToBeInLoadingState = (element: Element | null) => {
  expect(element).toBeInTheDocument();
  expect(element).toHaveClass('animate-pulse');
};

export const expectToHaveStatusClass = (element: Element | null, status: string) => {
  expect(element).toBeInTheDocument();
  expect(element).toHaveClass(`status-${status}`);
};

// Mock window methods that are commonly used
export const mockWindowMethods = () => {
  Object.defineProperty(window, 'confirm', {
    writable: true,
    value: jest.fn(() => true),
  });

  Object.defineProperty(window, 'alert', {
    writable: true,
    value: jest.fn(),
  });

  Object.defineProperty(navigator, 'clipboard', {
    writable: true,
    value: {
      writeText: jest.fn(() => Promise.resolve()),
    },
  });
};

// Cleanup helper for tests
export const cleanupMocks = () => {
  jest.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
};

// File upload mock helper
export const createMockFile = (name: string = 'test.txt', type: string = 'text/plain') => {
  const file = new File(['test content'], name, { type });
  Object.defineProperty(file, 'size', { value: 1024 });
  return file;
};

// Network status mock helper
export const mockNetworkStatus = (isOnline: boolean = true) => {
  Object.defineProperty(navigator, 'onLine', {
    writable: true,
    value: isOnline,
  });
};

// Intersection Observer mock for components that use it
export const mockIntersectionObserver = () => {
  const mockIntersectionObserver = jest.fn();
  mockIntersectionObserver.mockReturnValue({
    observe: () => null,
    unobserve: () => null,
    disconnect: () => null,
  });
  window.IntersectionObserver = mockIntersectionObserver;
  window.IntersectionObserverEntry = jest.fn();
};

// Resize Observer mock for components that use it
export const mockResizeObserver = () => {
  window.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));
};