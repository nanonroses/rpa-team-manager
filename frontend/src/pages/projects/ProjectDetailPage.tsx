import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Row,
  Col,
  Button,
  Typography,
  Card,
  Tag,
  Progress,
  Descriptions,
  Space,
  Statistic,
  List,
  Avatar,
  Empty,
  Spin,
  Alert,
  Breadcrumb,
  Divider,
  Tabs,
  Modal,
  message
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ProjectOutlined,
  HomeOutlined,
  FileOutlined,
  FolderOutlined,
  PictureOutlined,
  FundOutlined
} from '@ant-design/icons';
import { ProjectROICard } from '@/components/projects/ProjectROICard';
import { ProjectPMOView } from '@/components/projects/ProjectPMOView';
import { CreateProjectModal } from '@/components/projects/CreateProjectModal';
import { FileManager, EvidenceGallery } from '@/components/files';
import { useProjectStore } from '@/store/projectStore';
import { useAuthStore } from '@/store/authStore';
import { Project, ProjectStatusLabels, PriorityLabels } from '@/types/project';
import { apiService } from '@/services/api';
import { getProjectStatusColor, getPriorityColor } from '@/utils';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  
  const { getProject } = useProjectStore();
  const { user } = useAuthStore();

  useEffect(() => {
    if (id) {
      loadProjectData();
    }
  }, [id]);

  const loadProjectData = async () => {
    try {
      setLoading(true);
      const projectData = await getProject(parseInt(id!));
      setProject(projectData);
      
      // Load real project tasks (latest 5)
      try {
        const projectTasks = await apiService.getProjectTasks(parseInt(id!), 5);
        setTasks(projectTasks);
      } catch (error) {
        console.error('Failed to load project tasks:', error);
        // Fallback to empty array if tasks can't be loaded
        setTasks([]);
      }
    } catch (error) {
      console.error('Failed to load project:', error);
    } finally {
      setLoading(false);
    }
  };


  const getTaskStatusColor = (status: string) => {
    const colors = {
      done: 'success',
      in_progress: 'processing',
      review: 'warning',
      testing: 'warning',
      todo: 'default',
      blocked: 'error'
    };
    return colors[status as keyof typeof colors] || 'default';
  };

  const handleTaskClick = (task: any) => {
    // Navigate to Tasks module with project filter
    navigate(`/tasks?project=${project?.id}`);
  };

  const handleViewAllTasks = () => {
    // Navigate to Tasks module with project filter
    navigate(`/tasks?project=${project?.id}`);
  };

  const handleEdit = () => {
    setEditModalVisible(true);
  };

  const handleEditSuccess = (updatedProject?: Project) => {
    setEditModalVisible(false);
    // Reload project data to show updated information
    loadProjectData();
  };

  const handleDelete = () => {
    Modal.confirm({
      title: 'Delete Project',
      icon: <ExclamationCircleOutlined />,
      content: `Are you sure you want to delete "${project?.name}"? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          const { deleteProject } = useProjectStore.getState();
          await deleteProject(project!.id);
          message.success('Project deleted successfully');
          navigate('/projects');
        } catch (error) {
          message.error('Failed to delete project');
        }
      }
    });
  };

  const handleBack = () => {
    navigate('/projects');
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>
          <Text>Loading project details...</Text>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ padding: '24px' }}>
        <Alert
          message="Project Not Found"
          description="The project you're looking for doesn't exist or you don't have permission to view it."
          type="error"
          showIcon
          action={
            <Button size="small" onClick={handleBack}>
              Back to Projects
            </Button>
          }
        />
      </div>
    );
  }

  const completedTasks = tasks.filter(t => t.status === 'done').length;
  const totalTasks = tasks.length;
  const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div style={{ padding: '24px' }}>
      {/* Breadcrumb */}
      <Breadcrumb style={{ marginBottom: '16px' }}>
        <Breadcrumb.Item>
          <HomeOutlined />
        </Breadcrumb.Item>
        <Breadcrumb.Item>
          <ProjectOutlined />
          <span>Projects</span>
        </Breadcrumb.Item>
        <Breadcrumb.Item>{project.name}</Breadcrumb.Item>
      </Breadcrumb>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <Space size="large">
            <Button 
              icon={<ArrowLeftOutlined />} 
              onClick={handleBack}
              type="text"
            />
            <Title level={2} style={{ margin: 0 }}>
              {project.name}
            </Title>
            <Tag color={getProjectStatusColor(project.status)} style={{ fontSize: '14px', padding: '4px 12px' }}>
              {ProjectStatusLabels[project.status as keyof typeof ProjectStatusLabels]}
            </Tag>
            <Tag color={getPriorityColor(project.priority)} style={{ fontSize: '14px', padding: '4px 12px' }}>
              {PriorityLabels[project.priority as keyof typeof PriorityLabels]} Priority
            </Tag>
          </Space>
          
          {user?.role === 'team_lead' && (
            <Space>
              <Button 
                type="primary" 
                icon={<EditOutlined />}
                onClick={handleEdit}
              >
                Edit Project
              </Button>
              <Button 
                danger
                icon={<DeleteOutlined />}
                onClick={handleDelete}
              >
                Delete
              </Button>
            </Space>
          )}
        </div>

        {project.description && (
          <Paragraph type="secondary" style={{ fontSize: '16px', marginBottom: 0 }}>
            {project.description}
          </Paragraph>
        )}
      </div>

      {/* Project Tabs */}
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          size="large"
          items={[
            {
              key: 'overview',
              label: (
                <span>
                  <ProjectOutlined />
                  Overview
                </span>
              ),
              children: (
                <Row gutter={[24, 24]}>
                  {/* Left Column - Project Info */}
                  <Col xs={24} lg={16}>
                    {/* Project Overview */}
                    <Card title="Project Overview" style={{ marginBottom: '24px' }}>
                      <Row gutter={16}>
                        <Col span={12}>
                          <Descriptions column={1} size="small">
                            <Descriptions.Item 
                              label={<><UserOutlined /> Assigned To</>}
                            >
                              <Space>
                                <Avatar size="small" icon={<UserOutlined />} />
                                {project.assigned_to_name || 'Unassigned'}
                              </Space>
                            </Descriptions.Item>
                            
                            <Descriptions.Item 
                              label={<><CalendarOutlined /> Start Date</>}
                            >
                              {project.start_date ? dayjs(project.start_date).format('MMM DD, YYYY') : 'Not set'}
                            </Descriptions.Item>
                            
                            <Descriptions.Item 
                              label={<><CalendarOutlined /> End Date</>}
                            >
                              {project.end_date ? dayjs(project.end_date).format('MMM DD, YYYY') : 'Not set'}
                            </Descriptions.Item>
                            
                            <Descriptions.Item 
                              label={<><DollarOutlined /> Budget</>}
                            >
                              {project.budget ? `$${project.budget.toLocaleString()}` : 'Not set'}
                            </Descriptions.Item>
                          </Descriptions>
                        </Col>
                        
                        <Col span={12}>
                          <div style={{ textAlign: 'center' }}>
                            <Text strong>Project Progress</Text>
                            <Progress
                              type="circle"
                              percent={progressPercentage}
                              format={percent => `${percent}%`}
                              size={120}
                              strokeColor="#52c41a"
                              style={{ marginTop: '16px' }}
                            />
                            <div style={{ marginTop: '8px' }}>
                              <Text type="secondary">
                                {completedTasks} of {totalTasks} tasks completed
                              </Text>
                            </div>
                          </div>
                        </Col>
                      </Row>
                    </Card>

                    {/* Tasks */}
                    <Card 
                      title="Recent Tasks"
                      extra={
                        <Button 
                          type="link" 
                          onClick={handleViewAllTasks}
                          icon={<ProjectOutlined />}
                        >
                          View All Tasks
                        </Button>
                      }
                      style={{ marginBottom: '24px' }}
                    >
                      {tasks.length > 0 ? (
                        <List
                          dataSource={tasks}
                          renderItem={task => (
                            <List.Item 
                              style={{ cursor: 'pointer' }}
                              onClick={() => handleTaskClick(task)}
                            >
                              <List.Item.Meta
                                avatar={
                                  <Avatar 
                                    size="small" 
                                    icon={task.status === 'done' ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
                                    style={{ 
                                      backgroundColor: task.status === 'done' ? '#52c41a' : '#1890ff' 
                                    }}
                                  />
                                }
                                title={
                                  <Space>
                                    <Text strong={task.status !== 'done'} delete={task.status === 'done'}>
                                      {task.title}
                                    </Text>
                                    <Tag color={getTaskStatusColor(task.status)} size="small">
                                      {task.status.replace('_', ' ')}
                                    </Tag>
                                  </Space>
                                }
                                description={
                                  <Space split={<span style={{ color: '#d9d9d9' }}>•</span>}>
                                    <Text type="secondary">{task.assignee_name || 'Unassigned'}</Text>
                                    {task.due_date && (
                                      <Text type="secondary">Due: {dayjs(task.due_date).format('MMM DD')}</Text>
                                    )}
                                    <Text type="secondary">Board: {task.board_name}</Text>
                                  </Space>
                                }
                              />
                            </List.Item>
                          )}
                        />
                      ) : (
                        <Empty 
                          description="No tasks found for this project"
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          style={{ padding: '40px 0' }}
                        >
                          <Button 
                            type="primary" 
                            onClick={handleViewAllTasks}
                            icon={<ProjectOutlined />}
                          >
                            Go to Tasks Module
                          </Button>
                        </Empty>
                      )}
                      {tasks.length > 0 && (
                        <div style={{ textAlign: 'center', marginTop: '16px' }}>
                          <Button 
                            type="primary" 
                            onClick={handleViewAllTasks}
                            icon={<ProjectOutlined />}
                          >
                            View Full Task Board
                          </Button>
                        </div>
                      )}
                    </Card>
                  </Col>

                  {/* Right Column - Stats & ROI */}
                  <Col xs={24} lg={8}>
                    {/* Project Stats */}
                    <Card title="Project Statistics" style={{ marginBottom: '24px' }}>
                      <Row gutter={[16, 16]}>
                        <Col span={12}>
                          <Statistic
                            title="Total Tasks"
                            value={totalTasks}
                            prefix={<ProjectOutlined />}
                            valueStyle={{ color: '#1890ff' }}
                          />
                        </Col>
                        <Col span={12}>
                          <Statistic
                            title="Completed"
                            value={completedTasks}
                            prefix={<CheckCircleOutlined />}
                            valueStyle={{ color: '#52c41a' }}
                          />
                        </Col>
                        <Col span={12}>
                          <Statistic
                            title="Hours Logged"
                            value={project.total_hours_logged || 0}
                            suffix="h"
                            prefix={<ClockCircleOutlined />}
                            valueStyle={{ color: '#fa8c16' }}
                          />
                        </Col>
                        <Col span={12}>
                          <Statistic
                            title="Progress"
                            value={progressPercentage}
                            suffix="%"
                            valueStyle={{ color: progressPercentage > 80 ? '#52c41a' : '#1890ff' }}
                          />
                        </Col>
                      </Row>
                    </Card>

                    {/* Financial Metrics (ROI) - Only for team_lead */}
                    {user?.role === 'team_lead' && (
                      <ProjectROICard
                        projectId={project.id}
                        projectName={project.name}
                        assignedUserId={project.assigned_to}
                      />
                    )}

                    {/* PMO Quick Actions */}
                    <Card title="PMO & Analytics" style={{ marginTop: '24px' }}>
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <Button 
                          type="primary" 
                          icon={<FundOutlined />}
                          onClick={() => navigate(`/pmo?project=${project.id}`)}
                          block
                        >
                          Open PMO Dashboard
                        </Button>
                        <Button 
                          icon={<ProjectOutlined />}
                          onClick={() => setActiveTab('pmo')}
                          block
                        >
                          View PMO Analytics Tab
                        </Button>
                        <Button 
                          icon={<CalendarOutlined />}
                          onClick={() => navigate(`/pmo/gantt/${project.id}`)}
                          block
                        >
                          View Gantt Timeline
                        </Button>
                      </Space>
                    </Card>

                    {/* Timeline Info */}
                    {(project.start_date && project.end_date) && (
                      <Card title="Timeline" style={{ marginTop: '24px' }}>
                        <Space direction="vertical" style={{ width: '100%' }}>
                          <div>
                            <Text strong>Duration:</Text>
                            <Text style={{ float: 'right' }}>
                              {dayjs(project.end_date).diff(dayjs(project.start_date), 'days')} days
                            </Text>
                          </div>
                          <div>
                            <Text strong>Time Remaining:</Text>
                            <Text style={{ float: 'right' }}>
                              {dayjs(project.end_date).diff(dayjs(), 'days')} days
                            </Text>
                          </div>
                          {dayjs().isAfter(dayjs(project.end_date)) && (
                            <Alert
                              message="Project Overdue"
                              type="error"
                              size="small"
                              showIcon
                            />
                          )}
                        </Space>
                      </Card>
                    )}
                  </Col>
                </Row>
              )
            },
            {
              key: 'files',
              label: (
                <span>
                  <FolderOutlined />
                  Files & Evidence
                </span>
              ),
              children: (
                <div style={{ padding: '8px 0' }}>
                  <FileManager
                    entity_type="project"
                    entity_id={project.id}
                    title={`Project Files - ${project.name}`}
                    showUploadTab={false}
                    association_type="evidence"
                    multiple={true}
                    maxFiles={20}
                  />
                </div>
              )
            },
            {
              key: 'evidence',
              label: (
                <span>
                  <PictureOutlined />
                  Evidence Gallery
                </span>
              ),
              children: (
                <div style={{ padding: '8px 0' }}>
                  <EvidenceGallery
                    entity_type="project"
                    entity_id={project.id}
                    entity_name={project.name}
                    title={`Evidence Gallery - ${project.name}`}
                    showUpload={true}
                    maxImages={100}
                  />
                </div>
              )
            },
            {
              key: 'pmo',
              label: (
                <span>
                  <FundOutlined />
                  PMO Analytics
                </span>
              ),
              children: (
                <ProjectPMOView
                  projectId={project.id}
                  projectName={project.name}
                  projectStatus={project.status}
                  startDate={project.start_date}
                  endDate={project.end_date}
                />
              )
            }
          ]}
        />
      </Card>

      {/* Edit Project Modal */}
      <CreateProjectModal
        visible={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onSuccess={handleEditSuccess}
        editProject={project}
      />
    </div>
  );
};