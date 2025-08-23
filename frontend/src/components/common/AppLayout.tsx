import React, { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Button, Typography, Badge, Space } from 'antd';
import type { MenuProps } from 'antd';
import {
  DashboardOutlined,
  ProjectOutlined,
  CheckSquareOutlined,
  ClockCircleOutlined,
  BulbOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  NotificationOutlined,
  BarChartOutlined,
  FileOutlined,
  CustomerServiceOutlined,
  FundOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { RoleLabels, RoleColors } from '@/types/auth';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

export const AppLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Profile',
      onClick: () => navigate('/profile')
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Settings',
      onClick: () => navigate('/settings')
    },
    {
      type: 'divider'
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      onClick: handleLogout
    }
  ];

  const getMenuItems = (): MenuProps['items'] => {
    const baseItems = [
      {
        key: '/dashboard',
        icon: <DashboardOutlined />,
        label: 'Dashboard'
      },
      {
        key: '/projects',
        icon: <ProjectOutlined />,
        label: 'Projects'
      },
      {
        key: '/tasks',
        icon: <CheckSquareOutlined />,
        label: 'Tasks'
      },
      {
        key: '/time',
        icon: <ClockCircleOutlined />,
        label: 'Time Tracking'
      },
      {
        key: '/ideas',
        icon: <BulbOutlined />,
        label: 'Ideas'
      },
      {
        key: '/files',
        icon: <FileOutlined />,
        label: 'Files'
      },
      {
        key: '/support',
        icon: <CustomerServiceOutlined />,
        label: 'Soporte'
      }
    ];

    // Add PMO for Team Lead and RPA Operations
    if (user?.role === 'team_lead' || user?.role === 'rpa_operations') {
      baseItems.push({
        key: '/pmo',
        icon: <FundOutlined />,
        label: 'PMO'
      });
    }

    // Add admin-only items for team lead
    if (user?.role === 'team_lead') {
      baseItems.push({
        key: '/settings',
        icon: <SettingOutlined />,
        label: 'Settings'
      });
    }

    return baseItems;
  };

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  const getPageTitle = () => {
    const path = location.pathname;
    switch (path) {
      case '/dashboard':
        return 'Dashboard';
      case '/projects':
        return 'Projects';
      case '/tasks':
        return 'Tasks';
      case '/time':
        return 'Time Tracking';
      case '/ideas':
        return 'Ideas';
      case '/priorities':
        return 'Priority Matrix';
      case '/files':
        return 'Files';
      case '/support':
        return 'Soporte';
      case '/admin':
        return 'Administration';
      default:
        return 'RPA Team Manager';
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        trigger={null} 
        collapsible 
        collapsed={collapsed}
        style={{
          background: '#fff',
          borderRight: '1px solid #f0f0f0',
          boxShadow: '2px 0 8px rgba(0,0,0,0.06)'
        }}
      >
        <div style={{ 
          padding: '16px', 
          borderBottom: '1px solid #f0f0f0',
          textAlign: 'center'
        }}>
          <div style={{ 
            fontSize: collapsed ? '24px' : '32px', 
            marginBottom: collapsed ? '0' : '8px',
            transition: 'all 0.2s'
          }}>
            🤖
          </div>
          {!collapsed && (
            <Text strong style={{ fontSize: '14px', color: '#1890ff' }}>
              RPA Manager
            </Text>
          )}
        </div>

        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={getMenuItems()}
          onClick={handleMenuClick}
          style={{ 
            border: 'none',
            marginTop: '8px'
          }}
        />
      </Sider>

      <Layout>
        <Header style={{ 
          padding: '0 24px', 
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
        }}>
          <Space align="center">
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: '16px', width: 32, height: 32 }}
            />
            <Typography.Title level={4} style={{ margin: 0, color: '#1f1f1f' }}>
              {getPageTitle()}
            </Typography.Title>
          </Space>

          <Space align="center">
            <Badge count={0} size="small">
              <Button 
                type="text" 
                icon={<NotificationOutlined />}
                style={{ fontSize: '16px' }}
              />
            </Badge>

            <Dropdown 
              menu={{ items: userMenuItems }} 
              trigger={['click']}
              placement="bottomRight"
            >
              <Space style={{ cursor: 'pointer', padding: '8px' }}>
                <Avatar 
                  style={{ 
                    backgroundColor: user ? RoleColors[user.role] : '#1890ff' 
                  }}
                  icon={<UserOutlined />}
                />
                <div style={{ textAlign: 'right' }}>
                  <div style={{ 
                    fontSize: '14px', 
                    fontWeight: 500,
                    color: '#1f1f1f'
                  }}>
                    {user?.full_name || 'User'}
                  </div>
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#666',
                    lineHeight: 1
                  }}>
                    {user ? RoleLabels[user.role] : 'Loading...'}
                  </div>
                </div>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content style={{ 
          padding: '24px',
          background: '#f5f5f5',
          overflow: 'auto'
        }}>
          <div style={{ 
            background: '#fff',
            borderRadius: '8px',
            minHeight: 'calc(100vh - 112px)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
          }}>
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};