import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  message,
  Popconfirm,
  Typography,
  Card,
  Row,
  Col,
  Statistic,
  Alert
} from 'antd';
import {
  UserOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  LockOutlined,
  TeamOutlined,
  EyeInvisibleOutlined,
  EyeTwoTone,
  IdcardOutlined,
  MailOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useAuthStore } from '@/store/authStore';
import { apiService } from '@/services/api';
import { getRoleColor } from '@/utils';

const { Title, Text } = Typography;

interface User {
  id: number;
  full_name: string;
  email: string;
  role: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

interface CreateUserForm {
  full_name: string;
  email: string;
  role: string;
  password: string;
  confirmPassword: string;
}

interface EditUserForm {
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
}

interface ResetPasswordForm {
  newPassword: string;
  confirmPassword: string;
}

export const TeamManagementPage: React.FC = () => {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [resetPasswordModalVisible, setResetPasswordModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [createForm] = Form.useForm<CreateUserForm>();
  const [editForm] = Form.useForm<EditUserForm>();
  const [resetPasswordForm] = Form.useForm<ResetPasswordForm>();

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const usersData = await apiService.getUsers();
      setUsers(usersData);
    } catch (error: any) {
      message.error('No se pudo cargar el equipo');
    } finally {
      setLoading(false);
    }
  };


  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'team_lead': return 'Líder de equipo';
      case 'rpa_developer': return 'Desarrollador RPA';
      case 'rpa_operations': return 'Operaciones RPA';
      case 'it_support': return 'Soporte TI';
      default: return role;
    }
  };

  const handleCreateUser = async (values: CreateUserForm) => {
    try {
      setLoading(true);
      await apiService.createUser({
        full_name: values.full_name,
        email: values.email,
        role: values.role,
        password: values.password
      });
      message.success('Usuario creado correctamente');
      setCreateModalVisible(false);
      createForm.resetFields();
      loadUsers();
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || error.response?.data?.error || 'No se pudo crear el usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (values: EditUserForm) => {
    if (!selectedUser) return;

    try {
      setLoading(true);
      await apiService.updateUser(selectedUser.id, {
        full_name: values.full_name,
        email: values.email,
        role: values.role,
        is_active: values.is_active
      });
      message.success('Usuario actualizado correctamente');
      setEditModalVisible(false);
      setSelectedUser(null);
      editForm.resetFields();
      loadUsers();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'No se pudo actualizar el usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    try {
      setLoading(true);
      await apiService.deleteUser(userId);
      message.success('Usuario eliminado correctamente');
      loadUsers();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'No se pudo eliminar el usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (values: ResetPasswordForm) => {
    if (!selectedUser) return;

    try {
      setLoading(true);
      await apiService.resetUserPassword(selectedUser.id, values.newPassword);
      message.success('Contraseña restablecida correctamente');
      setResetPasswordModalVisible(false);
      setSelectedUser(null);
      resetPasswordForm.resetFields();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'No se pudo restablecer la contraseña');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    editForm.setFieldsValue({
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      is_active: user.is_active
    });
    setEditModalVisible(true);
  };

  const openResetPasswordModal = (user: User) => {
    setSelectedUser(user);
    setResetPasswordModalVisible(true);
  };

  const columns: ColumnsType<User> = [
    {
      title: 'Nombre',
      dataIndex: 'full_name',
      key: 'full_name',
      render: (text, record) => (
        <Space>
          <UserOutlined style={{ color: 'var(--color-info)' }} />
          <div>
            <div style={{ fontWeight: 500 }}>{text}</div>
            <Text type="secondary" style={{ fontSize: '12px' }}>ID: {record.id}</Text>
          </div>
        </Space>
      )
    },
    {
      title: 'Correo',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Rol',
      dataIndex: 'role',
      key: 'role',
      render: (role) => (
        <Tag color={getRoleColor(role)}>{getRoleLabel(role)}</Tag>
      )
    },
    {
      title: 'Estado',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'Activo' : 'Inactivo'}
        </Tag>
      )
    },
    {
      title: 'Creado',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date?: string | null) => date && !Number.isNaN(Date.parse(date))
        ? new Date(date).toLocaleDateString('es-CL')
        : 'Sin fecha'
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          >
            Editar
          </Button>
          <Button
            type="text"
            size="small"
            icon={<LockOutlined />}
            onClick={() => openResetPasswordModal(record)}
          >
            Restablecer clave
          </Button>
          {record.id !== currentUser?.id && (
            <Popconfirm
              title="Eliminar usuario"
              description={`¿Quieres eliminar a ${record.full_name}?`}
              onConfirm={() => handleDeleteUser(record.id)}
              okText="Eliminar"
              cancelText="Cancelar"
              okType="danger"
            >
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
              >
                Eliminar
              </Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  const getUserStats = () => {
    const total = users.length;
    const active = users.filter(u => u.is_active).length;
    const teamLeads = users.filter(u => u.role === 'team_lead').length;
    const developers = users.filter(u => u.role === 'rpa_developer').length;

    return { total, active, teamLeads, developers };
  };

  const stats = getUserStats();

  return (
    <div className="page-container">
      <div style={{ marginBottom: '24px' }}>
        <Title level={2}>
          <TeamOutlined style={{ marginRight: '8px' }} />
          Administración del equipo
        </Title>
        <Text type="secondary">
          Gestiona usuarios, roles y acceso a la plataforma.
        </Text>
      </div>

      {/* Stats Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Usuarios" value={stats.total} prefix={<UserOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic 
              title="Usuarios activos"
              value={stats.active} 
              valueStyle={{ color: 'var(--color-success)' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic 
              title="Líderes de equipo"
              value={stats.teamLeads}
              valueStyle={{ color: 'var(--color-warning)' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic 
              title="Desarrolladores"
              value={stats.developers}
              valueStyle={{ color: 'var(--color-info)' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Users Table */}
      <Card 
        title="Usuarios del equipo"
        extra={
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={() => setCreateModalVisible(true)}
          >
            Crear usuario
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `${total} usuarios`
          }}
        />
      </Card>

      {/* Create User Modal */}
      <Modal
        title="Crear usuario"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
        }}
        footer={null}
        width={500}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreateUser}
        >
          <Form.Item
            name="full_name"
            label="Nombre completo"
            rules={[{ required: true, message: "Ingresa el nombre completo" }]}
          >
            <Input prefix={<IdcardOutlined />} aria-label="Nombre completo" placeholder="Ingresa el nombre completo" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Correo electrónico"
            rules={[
              { required: true, message: "Ingresa el correo electrónico" },
              { type: 'email', message: "Ingresa un correo electrónico válido" }
            ]}
          >
            <Input prefix={<MailOutlined />} aria-label="Correo electrónico" placeholder="Ingresa el correo electrónico" />
          </Form.Item>

          <Form.Item
            name="role"
            label="Rol"
            rules={[{ required: true, message: "Selecciona un rol" }]}
          >
            <Select aria-label="Rol del usuario" placeholder="Selecciona un rol">
              <Select.Option value="rpa_developer">Desarrollador RPA</Select.Option>
              <Select.Option value="rpa_operations">Operaciones RPA</Select.Option>
              <Select.Option value="it_support">Soporte TI</Select.Option>
              <Select.Option value="team_lead">Líder de equipo</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="password"
            label="Contraseña"
            rules={[
              { required: true, message: 'Ingresa una contraseña' },
              { min: 8, message: 'Debe tener al menos 8 caracteres' },
              { pattern: /[A-Z]/, message: 'Incluye al menos una mayúscula' },
              { pattern: /[a-z]/, message: 'Incluye al menos una minúscula' },
              { pattern: /\d/, message: 'Incluye al menos un número' },
              { pattern: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/, message: 'Incluye al menos un carácter especial' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Ingresa la contraseña"
              iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="Confirmar contraseña"
            dependencies={['password']}
            rules={[
              { required: true, message: 'Confirma la contraseña' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Las contraseñas no coinciden'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Confirma la contraseña"
              iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => {
                setCreateModalVisible(false);
                createForm.resetFields();
              }}>
                Cancelar
              </Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                Crear usuario
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        title="Editar usuario"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setSelectedUser(null);
          editForm.resetFields();
        }}
        footer={null}
        width={500}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleUpdateUser}
        >
          <Form.Item
            name="full_name"
            label="Nombre completo"
            rules={[{ required: true, message: 'Ingresa el nombre completo' }]}
          >
            <Input prefix={<IdcardOutlined />} placeholder="Ingresa el nombre completo" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Correo electrónico"
            rules={[
              { required: true, message: 'Ingresa el correo electrónico' },
              { type: 'email', message: 'Ingresa un correo válido' }
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="Ingresa el correo electrónico" />
          </Form.Item>

          <Form.Item
            name="role"
            label="Rol"
            rules={[{ required: true, message: 'Selecciona un rol' }]}
          >
            <Select placeholder="Selecciona un rol">
              <Select.Option value="rpa_developer">Desarrollador RPA</Select.Option>
              <Select.Option value="rpa_operations">Operaciones RPA</Select.Option>
              <Select.Option value="it_support">Soporte TI</Select.Option>
              <Select.Option value="team_lead">Líder de equipo</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="is_active"
            label="Estado de la cuenta"
            valuePropName="checked"
          >
            <Switch 
              checkedChildren="Activa"
              unCheckedChildren="Inactiva"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => {
                setEditModalVisible(false);
                setSelectedUser(null);
                editForm.resetFields();
              }}>
                Cancelar
              </Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                Guardar cambios
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        title="Restablecer contraseña"
        open={resetPasswordModalVisible}
        onCancel={() => {
          setResetPasswordModalVisible(false);
          setSelectedUser(null);
          resetPasswordForm.resetFields();
        }}
        footer={null}
        width={400}
      >
        {selectedUser && (
          <div style={{ marginBottom: '16px' }}>
            <Alert
              message={`Se cambiará la contraseña de ${selectedUser.full_name}`}
              type="info"
              showIcon
            />
          </div>
        )}
        
        <Form
          form={resetPasswordForm}
          layout="vertical"
          onFinish={handleResetPassword}
        >
          <Form.Item
            name="newPassword"
            label="Nueva contraseña"
            rules={[
              { required: true, message: 'Ingresa la nueva contraseña' },
              { min: 6, message: 'Debe tener al menos 6 caracteres' }
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
              { required: true, message: 'Confirma la nueva contraseña' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Las contraseñas no coinciden'));
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
                setResetPasswordModalVisible(false);
                setSelectedUser(null);
                resetPasswordForm.resetFields();
              }}>
                Cancelar
              </Button>
              <Button type="primary" htmlType="submit" loading={loading} danger>
                Restablecer contraseña
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TeamManagementPage;
