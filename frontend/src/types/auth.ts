export interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  full_name: string;
  avatar_url?: string;
  is_active: boolean;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

export type UserRole = 'team_lead' | 'rpa_developer' | 'rpa_operations' | 'it_support';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
  expires_in: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  permissions: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export const RoleLabels: Record<UserRole, string> = {
  team_lead: 'Team Lead',
  rpa_developer: 'RPA Developer',
  rpa_operations: 'RPA Operations',
  it_support: 'IT Support'
};

export const RoleColors: Record<UserRole, string> = {
  team_lead: '#ff4d4f',
  rpa_developer: '#1890ff',
  rpa_operations: '#52c41a',
  it_support: '#faad14'
};