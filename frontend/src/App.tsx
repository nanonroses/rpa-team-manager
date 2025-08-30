import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntdApp } from 'antd';
import { QueryClient, QueryClientProvider } from 'react-query';

// Components
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AppLayout } from '@/components/common/AppLayout';

// Pages
import { LoginPage } from '@/pages/auth/LoginPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { ProjectsPage } from '@/pages/projects/ProjectsPage';
import { ProjectDetailPage } from '@/pages/projects/ProjectDetailPage';
import { TimeTrackingPage } from '@/pages/time/TimeTrackingPage';
import { TasksPage } from '@/pages/tasks/TasksPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import IdeasPage from '@/pages/ideas/IdeasPage';
import FilesPage from '@/pages/files/FilesPage';
import SupportPage from '@/pages/support/SupportPage';
import PMODashboard from '@/pages/pmo/PMODashboard';
import ProfilePage from '@/pages/profile/ProfilePage';
import TeamManagementPage from '@/pages/admin/TeamManagementPage';

// Ant Design theme configuration
const theme = {
  token: {
    colorPrimary: '#1890ff',
    borderRadius: 8,
    wireframe: false,
  },
  components: {
    Layout: {
      bodyBg: '#f5f5f5',
      headerBg: '#ffffff',
      siderBg: '#ffffff',
    },
    Menu: {
      itemBg: 'transparent',
      itemSelectedBg: '#e6f7ff',
      itemSelectedColor: '#1890ff',
    },
  },
};

// React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={theme}>
        <AntdApp>
          <Router
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true
            }}
          >
            <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            
            {/* Protected routes */}
            <Route path="/" element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }>
              {/* Dashboard */}
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              
              {/* Projects */}
              <Route path="projects" element={<ProjectsPage />} />
              <Route path="projects/:id" element={<ProjectDetailPage />} />
              
              {/* Tasks */}
              <Route path="tasks" element={<TasksPage />} />
              
              {/* Time Tracking */}
              <Route path="time" element={<TimeTrackingPage />} />
              
              {/* Ideas */}
              <Route path="ideas" element={<IdeasPage />} />
              
              
              {/* Files */}
              <Route path="files" element={<FilesPage />} />
              
              {/* Support */}
              <Route path="support" element={<SupportPage />} />
              
              {/* PMO Dashboard */}
              <Route path="pmo" element={
                <ProtectedRoute requiredRoles={['team_lead', 'rpa_operations']}>
                  <PMODashboard />
                </ProtectedRoute>
              } />
              
              {/* PMO Gantt for specific projects - accessible by developers */}
              <Route path="pmo/gantt/:id" element={
                <ProtectedRoute requiredRoles={['team_lead', 'rpa_operations', 'rpa_developer']}>
                  <PMODashboard ganttMode={true} />
                </ProtectedRoute>
              } />
              
              {/* Admin (Team Lead only) */}
              <Route path="admin" element={
                <ProtectedRoute requiredRoles={['team_lead']}>
                  <TeamManagementPage />
                </ProtectedRoute>
              } />
              
              {/* Profile */}
              <Route path="profile" element={<ProfilePage />} />
              
              {/* Settings (Team Lead only) */}
              <Route path="settings" element={
                <ProtectedRoute requiredRoles={['team_lead']}>
                  <SettingsPage />
                </ProtectedRoute>
              } />
            </Route>
            
            {/* Unauthorized page */}
            <Route path="/unauthorized" element={
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                padding: '20px',
                textAlign: 'center'
              }}>
                <h1>Access Denied</h1>
                <p>You don't have permission to access this page.</p>
                <button onClick={() => window.history.back()}>
                  Go Back
                </button>
              </div>
            } />
            
            {/* 404 page */}
            <Route path="*" element={
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                padding: '20px',
                textAlign: 'center'
              }}>
                <h1>Page Not Found</h1>
                <p>The page you're looking for doesn't exist.</p>
                <button onClick={() => window.location.href = '/dashboard'}>
                  Go to Dashboard
                </button>
              </div>
            } />
            </Routes>
          </Router>
        </AntdApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}

export default App;