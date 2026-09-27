import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Typography,
  Space,
  Alert,
  Modal,
  message,
  Descriptions,
  Avatar,
  Row,
  Col,
  Tag
} from 'antd';
import {
  UserOutlined,
  EditOutlined,
  LockOutlined,
  MailOutlined,
  SaveOutlined,
  EyeInvisibleOutlined,
  EyeTwoTone,
  IdcardOutlined
} from '@ant-design/icons';
import { useAuthStore } from '@/store/authStore';
import { apiService } from '@/services/api';
import { getRoleColor } from '@/utils';

const { Title, Text } = Typography;

interface ChangePasswordForm {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface UpdateProfileForm {
  full_name: string;
  email: string;
}

export const ProfilePage: React.FC = () => {
  const { user, getCurrentUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [editProfileModalVisible, setEditProfileModalVisible] = useState(false);
  
  const [passwordForm] = Form.useForm<ChangePasswordForm>();
  const [profileForm] = Form.useForm<UpdateProfileForm>();

  useEffect(() => {
    if (user) {
      profileForm.setFieldsValue({
        full_name: user.full_name,
        email: user.email
      });
    }
  }, [user, profileForm]);

  const handleChangePassword = async (values: ChangePasswordForm) => {
    try {
      setLoading(true);
      await apiService.changePassword(values.oldPassword, values.newPassword);
      message.success("Contraseña actualizada");
      setPasswordModalVisible(false);
      passwordForm.resetFields();
    } catch (error: any) {
      message.error(error.response?.data?.error || "No se pudo cambiar la contraseña");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (values: UpdateProfileForm) => {
    try {
      setLoading(true);
      await apiService.updateProfile(values);
      await getCurrentUser();
      message.success("Perfil actualizado");
      setEditProfileModalVisible(false);
    } catch (error: any) {
      message.error(error.response?.data?.error || "No se pudo actualizar el perfil");
    } finally {
      setLoading(false);
    }
  };


  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'team_lead': return "Líder de equipo";
      case 'rpa_developer': return "Desarrollador RPA";
      case 'rpa_operations': return "Operaciones RPA";
      case 'it_support': return "Soporte TI";
      default: return role;
    }
  };

  if (!user) {
    return (
      <div style={{ padding: '24px' }}>
        <Alert message="Usuario no encontrado" type="error" />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <Title level={2}>
        <UserOutlined style={{ marginRight: '8px' }} />
        
        Mi perfil
      </Title>

      {/* Profile Info Card */}
      <Card style={{ marginBottom: '24px' }}>
        <Row gutter={[24, 24]} align="middle">
          <Col>
            <Avatar size={80} icon={<UserOutlined />} style={{ backgroundColor: 'var(--color-info)' }} />
          </Col>
          <Col flex={1}>
            <Space direction="vertical" size="small">
              <Title level={3} style={{ margin: 0 }}>{user.full_name}</Title>
              <Tag color={getRoleColor(user.role)} style={{ fontSize: '14px' }}>
                {getRoleLabel(user.role)}
              </Tag>
              <Text type="secondary" style={{ fontSize: '16px' }}>
                <MailOutlined style={{ marginRight: '8px' }} />
                {user.email}
              </Text>
            </Space>
          </Col>
          <Col>
            <Button 
              type="primary" 
              icon={<EditOutlined />}
              onClick={() => setEditProfileModalVisible(true)}
            >
              
              Editar perfil
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Profile Details */}
      <Card title="Datos del perfil" style={{ marginBottom: '24px' }}>
        <Descriptions column={1} bordered>
          <Descriptions.Item label="Nombre completo">
            <Text strong>{user.full_name}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Correo electrónico">
            <Text>{user.email}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Rol">
            <Tag color={getRoleColor(user.role)}>
              {getRoleLabel(user.role)}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="ID del usuario">
            <Text type="secondary">#{user.id}</Text>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Security Section */}
      <Card title="Seguridad" extra={
        <Button 
          icon={<LockOutlined />}
          onClick={() => setPasswordModalVisible(true)}
        >
          
          Cambiar contraseña
        </Button>
      }>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>Protege tu cuenta con una contraseña segura.</Text>
          <Text type="secondary">
            
            Último cambio de contraseña: sin información
          </Text>
        </Space>
      </Card>

      {/* Change Password Modal */}
      <Modal
        title="Cambiar contraseña"
        open={passwordModalVisible}
        onCancel={() => {
          setPasswordModalVisible(false);
          passwordForm.resetFields();
        }}
        footer={null}
        width={400}
      >
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handleChangePassword}
        >
          <Form.Item
            name="oldPassword"
            label="Contraseña actual"
            rules={[
              { required: true, message: "Ingresa tu contraseña actual" }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Ingresa la contraseña actual"
              iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
            />
          </Form.Item>

          <Form.Item
            name="newPassword"
            label="Nueva contraseña"
            rules={[
              { required: true, message: "Ingresa una nueva contraseña" },
              { min: 6, message: "La contraseña debe tener al menos 6 caracteres" }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Ingresa la nueva contraseña"
              iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="Confirmar nueva contraseña"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: "Confirma tu nueva contraseña" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("Las contraseñas no coinciden"));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Confirma la nueva contraseña"
              iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => {
                setPasswordModalVisible(false);
                passwordForm.resetFields();
              }}>
                
                Cancelar
              </Button>
              <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />}>
                
                Cambiar contraseña
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal
        title="Editar perfil"
        open={editProfileModalVisible}
        onCancel={() => {
          setEditProfileModalVisible(false);
          profileForm.resetFields();
        }}
        footer={null}
        width={400}
      >
        <Form
          form={profileForm}
          layout="vertical"
          onFinish={handleUpdateProfile}
        >
          <Form.Item
            name="full_name"
            label="Nombre completo"
            rules={[
              { required: true, message: "Ingresa tu nombre completo" }
            ]}
          >
            <Input
              prefix={<IdcardOutlined />}
              placeholder="Ingresa tu nombre completo"
            />
          </Form.Item>

          <Form.Item
            name="email"
            label="Correo electrónico"
            rules={[
              { required: true, message: "Ingresa tu correo electrónico" },
              { type: 'email', message: "Ingresa un correo electrónico válido" }
            ]}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder="Ingresa tu correo electrónico"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => {
                setEditProfileModalVisible(false);
                profileForm.resetFields();
              }}>
                
                Cancelar
              </Button>
              <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />}>
                
                Actualizar perfil
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProfilePage;