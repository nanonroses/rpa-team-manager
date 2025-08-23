import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AuthState, User, LoginCredentials } from '@/types/auth';
import { apiService } from '@/services/api';

interface AuthStore extends AuthState {
  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  getCurrentUser: () => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  resetPassword: (email: string) => Promise<{ message: string; tempPassword?: string }>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      token: null,
      permissions: [],
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Actions
      login: async (credentials: LoginCredentials) => {
        try {
          set({ isLoading: true, error: null });
          
          const response = await apiService.login(credentials);
          const { user, token } = response;
          
          // Store token in API service
          apiService.setAuthToken(token);
          
          // Get user permissions
          const userProfile = await apiService.getCurrentUser();
          
          set({
            user,
            token,
            permissions: userProfile.permissions,
            isAuthenticated: true,
            isLoading: false,
            error: null
          });
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || 'Login failed';
          set({
            user: null,
            token: null,
            permissions: [],
            isAuthenticated: false,
            isLoading: false,
            error: errorMessage
          });
          throw error;
        }
      },

      logout: async () => {
        try {
          set({ isLoading: true });
          
          // Call logout endpoint if authenticated
          if (get().isAuthenticated) {
            await apiService.logout();
          }
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          // Clear local state regardless of API call result
          apiService.removeAuthToken();
          
          // Clear localStorage manually to prevent any persistence issues
          localStorage.removeItem('rpa-auth-storage');
          localStorage.removeItem('rpa_token');
          
          set({
            user: null,
            token: null,
            permissions: [],
            isAuthenticated: false,
            isLoading: false,
            error: null
          });
        }
      },

      getCurrentUser: async () => {
        try {
          set({ isLoading: true, error: null });
          
          const response = await apiService.getCurrentUser();
          
          set({
            user: response.user,
            permissions: response.permissions,
            isAuthenticated: true,
            isLoading: false
          });
        } catch (error: any) {
          // If token is invalid, logout immediately without calling API
          if (error.response?.status === 401 || error.response?.data?.error?.includes('expired')) {
            // Clear local state immediately without calling logout API
            apiService.removeAuthToken();
            localStorage.removeItem('rpa-auth-storage');
            localStorage.removeItem('rpa_token');
            
            set({
              user: null,
              token: null,
              permissions: [],
              isAuthenticated: false,
              isLoading: false,
              error: null
            });
          } else {
            set({
              isLoading: false,
              error: error.response?.data?.error || 'Failed to get user profile'
            });
          }
          throw error; // Re-throw for ProtectedRoute to handle
        }
      },

      changePassword: async (oldPassword: string, newPassword: string) => {
        try {
          set({ isLoading: true, error: null });
          
          await apiService.changePassword(oldPassword, newPassword);
          
          set({ isLoading: false });
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || 'Failed to change password';
          set({ isLoading: false, error: errorMessage });
          throw error;
        }
      },

      resetPassword: async (email: string) => {
        try {
          set({ isLoading: true, error: null });
          
          const response = await apiService.resetPassword(email);
          
          set({ isLoading: false });
          return response;
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || 'Failed to reset password';
          set({ isLoading: false, error: errorMessage });
          throw error;
        }
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      setError: (error: string | null) => {
        set({ error });
      },

      clearError: () => {
        set({ error: null });
      },

      hasPermission: (permission: string) => {
        const { permissions } = get();
        
        // Check for exact permission
        if (permissions.includes(permission)) {
          return true;
        }
        
        // Check for wildcard permissions
        for (const userPermission of permissions) {
          if (userPermission.endsWith(':*')) {
            const base = userPermission.replace(':*', '');
            if (permission.startsWith(base + ':')) {
              return true;
            }
          }
          
          // Full wildcard
          if (userPermission === '*') {
            return true;
          }
        }
        
        return false;
      }
    }),
    {
      name: 'rpa-auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        permissions: state.permissions,
        isAuthenticated: state.isAuthenticated
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          apiService.setAuthToken(state.token);
        }
      }
    }
  )
);