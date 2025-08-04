import axios, { AxiosResponse, AxiosError } from 'axios';
import { 
  Workshop, 
  WorkshopSummary, 
  WorkshopTemplate,
  Attendee, 
  AttendeeCredentials,
  DeploymentLog,
  LoginRequest, 
  LoginResponse,
  CreateWorkshopRequest,
  UpdateWorkshopRequest,
  CreateAttendeeRequest,
  TaskResponse
} from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || '';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token expiration
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response: AxiosResponse<LoginResponse> = await apiClient.post('/api/auth/login', credentials);
    return response.data;
  },
  
  verifyToken: async (): Promise<{ valid: boolean; user: string }> => {
    const response = await apiClient.post('/api/auth/verify');
    return response.data;
  },
};

// Workshop API
export const workshopApi = {
  getWorkshops: async (params?: { skip?: number; limit?: number; status?: string }): Promise<WorkshopSummary[]> => {
    const response: AxiosResponse<WorkshopSummary[]> = await apiClient.get('/api/workshops', { params });
    return response.data;
  },
  
  getWorkshop: async (id: string): Promise<Workshop> => {
    const response: AxiosResponse<Workshop> = await apiClient.get(`/api/workshops/${id}`);
    return response.data;
  },
  
  createWorkshop: async (workshop: CreateWorkshopRequest): Promise<Workshop> => {
    const response: AxiosResponse<Workshop> = await apiClient.post('/api/workshops', workshop);
    return response.data;
  },
  
  updateWorkshop: async (id: string, workshop: UpdateWorkshopRequest): Promise<Workshop> => {
    const response: AxiosResponse<Workshop> = await apiClient.put(`/api/workshops/${id}`, workshop);
    return response.data;
  },
  
  deleteWorkshop: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/workshops/${id}`);
  },
  
  deployWorkshop: async (id: string): Promise<TaskResponse> => {
    const response: AxiosResponse<TaskResponse> = await apiClient.post(`/api/workshops/${id}/deploy`);
    return response.data;
  },
  
  cleanupWorkshop: async (id: string): Promise<TaskResponse> => {
    const response: AxiosResponse<TaskResponse> = await apiClient.delete(`/api/workshops/${id}/resources`);
    return response.data;
  },

  checkWorkshopStatus: async (id: string): Promise<any> => {
    const response = await apiClient.get(`/api/workshops/${id}/status-check`);
    return response.data;
  },

};

// Attendee API
export const attendeeApi = {
  getWorkshopAttendees: async (workshopId: string): Promise<Attendee[]> => {
    const response: AxiosResponse<Attendee[]> = await apiClient.get(`/api/attendees/workshop/${workshopId}`);
    return response.data;
  },
  
  getAttendee: async (id: string): Promise<Attendee> => {
    const response: AxiosResponse<Attendee> = await apiClient.get(`/api/attendees/${id}`);
    return response.data;
  },
  
  createAttendee: async (workshopId: string, attendee: CreateAttendeeRequest): Promise<Attendee> => {
    const response: AxiosResponse<Attendee> = await apiClient.post(`/api/attendees/`, attendee, {
      params: { workshop_id: workshopId }
    });
    return response.data;
  },
  
  deleteAttendee: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/attendees/${id}`);
  },
  
  getAttendeeCredentials: async (id: string): Promise<AttendeeCredentials> => {
    const response: AxiosResponse<AttendeeCredentials> = await apiClient.get(`/api/attendees/${id}/credentials`);
    return response.data;
  },
  
  deployAttendee: async (id: string): Promise<TaskResponse> => {
    const response: AxiosResponse<TaskResponse> = await apiClient.post(`/api/attendees/${id}/deploy`);
    return response.data;
  },
  
  destroyAttendeeResources: async (id: string): Promise<TaskResponse> => {
    const response: AxiosResponse<TaskResponse> = await apiClient.post(`/api/attendees/${id}/destroy`);
    return response.data;
  },
};

// Deployment API
export const deploymentApi = {
  getDeploymentLog: async (id: string): Promise<DeploymentLog> => {
    const response: AxiosResponse<DeploymentLog> = await apiClient.get(`/api/deployments/${id}`);
    return response.data;
  },
  
  getAttendeeDeploymentLogs: async (attendeeId: string): Promise<DeploymentLog[]> => {
    const response: AxiosResponse<DeploymentLog[]> = await apiClient.get(`/api/deployments/attendee/${attendeeId}`);
    return response.data;
  },
  
  getWorkshopDeploymentLogs: async (workshopId: string): Promise<DeploymentLog[]> => {
    const response: AxiosResponse<DeploymentLog[]> = await apiClient.get(`/api/deployments/workshop/${workshopId}`);
    return response.data;
  },
};

// Settings API
export const settingsApi = {
  getLoginPrefixConfig: async (): Promise<{login_prefix: string; export_format: string}> => {
    const response = await apiClient.get('/api/settings/login-prefix');
    return response.data;
  },
  
  setLoginPrefixConfig: async (config: {login_prefix: string; export_format: string}): Promise<void> => {
    await apiClient.post('/api/settings/login-prefix', config);
  },
};

// Template API
export const templateApi = {
  listTemplates: async (): Promise<WorkshopTemplate[]> => {
    const response: AxiosResponse<WorkshopTemplate[]> = await apiClient.get('/api/templates');
    return response.data;
  },
  
  getTemplate: async (name: string): Promise<WorkshopTemplate> => {
    const response: AxiosResponse<WorkshopTemplate> = await apiClient.get(`/api/templates/${name}`);
    return response.data;
  },
};

// Health API
export const healthApi = {
  healthCheck: async (): Promise<{ status: string; timestamp: string }> => {
    const response = await apiClient.get('/health');
    return response.data;
  },
  
  detailedHealthCheck: async (): Promise<any> => {
    const response = await apiClient.get('/health/detailed');
    return response.data;
  },
};

export default apiClient;