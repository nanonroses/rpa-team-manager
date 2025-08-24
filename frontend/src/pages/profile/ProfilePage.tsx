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
  Divider,
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
  const { user, setUser } = useAuthStore();
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
      message.success('Password changed successfully');
      setPasswordModalVisible(false);
      passwordForm.resetFields();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (values: UpdateProfileForm) => {
    try {
      setLoading(true);
      // For now, we'll just show a message since the endpoint doesn't exist yet
      message.info('Profile update feature will be available soon');
      setEditProfileModalVisible(false);
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };


  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'team_lead': return 'Team Lead';
      case 'rpa_developer': return 'RPA Developer';
      case 'rpa_operations': return 'RPA Operations';
      case 'it_support': return 'IT Support';
      default: return role;
    }
  };

  if (!user) {
    return (
      <div style={{ padding: '24px' }}>
        <Alert message="User not found" type="error" />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <Title level={2}>
        <UserOutlined style={{ marginRight: '8px' }} />
        My Profile
      </Title>

      {/* Profile Info Card */}
      <Card style={{ marginBottom: '24px' }}>
        <Row gutter={[24, 24]} align="middle">
          <Col>
            <Avatar size={80} icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
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
              Edit Profile
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Profile Details */}
      <Card title="Profile Details" style={{ marginBottom: '24px' }}>
        <Descriptions column={1} bordered>
          <Descriptions.Item label="Full Name">
            <Text strong>{user.full_name}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Email">
            <Text>{user.email}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Role">
            <Tag color={getRoleColor(user.role)}>
              {getRoleLabel(user.role)}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="User ID">
            <Text type="secondary">#{user.id}</Text>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Security Section */}
      <Card title="Security" extra={
        <Button 
          icon={<LockOutlined />}
          onClick={() => setPasswordModalVisible(true)}
        >
          Change Password
        </Button>
      }>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>Keep your account secure by using a strong password.</Text>
          <Text type="secondary">
            Last password change: Not available
          </Text>
        </Space>
      </Card>

      {/* Change Password Modal */}
      <Modal
        title="Change Password"
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
            label="Current Password"
            rules={[
              { required: true, message: 'Please enter your current password' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Enter current password"
              iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
            />
          </Form.Item>

          <Form.Item
            name="newPassword"
            label="New Password"
            rules={[
              { required: true, message: 'Please enter a new password' },
              { min: 6, message: 'Password must be at least 6 characters' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Enter new password"
              iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="Confirm New Password"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: 'Please confirm your new password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Passwords do not match'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Confirm new password"
              iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => {
                setPasswordModalVisible(false);
                passwordForm.resetFields();
              }}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />}>
                Change Password
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal
        title="Edit Profile"
        open={editProfileModalVisible}
        onCancel={() => {
          setEditProfileModalVisible(false);
          profileForm.resetFields();
        }}
        footer={null}
        width={400}
      >
        <Alert
          message="Coming Soon"
          description="Profile editing functionality will be available in a future update."
          type="info"
          style={{ marginBottom: '16px' }}
        />
        
        <Form
          form={profileForm}
          layout="vertical"
          onFinish={handleUpdateProfile}
        >
          <Form.Item
            name="full_name"
            label="Full Name"
            rules={[
              { required: true, message: 'Please enter your full name' }
            ]}
          >
            <Input
              prefix={<IdcardOutlined />}
              placeholder="Enter your full name"
              disabled
            />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Please enter your email' },
              { type: 'email', message: 'Please enter a valid email' }
            ]}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder="Enter your email"
              disabled
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => {
                setEditProfileModalVisible(false);
                profileForm.resetFields();
              }}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />} disabled>
                Update Profile
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProfilePage;