import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Row, 
  Col, 
  Button, 
  Input, 
  Select, 
  Space, 
  Typography, 
  Empty, 
  Spin, 
  Alert,
  Modal,
  message,
  Card,
  Statistic
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  FilterOutlined,
  ProjectOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { ProjectROICard } from '@/components/projects/ProjectROICard';
import { CreateProjectModal } from '@/components/projects/CreateProjectModal';
import { useProjectStore } from '@/store/projectStore';
import { useAuthStore } from '@/store/authStore';
import { Project } from '@/types/project';

const { Title } = Typography;
const { Search } = Input;

export const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const { 
    projects, 
    isLoading, 
    error, 
    fetchProjects, 
    deleteProject,
    clearError 
  } = useProjectStore();
  
  const { user, hasPermission } = useAuthStore();

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const canCreateProject = user?.role === 'team_lead' || 
    hasPermission('projects:create') || 
    hasPermission('projects:*');

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || project.priority === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const handleCreateProject = () => {
    setEditingProject(null);
    setCreateModalVisible(true);
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setCreateModalVisible(true);
  };

  const handleDeleteProject = (project: Project) => {
    Modal.confirm({
      title: 'Delete Project',
      icon: <ExclamationCircleOutlined />,
      content: `Are you sure you want to delete "${project.name}"? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await deleteProject(project.id);
          message.success('Project deleted successfully');
        } catch (error) {
          message.error('Failed to delete project');
        }
      }
    });
  };

  const handleViewProject = (project: Project) => {
    navigate(`/projects/${project.id}`);
  };

  const getProjectStats = () => {
    const total = projects.length;
    const active = projects.filter(p => p.status === 'active').length;
    const completed = projects.filter(p => p.status === 'completed').length;
    const overdue = projects.filter(p => {
      if (!p.end_date || p.status === 'completed') return false;
      return new Date(p.end_date) < new Date();
    }).length;

    return { total, active, completed, overdue };
  };

  const stats = getProjectStats();

  const statusOptions = [
    { label: 'All Status', value: 'all' },
    { label: 'Planning', value: 'planning' },
    { label: 'Active', value: 'active' },
    { label: 'On Hold', value: 'on_hold' },
    { label: 'Completed', value: 'completed' },
    { label: 'Cancelled', value: 'cancelled' }
  ];

  const priorityOptions = [
    { label: 'All Priorities', value: 'all' },
    { label: 'Critical', value: 'critical' },
    { label: 'High', value: 'high' },
    { label: 'Medium', value: 'medium' },
    { label: 'Low', value: 'low' }
  ];

  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <Alert
          message="Failed to load projects"
          description={error}
          type="error"
          showIcon
          action={
            <Space>
              <Button size="small" onClick={clearError}>
                Dismiss
              </Button>
              <Button type="primary" size="small" onClick={fetchProjects}>
                Retry
              </Button>
            </Space>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <Title level={2} style={{ margin: 0 }}>
            <ProjectOutlined style={{ marginRight: '8px' }} />
            Projects
          </Title>
          {canCreateProject && (
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={handleCreateProject}
            >
              New Project
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        <Row gutter={16} style={{ marginBottom: '24px' }}>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic 
                title="Total Projects" 
                value={stats.total} 
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic 
                title="Active" 
                value={stats.active} 
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic 
                title="Completed" 
                value={stats.completed} 
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic 
                title="Overdue" 
                value={stats.overdue} 
                valueStyle={{ color: stats.overdue > 0 ? '#ff4d4f' : '#52c41a' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Filters */}
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Search
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              allowClear
              prefix={<SearchOutlined />}
            />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select
              style={{ width: '100%' }}
              placeholder="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusOptions}
            />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select
              style={{ width: '100%' }}
              placeholder="Priority"
              value={priorityFilter}
              onChange={setPriorityFilter}
              options={priorityOptions}
            />
          </Col>
        </Row>
      </div>

      {/* Projects Grid */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '64px 0' }}>
          <Spin size="large" tip="Loading projects..." />
        </div>
      ) : filteredProjects.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
              ? 'No projects match your filters'
              : 'No projects found'
          }
          style={{ padding: '64px 0' }}
        >
          {canCreateProject && !searchTerm && statusFilter === 'all' && priorityFilter === 'all' && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateProject}>
              Create Your First Project
            </Button>
          )}
        </Empty>
      ) : (
        <Row gutter={[16, 16]}>
          {filteredProjects.map(project => (
            <Col xs={24} sm={24} lg={12} xl={12} key={project.id}>
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <ProjectCard
                  project={project}
                  onEdit={handleEditProject}
                  onDelete={handleDeleteProject}
                  onView={handleViewProject}
                  onClick={handleViewProject}
                />
                {user?.role === 'team_lead' && (
                  <ProjectROICard
                    projectId={project.id}
                    projectName={project.name}
                    assignedUserId={project.assigned_to}
                  />
                )}
              </Space>
            </Col>
          ))}
        </Row>
      )}

      {/* Create/Edit Project Modal */}
      <CreateProjectModal
        visible={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          setEditingProject(null);
        }}
        onSuccess={(updatedProject) => {
          fetchProjects(); // Refresh the list
          // Update the editing project with fresh data
          if (editingProject && updatedProject) {
            setEditingProject(updatedProject);
          }
        }}
        editProject={editingProject}
      />
    </div>
  );
};