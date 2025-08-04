import { configureStore } from '@reduxjs/toolkit';
import authReducer, { login, logout } from '../authSlice';

// Mock the API
jest.mock('services/api', () => ({
  authApi: {
    login: jest.fn(),
    verifyToken: jest.fn(),
  },
}));

describe('authSlice', () => {
  let store: ReturnType<typeof configureStore>;
  const { authApi } = require('services/api');

  beforeEach(() => {
    store = configureStore({
      reducer: {
        auth: authReducer,
      },
    });
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = store.getState().auth;
      
      expect(state.user).toBe(null);
      expect(state.token).toBeFalsy(); // Can be null or undefined
      expect(state.isAuthenticated).toBe(false);
      expect(state.loading).toBe(false);
      expect(state.error).toBe(null);
    });
  });

  describe('login async thunk', () => {
    const mockCredentials = {
      username: 'testuser',
      password: 'testpass',
    };

    const mockResponse = {
      access_token: 'test-token-123',
      token_type: 'bearer',
      user: {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
      },
    };

    describe('when login is successful', () => {
      beforeEach(() => {
        authApi.login.mockResolvedValue(mockResponse);
      });

      it('should set loading state during login attempt', () => {
        store.dispatch(login(mockCredentials));
        
        const state = store.getState().auth;
        expect(state.loading).toBe(true);
        expect(state.error).toBe(null);
      });

      it('should set authenticated state on successful login', async () => {
        await store.dispatch(login(mockCredentials));
        
        const state = store.getState().auth;
        expect(state.isAuthenticated).toBe(true);
        expect(state.loading).toBe(false);
        expect(state.error).toBe(null);
        expect(state.token).toBe('test-token-123');
      });

      it('should call API with correct credentials', async () => {
        await store.dispatch(login(mockCredentials));
        
        expect(authApi.login).toHaveBeenCalledWith({
          username: 'testuser',
          password: 'testpass',
        });
      });

      it('should set the token in the store state', async () => {
        await store.dispatch(login(mockCredentials));
        
        const state = store.getState().auth;
        expect(state.token).toBe('test-token-123');
        expect(state.isAuthenticated).toBe(true);
      });
    });

    describe('when login fails', () => {
      it('should handle API error response with detail message', async () => {
        const errorResponse = {
          response: {
            data: {
              detail: 'Invalid credentials provided',
            },
          },
        };
        authApi.login.mockRejectedValue(errorResponse);

        await store.dispatch(login(mockCredentials));
        
        const state = store.getState().auth;
        expect(state.isAuthenticated).toBe(false);
        expect(state.loading).toBe(false);
        expect(state.error).toBe('Invalid credentials provided');
        expect(state.user).toBe(null);
        expect(state.token).toBeFalsy(); // Can be null or undefined
      });

      it('should handle API error response without detail message', async () => {
        const errorResponse = {
          response: {
            data: {},
          },
        };
        authApi.login.mockRejectedValue(errorResponse);

        await store.dispatch(login(mockCredentials));
        
        const state = store.getState().auth;
        expect(state.error).toBe('Login failed');
      });

      it('should handle network error without response', async () => {
        const networkError = {
          message: 'Network Error',
        };
        authApi.login.mockRejectedValue(networkError);

        await store.dispatch(login(mockCredentials));
        
        const state = store.getState().auth;
        expect(state.error).toBe('Login failed');
      });

      it('should handle unknown error types', async () => {
        const unknownError = 'Some string error';
        authApi.login.mockRejectedValue(unknownError);

        await store.dispatch(login(mockCredentials));
        
        const state = store.getState().auth;
        expect(state.error).toBe('Login failed');
      });

      it('should not set token in state on failed login', async () => {
        authApi.login.mockRejectedValue(new Error('Login failed'));
        await store.dispatch(login(mockCredentials));
        
        const state = store.getState().auth;
        expect(state.token).toBeFalsy();
        expect(state.isAuthenticated).toBe(false);
      });
    });
  });

  describe('logout action', () => {
    beforeEach(async () => {
      // Set up authenticated state first
      const mockResponse = {
        access_token: 'test-token-123',
        token_type: 'bearer',
        user: {
          id: 'user-1',
          username: 'testuser',
          email: 'test@example.com',
        },
      };
      authApi.login.mockResolvedValue(mockResponse);
      await store.dispatch(login({ username: 'testuser', password: 'testpass' }));
    });

    it('should clear all authentication state', () => {
      store.dispatch(logout());
      
      const state = store.getState().auth;
      expect(state.user).toBe(null);
      expect(state.token).toBe(null);
      expect(state.isAuthenticated).toBe(false);
      expect(state.loading).toBe(false);
      expect(state.error).toBe(null);
    });

    it('should clear token from the store state', () => {
      store.dispatch(logout());
      
      const state = store.getState().auth;
      expect(state.token).toBe(null);
      expect(state.isAuthenticated).toBe(false);
    });

    it('should work even when user is not authenticated', () => {
      // First logout to clear state
      store.dispatch(logout());
      
      // Logout again
      expect(() => store.dispatch(logout())).not.toThrow();
      
      const state = store.getState().auth;
      expect(state.user).toBe(null);
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('error handling edge cases', () => {
    it('should handle null error response', async () => {
      authApi.login.mockRejectedValue(null);

      await store.dispatch(login({ username: 'test', password: 'test' }));
      
      const state = store.getState().auth;
      expect(state.error).toBe('Login failed');
    });

    it('should handle undefined error response', async () => {
      authApi.login.mockRejectedValue(undefined);

      await store.dispatch(login({ username: 'test', password: 'test' }));
      
      const state = store.getState().auth;
      expect(state.error).toBe('Login failed');
    });

    it('should handle error response with nested structure', async () => {
      const complexError = {
        response: {
          data: {
            detail: {
              message: 'Complex error structure',
            },
          },
        },
      };
      authApi.login.mockRejectedValue(complexError);

      await store.dispatch(login({ username: 'test', password: 'test' }));
      
      const state = store.getState().auth;
      // The error handler should fall back to default since detail is not a string
      expect(state.error).toBe('Login failed');
    });
  });

  describe('behavioral validation', () => {
    it('should maintain state consistency during login flow', async () => {
      const mockResponse = {
        access_token: 'test-token',
        user: { id: 'user-1', username: 'test', email: 'test@example.com' },
      };
      authApi.login.mockResolvedValue(mockResponse);

      await store.dispatch(login({ username: 'test', password: 'test' }));
      
      const state = store.getState().auth;
      expect(state.isAuthenticated).toBe(true);
      expect(state.token).toBe('test-token');
      expect(state.loading).toBe(false);
      expect(state.error).toBe(null);
    });
  });
});