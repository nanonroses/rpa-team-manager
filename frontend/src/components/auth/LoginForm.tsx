import React, { useState } from 'react';
import { Form, Input, Button, Alert, Card, Typography, Space, Divider } from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/store/authStore';
import { LoginCredentials } from '@/types/auth';

const { Title, Text } = Typography;

interface LoginFormProps {
  onSuccess?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  const [form] = Form.useForm();
  const { login, isLoading, error, clearError } = useAuthStore();
  const [showDemoCredentials, setShowDemoCredentials] = useState(false);

  const handleSubmit = async (values: LoginCredentials) => {
    try {
      clearError();
      await login(values);
      onSuccess?.();
    } catch (error) {
      // Error is handled by the store
    }
  };

  const demoUsers = [
    { email: 'admin@rpa.com', role: 'Team Lead', description: 'Full access to all features' },
    { email: 'dev1@rpa.com', role: 'RPA Developer 1', description: 'Task management and time tracking' },
    { email: 'ops1@rpa.com', role: 'RPA Operations', description: 'Project monitoring and coordination' }
  ];

  const fillDemoCredentials = (email: string) => {
    const password = email === 'admin@rpa.com' ? 'admin123' : 
                    email === 'dev1@rpa.com' ? 'dev123' : 'ops123';
    form.setFieldsValue({ email, password });
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <Card
        style={{ 
          width: '100%', 
          maxWidth: 400,
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
          borderRadius: '12px'
        }}
        bodyStyle={{ padding: '40px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ 
            fontSize: '48px', 
            marginBottom: '16px',
            background: 'linear-gradient(45deg, #1890ff, #52c41a)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            🤖
          </div>
          <Title level={2} style={{ margin: 0, color: '#1f1f1f' }}>
            RPA Team Manager
          </Title>
          <Text type="secondary">
            Team collaboration for RPA projects
          </Text>
        </div>

        {error && (
          <Alert
            message="Login Failed"
            description={typeof error === 'string' ? error : error?.message || 'Unknown error occurred'}
            type="error"
            showIcon
            closable
            onClose={clearError}
            style={{ marginBottom: '24px' }}
          />
        )}

        <Form
          form={form}
          onFinish={handleSubmit}
          layout="vertical"
          size="large"
          autoComplete="off"
        >
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Please enter your email' },
              { type: 'email', message: 'Please enter a valid email' }
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="Enter your email"
              autoComplete="email"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[
              { required: true, message: 'Please enter your password' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: '16px' }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={isLoading}
              block
              icon={<LoginOutlined />}
              style={{ 
                height: '48px',
                fontSize: '16px',
                borderRadius: '8px'
              }}
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </Button>
          </Form.Item>
        </Form>

        <Divider>Demo Users</Divider>

        <div style={{ marginBottom: '16px' }}>
          <Button
            type="link"
            size="small"
            onClick={() => setShowDemoCredentials(!showDemoCredentials)}
            style={{ padding: 0 }}
          >
            {showDemoCredentials ? 'Hide' : 'Show'} demo credentials
          </Button>
        </div>

        {showDemoCredentials && (
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            {demoUsers.map((user, index) => (
              <Card
                key={index}
                size="small"
                style={{ 
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  border: '1px solid #f0f0f0'
                }}
                bodyStyle={{ padding: '12px' }}
                hoverable
                onClick={() => fillDemoCredentials(user.email)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text strong style={{ fontSize: '12px' }}>{user.email}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: '11px' }}>
                      {user.role} - {user.description}
                    </Text>
                  </div>
                  <Button size="small" type="text">
                    Use
                  </Button>
                </div>
              </Card>
            ))}
            <Text 
              type="secondary" 
              style={{ 
                fontSize: '11px', 
                textAlign: 'center', 
                display: 'block',
                marginTop: '8px'
              }}
            >
              Passwords: admin123, dev123, ops123
            </Text>
          </Space>
        )}

        <div style={{ 
          textAlign: 'center', 
          marginTop: '24px',
          paddingTop: '16px',
          borderTop: '1px solid #f0f0f0'
        }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            Optimized for 5-person RPA teams
          </Text>
        </div>
      </Card>
    </div>
  );
};