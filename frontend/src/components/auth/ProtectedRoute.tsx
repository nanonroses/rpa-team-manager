import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuthStore } from '@/store/authStore';
import { UserRole } from '@/types/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: UserRole[];
  requiredPermissions?: string[];
  fallbackPath?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRoles = [],
  requiredPermissions = [],
  fallbackPath = '/login'
}) => {
  const location = useLocation();
  const { 
    isAuthenticated, 
    isLoading, 
    user, 
    token,
    getCurrentUser,
    hasPermission,
    logout
  } = useAuthStore();

  useEffect(() => {
    // If we have a token but no user data, fetch user profile
    if (!isLoading && token && !user) {
      console.log('🔍 ProtectedRoute: Token exists but no user data, fetching user profile...');
      getCurrentUser().catch((error) => {
        console.log('❌ ProtectedRoute: getCurrentUser failed:', error?.response?.status || error.message);
        // If getCurrentUser fails (e.g., token expired), logout immediately
        logout();
      });
    }
    
    // Additional check: if we have expired or invalid auth state, clear it
    if (!isLoading && token && user && !isAuthenticated) {
      console.log('🔴 ProtectedRoute: Inconsistent auth state detected, logging out...');
      logout();
    }
  }, [isLoading, user, token, isAuthenticated, getCurrentUser, logout]);

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh' 
      }}>
        <Spin size="large" tip="Loading..." />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return (
      <Navigate 
        to={fallbackPath} 
        state={{ from: location }} 
        replace 
      />
    );
  }

  // Check role-based access
  if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
    return (
      <Navigate 
        to="/unauthorized" 
        state={{ 
          message: `Access denied. Required roles: ${requiredRoles.join(', ')}`,
          userRole: user.role
        }} 
        replace 
      />
    );
  }

  // Check permission-based access
  if (requiredPermissions.length > 0) {
    const hasRequiredPermissions = requiredPermissions.every(permission => 
      hasPermission(permission)
    );

    if (!hasRequiredPermissions) {
      return (
        <Navigate 
          to="/unauthorized" 
          state={{ 
            message: `Access denied. Required permissions: ${requiredPermissions.join(', ')}`,
            userRole: user.role
          }} 
          replace 
        />
      );
    }
  }

  return <>{children}</>;
};