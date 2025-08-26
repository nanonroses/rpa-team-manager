import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { LoginCredentials, LoginResponse, User } from '@/types/auth';
import { Project } from '@/types/project';

class ApiService {
  private api: AxiosInstance;
  private baseURL: string;

  constructor() {
    this.baseURL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8001';
    
    this.api = axios.create({
      baseURL: `${this.baseURL}/api`,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      (config: any) => {
        const token = localStorage.getItem('rpa_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Clear auth data and redirect to login
          localStorage.removeItem('rpa_token');
          localStorage.removeItem('rpa_user');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Utility methods for fileService
  getBaseURL(): string {
    return this.baseURL;
  }

  getToken(): string | null {
    return localStorage.getItem('rpa_token');
  }

  // Health check
  async healthCheck(): Promise<any> {
    const response = await axios.get(`${this.baseURL}/health`);
    return response.data;
  }

  // Authentication endpoints
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await this.api.post('/auth/login', credentials);
    return response.data;
  }

  async logout(): Promise<void> {
    await this.api.post('/auth/logout');
  }

  async getCurrentUser(): Promise<{ user: User; permissions: string[] }> {
    const response = await this.api.get('/auth/me');
    return response.data;
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await this.api.post('/auth/change-password', {
      oldPassword,
      newPassword
    });
  }

  async resetPassword(email: string): Promise<{ message: string; tempPassword?: string }> {
    const response = await this.api.post('/auth/reset-password', { email });
    return response.data;
  }

  async getUsers(): Promise<{ id: number; full_name: string; email: string; role: string }[]> {
    const response = await this.api.get('/auth/users');
    return response.data;
  }

  // Project endpoints
  async getProjects(): Promise<Project[]> {
    const response = await this.api.get('/projects');
    return response.data;
  }

  async getProject(id: number): Promise<Project> {
    const response = await this.api.get(`/projects/${id}`);
    return response.data;
  }

  async createProject(projectData: Partial<Project>): Promise<Project> {
    const response = await this.api.post('/projects', projectData);
    return response.data;
  }

  async updateProject(id: number, updates: Partial<Project>): Promise<Project> {
    const response = await this.api.put(`/projects/${id}`, updates);
    return response.data;
  }

  async deleteProject(id: number): Promise<void> {
    await this.api.delete(`/projects/${id}`);
  }

  // Financial endpoints
  async getROIDashboard(): Promise<any> {
    const response = await this.api.get('/financial/dashboard');
    return response.data;
  }

  async getUserCosts(): Promise<any[]> {
    const response = await this.api.get('/financial/user-costs');
    return response.data;
  }

  async createUserCost(data: { user_id: number; monthly_cost: number; effective_from: string }): Promise<any> {
    const response = await this.api.post('/financial/user-costs', data);
    return response.data;
  }

  async getProjectROI(projectId: number): Promise<any> {
    const response = await this.api.get(`/financial/project-roi/${projectId}`);
    return response.data;
  }

  // Task Management APIs
  async getTaskBoards(projectId?: number): Promise<any> {
    const url = projectId ? `/tasks/boards?project_id=${projectId}` : '/tasks/boards';
    const response = await this.api.get(url);
    return response.data;
  }

  async getTaskBoard(boardId: number): Promise<any> {
    const response = await this.api.get(`/tasks/boards/${boardId}`);
    return response.data;
  }

  async createTaskBoard(boardData: any): Promise<any> {
    const response = await this.api.post('/tasks/boards', boardData);
    return response.data;
  }

  async getTasks(filters?: any): Promise<any> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }
    const response = await this.api.get(`/tasks?${params.toString()}`);
    return response.data;
  }

  async createTask(taskData: any): Promise<any> {
    const response = await this.api.post('/tasks', taskData);
    return response.data;
  }

  async updateTask(taskId: number, taskData: any): Promise<any> {
    const response = await this.api.put(`/tasks/${taskId}`, taskData);
    return response.data;
  }

  async deleteTask(taskId: number): Promise<any> {
    const response = await this.api.delete(`/tasks/${taskId}`);
    return response.data;
  }

  async moveTask(taskId: number, moveData: { column_id: number; position: number }): Promise<any> {
    const response = await this.api.post(`/tasks/${taskId}/move`, moveData);
    return response.data;
  }

  async getMyTasks(): Promise<any> {
    const response = await this.api.get('/tasks/my-tasks');
    return response.data;
  }

  async getProjectGantt(id: number): Promise<{ tasks: any[]; dependencies: any[] }> {
    const response = await this.api.get(`/pmo/projects/${id}/gantt`);
    return response.data;
  }

  // Generic HTTP methods
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.api.get(url, config);
    return response.data;
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.api.post(url, data, config);
    return response.data;
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.api.put(url, data, config);
    return response.data;
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.api.delete(url, config);
    return response.data;
  }

  // Generic request method for custom endpoints
  async request<T = any>(config: AxiosRequestConfig): Promise<T> {
    const response = await this.api.request(config);
    return response.data;
  }

  // Utility methods
  setAuthToken(token: string): void {
    localStorage.setItem('rpa_token', token);
  }

  removeAuthToken(): void {
    localStorage.removeItem('rpa_token');
    localStorage.removeItem('rpa_user');
  }

  getAuthToken(): string | null {
    return localStorage.getItem('rpa_token');
  }

  // Settings endpoints
  async getGlobalSettings(): Promise<any> {
    const response = await this.api.get('/settings');
    return response.data;
  }

  async updateGlobalSettings(settings: any): Promise<any> {
    const response = await this.api.put('/settings', settings);
    return response.data;
  }

  // Tasks API methods
  async getProjectTasks(projectId: number, limit: number = 5): Promise<any[]> {
    const response = await this.api.get(`/tasks/project/${projectId}?limit=${limit}`);
    return response.data;
  }

  // Ideas API methods
  async getIdeas(filters?: any): Promise<any[]> {
    const params = new URLSearchParams();
    if (filters?.status && filters.status !== 'all') params.append('status', filters.status);
    if (filters?.category && filters.category !== 'all') params.append('category', filters.category);
    if (filters?.sort) params.append('sort', filters.sort);
    
    const response = await this.api.get(`/ideas${params.toString() ? '?' + params.toString() : ''}`);
    return response.data;
  }

  async getIdea(id: number): Promise<any> {
    const response = await this.api.get(`/ideas/${id}`);
    return response.data;
  }

  async createIdea(ideaData: any): Promise<any> {
    const response = await this.api.post('/ideas', ideaData);
    return response.data;
  }

  async updateIdea(id: number, updates: any): Promise<any> {
    const response = await this.api.put(`/ideas/${id}`, updates);
    return response.data;
  }

  async deleteIdea(id: number): Promise<void> {
    await this.api.delete(`/ideas/${id}`);
  }

  async voteIdea(id: number, voteType: 'up' | 'down'): Promise<any> {
    const response = await this.api.post(`/ideas/${id}/vote`, { vote_type: voteType });
    return response.data;
  }

  async getIdeaComments(id: number): Promise<any[]> {
    const response = await this.api.get(`/ideas/${id}/comments`);
    return response.data;
  }

  async createIdeaComment(id: number, comment: string): Promise<any> {
    const response = await this.api.post(`/ideas/${id}/comments`, { comment });
    return response.data;
  }

  async getIdeaStats(): Promise<any> {
    const response = await this.api.get('/ideas/stats');
    return response.data;
  }

  // Support API methods
  // Support Companies
  async getSupportCompanies(filters?: any): Promise<any> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.month) params.append('month', filters.month);
    
    const response = await this.api.get(`/support/companies${params.toString() ? '?' + params.toString() : ''}`);
    return response.data;
  }

  async getSupportCompany(id: number): Promise<any> {
    const response = await this.api.get(`/support/companies/${id}`);
    return response.data;
  }

  async createSupportCompany(companyData: any): Promise<any> {
    const response = await this.api.post('/support/companies', companyData);
    return response.data;
  }

  async updateSupportCompany(id: number, updates: any): Promise<any> {
    const response = await this.api.put(`/support/companies/${id}`, updates);
    return response.data;
  }

  async deleteSupportCompany(id: number): Promise<{ message: string; deletedTickets: number }> {
    const response = await this.api.delete(`/support/companies/${id}`);
    return response.data;
  }

  async getSupportCompanyMetrics(id: number, months?: number): Promise<any> {
    const params = months ? `?months=${months}` : '';
    const response = await this.api.get(`/support/companies/${id}/metrics${params}`);
    return response.data;
  }

  // Support Tickets
  async getSupportTickets(filters?: any): Promise<any> {
    const params = new URLSearchParams();
    if (filters?.company_id) params.append('company_id', filters.company_id.toString());
    if (filters?.status) params.append('status', filters.status);
    if (filters?.priority) params.append('priority', filters.priority);
    if (filters?.ticket_type) params.append('ticket_type', filters.ticket_type);
    if (filters?.resolver_id) params.append('resolver_id', filters.resolver_id.toString());
    if (filters?.search) params.append('search', filters.search);
    if (filters?.date_from) params.append('date_from', filters.date_from);
    if (filters?.date_to) params.append('date_to', filters.date_to);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    
    const response = await this.api.get(`/support/tickets${params.toString() ? '?' + params.toString() : ''}`);
    return response.data;
  }

  async getSupportTicket(id: string): Promise<any> {
    const response = await this.api.get(`/support/tickets/${id}`);
    return response.data;
  }

  async createSupportTicket(ticketData: any): Promise<any> {
    const response = await this.api.post('/support/tickets', ticketData);
    return response.data;
  }

  async updateSupportTicket(id: string, updates: any): Promise<any> {
    const response = await this.api.put(`/support/tickets/${id}`, updates);
    return response.data;
  }

  async addSupportTicketComment(id: string, commentData: any): Promise<any> {
    const response = await this.api.post(`/support/tickets/${id}/comments`, commentData);
    return response.data;
  }

  // Support Dashboard & Reports
  async getSupportDashboard(month?: string): Promise<any> {
    const params = month ? { month } : {};
    const response = await this.api.get('/support/dashboard', { params });
    return response.data;
  }

  async getSupportBillingReport(year?: number, month?: number): Promise<any> {
    const params = new URLSearchParams();
    if (year) params.append('year', year.toString());
    if (month) params.append('month', month.toString());
    
    const response = await this.api.get(`/support/billing-report${params.toString() ? '?' + params.toString() : ''}`);
    return response.data;
  }

  // Support RPA Processes
  async getRPAProcesses(companyId?: number): Promise<any> {
    const url = companyId ? `/support/rpa-processes?company_id=${companyId}` : '/support/rpa-processes';
    const response = await this.api.get(url);
    return response.data;
  }

  async createRPAProcess(processData: { company_id: number; process_name: string; process_description?: string }): Promise<any> {
    const response = await this.api.post('/support/rpa-processes', processData);
    return response.data;
  }

  // Support Contacts
  async getAllContacts(): Promise<any> {
    const response = await this.api.get('/support/contacts');
    return response.data;
  }

  async getCompanyContacts(companyId: number): Promise<any> {
    const response = await this.api.get(`/support/companies/${companyId}/contacts`);
    return response.data;
  }

  async createCompanyContact(companyId: number, contactData: any): Promise<any> {
    const response = await this.api.post(`/support/companies/${companyId}/contacts`, contactData);
    return response.data;
  }

  // PMO API methods
  async getPMODashboard(): Promise<any> {
    const response = await this.api.get('/pmo/dashboard');
    return response.data;
  }

  async getPMOAnalytics(): Promise<any> {
    const response = await this.api.get('/pmo/analytics');
    return response.data;
  }

  async getPMOProjectGantt(projectId: number): Promise<any> {
    const response = await this.api.get(`/pmo/projects/${projectId}/gantt`);
    return response.data;
  }

  async createMilestone(milestoneData: any): Promise<any> {
    const response = await this.api.post('/pmo/milestones', milestoneData);
    return response.data;
  }

  async updateMilestone(milestoneId: number, updates: any): Promise<any> {
    const response = await this.api.put(`/pmo/milestones/${milestoneId}`, updates);
    return response.data;
  }

  async deleteMilestone(milestoneId: number): Promise<any> {
    const response = await this.api.delete(`/pmo/milestones/${milestoneId}`);
    return response.data;
  }

  async getProjectPMOMetrics(projectId: number): Promise<any> {
    const response = await this.api.get(`/pmo/projects/${projectId}/metrics`);
    return response.data;
  }

  async updateProjectMetrics(projectId: number, metrics: any): Promise<any> {
    const response = await this.api.post(`/pmo/projects/${projectId}/metrics`, metrics);
    return response.data;
  }

  // Admin/User Management API methods
  async createUser(userData: { full_name: string; email: string; role: string; password: string }): Promise<any> {
    const response = await this.api.post('/auth/admin/users', userData);
    return response.data;
  }

  async updateUser(userId: number, updates: { full_name?: string; email?: string; role?: string; is_active?: boolean }): Promise<any> {
    const response = await this.api.put(`/auth/admin/users/${userId}`, updates);
    return response.data;
  }

  async deleteUser(userId: number): Promise<any> {
    const response = await this.api.delete(`/auth/admin/users/${userId}`);
    return response.data;
  }

  async resetUserPassword(userId: number, newPassword: string): Promise<any> {
    const response = await this.api.post(`/auth/admin/users/${userId}/reset-password`, { newPassword });
    return response.data;
  }

  // Excel Import API methods
  async previewExcelImport(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await this.api.post('/support/import/preview', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async executeExcelImport(file: File, mappings: any, options: any = {}): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mappings', JSON.stringify(mappings));
    formData.append('options', JSON.stringify(options));
    
    const response = await this.api.post('/support/import/execute', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;