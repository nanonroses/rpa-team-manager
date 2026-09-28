import React, { useState } from 'react';
import { Form, Input, Button, Alert, Card, Typography, Space, Divider } from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/store/authStore';
import { LoginCredentials } from '@/types/auth';
import { ThemeSelector, PaletteSelector } from '@/components/common/ThemeProvider';

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
    } catch {
      // Error is handled by the store
    }
  };

  const demoUsers = [
    { email: 'admin@rpa.com', role: 'Líder de equipo', description: 'Acceso completo a todas las funciones' },
    { email: 'dev1@rpa.com', role: 'Desarrollador RPA 1', description: 'Gestión de tareas y registro de tiempo' },
    { email: 'ops1@rpa.com', role: 'Operaciones RPA', description: 'Seguimiento y coordinación de proyectos' }
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
      background: 'var(--canvas)',
      padding: '24px',
      position: 'relative'
    }}>
      <div className="login-theme-selector" style={{ display: 'flex', gap: '8px' }}>
        <PaletteSelector />
        <ThemeSelector />
      </div>
      
      <Card
        style={{
          width: '100%',
          maxWidth: 420,
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--elevation-2)',
          background: 'var(--surface)'
        }}
        styles={{ body: { padding: '36px 32px' } }}
      >
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          {/* Professional Engineering Brand Mark */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 44,
            height: 44,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #171717 0%, #0A0A0A 100%)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#FFFFFF',
            fontSize: 20,
            marginBottom: 14,
            boxShadow: 'var(--elevation-1)'
          }}>
            <SafetyCertificateOutlined style={{ color: 'var(--color-primary)' }} />
          </div>

          <Title level={3} style={{ margin: '0 0 4px', fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '-0.025em' }}>
            RPA Team Manager
          </Title>
          <Text type="secondary" style={{ fontSize: '13px' }}>
            Plataforma de operaciones y gestión de proyectos
          </Text>
        </div>

        {error && (
          <Alert
            message="No se pudo iniciar sesión"
            description={error || 'Ocurrió un error desconocido'}
            type="error"
            showIcon
            closable
            onClose={clearError}
            style={{ marginBottom: '20px', borderRadius: 'var(--radius-md)' }}
          />
        )}

        <Form
          form={form}
          onFinish={handleSubmit}
          layout="vertical"
          size="middle"
          autoComplete="off"
        >
          <Form.Item
            name="email"
            label={<span style={{ fontSize: '13px', fontWeight: 500 }}>Correo electrónico</span>}
            rules={[
              { required: true, message: 'Ingresa tu correo electrónico' },
              { type: 'email', message: 'Ingresa un correo electrónico válido' }
            ]}
          >
            <Input
              prefix={<UserOutlined style={{ color: 'var(--color-text-muted)' }} />}
              placeholder="tu.correo@empresa.com"
              autoComplete="email"
              style={{ height: 40 }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={<span style={{ fontSize: '13px', fontWeight: 500 }}>Contraseña</span>}
            rules={[
              { required: true, message: 'Ingresa tu contraseña' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: 'var(--color-text-muted)' }} />}
              placeholder="••••••••"
              autoComplete="current-password"
              style={{ height: 40 }}
            />
          </Form.Item>

          <Form.Item style={{ marginTop: '20px', marginBottom: '16px' }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={isLoading}
              block
              icon={<LoginOutlined />}
              style={{ 
                height: '42px',
                fontSize: '14px',
                fontWeight: 600,
                borderRadius: 'var(--radius-md)'
              }}
            >
              {isLoading ? 'Iniciando sesión…' : 'Acceder al espacio'}
            </Button>
          </Form.Item>
        </Form>

        <Divider style={{ margin: '20px 0 16px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
          ACCESO DE DEMOSTRACIÓN
        </Divider>

        <div style={{ textAlign: 'center', marginBottom: '12px' }}>
          <Button
            type="link"
            size="small"
            onClick={() => setShowDemoCredentials(!showDemoCredentials)}
            style={{ padding: 0, fontSize: '12px' }}
          >
            {showDemoCredentials ? 'Ocultar credenciales' : 'Ver cuentas preconfiguradas'}
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
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-surface-raised)'
                }}
                styles={{ body: { padding: '10px 12px' } }}
                hoverable
                onClick={() => fillDemoCredentials(user.email)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text strong style={{ fontSize: '12px' }}>{user.email}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: '11px' }}>
                      {user.role} · {user.description}
                    </Text>
                  </div>
                  <Button size="small" type="default" style={{ fontSize: '11px', height: 26, padding: '0 8px' }}>
                    Usar
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
                marginTop: '6px'
              }}
            >
              Claves de demo: <code>admin123</code>, <code>dev123</code>, <code>ops123</code>
            </Text>
          </Space>
        )}

        <div style={{ 
          textAlign: 'center', 
          marginTop: '20px',
          paddingTop: '16px',
          borderTop: '1px solid var(--line)'
        }}>
          <Text type="secondary" style={{ fontSize: '11px' }}>
            RPA Team Manager · Edición Enterprise
          </Text>
        </div>
      </Card>
    </div>
  );
};
