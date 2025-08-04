import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { LoginRequest, LoginResponse, User } from '../../types';
import { authApi } from '../../services/api';

type AuthState = {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
};

const initialState: AuthState = {
  isAuthenticated: !!localStorage.getItem('token'),
  user: null,
  token: localStorage.getItem('token'),
  loading: false,
  error: null,
};

type ApiError = {
  response?: {
    data?: {
      detail?: string;
    };
  };
  message?: string;
};

const getErrorMessage = (error: unknown): string => {
  if (error && typeof error === 'object' && 'response' in error) {
    const apiError = error as ApiError;
    const detail = apiError.response?.data?.detail;
    return typeof detail === 'string' ? detail : 'Login failed';
  }
  return 'Login failed';
};

// Async thunks
export const login = createAsyncThunk(
  'auth/login',
  async (credentials: LoginRequest, { rejectWithValue }) => {
    try {
      const response = await authApi.login(credentials);
      localStorage.setItem('token', response.access_token);
      return response;
    } catch (error: unknown) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const verifyToken = createAsyncThunk(
  'auth/verifyToken',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authApi.verifyToken();
      return response;
    } catch (error: unknown) {
      localStorage.removeItem('token');
      return rejectWithValue('Token verification failed');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.token = null;
      localStorage.removeItem('token');
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action: PayloadAction<LoginResponse>) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.token = action.payload.access_token;
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Verify token
      .addCase(verifyToken.pending, (state) => {
        state.loading = true;
      })
      .addCase(verifyToken.fulfilled, (state, action) => {
        state.loading = false;
        state.user = { username: action.payload.user };
      })
      .addCase(verifyToken.rejected, (state) => {
        state.loading = false;
        state.isAuthenticated = false;
        state.token = null;
      });
  },
});

export const { logout, clearError } = authSlice.actions;
export default authSlice.reducer;