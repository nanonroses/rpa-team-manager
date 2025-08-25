import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Progress, Alert, Space, Typography, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { 
  ProjectOutlined, 
  CheckCircleOutlined, 
  ClockCircleOutlined,
  TeamOutlined,
  TrophyOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  DollarOutlined,
  RiseOutlined,
  FallOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { useAuthStore } from '@/store/authStore';
import { apiService } from '@/services/api';
import { Project, ProjectStatusLabels, PriorityLabels } from '@/types/project';
import { RoleLabels } from '@/types/auth';

const { Title, Text } = Typography;

export const DashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roiDashboard, setRoiDashboard] = useState<any>(null);
  const [roiLoading, setRoiLoading] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const projectsData = await apiService.getProjects();
      setProjects(projectsData);
      
      // Load ROI data for team_lead
      if (user?.role === 'team_lead') {
        loadROIDashboard();
      }
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const loadROIDashboard = async () => {
    try {
      setRoiLoading(true);
      const data = await apiService.getROIDashboard();
      console.log('ROI Dashboard data:', data);
      console.log('Overall metrics:', data.overall_metrics);
      setRoiDashboard(data);
    } catch (error) {
      console.error('Failed to load ROI dashboard:', error);
    } finally {
      setRoiLoading(false);
    }
  };

  const getWelcomeMessage = () => {
    const hour = new Date().getHours();
    let greeting = 'Good day';
    
    if (hour < 12) greeting = 'Good morning';
    else if (hour < 18) greeting = 'Good afternoon';
    else greeting = 'Good evening';
    
    return `${greeting}, ${user?.full_name?.split(' ')[0] || 'there'}!`;
  };

  const getStatsData = () => {
    const totalProjects = projects.length;
    const activeProjects = projects.filter(p => p.status === 'active').length;
    const completedProjects = projects.filter(p => p.status === 'completed').length;
    const totalTasks = projects.reduce((sum, p) => sum + (p.total_tasks || 0), 0);
    const completedTasks = projects.reduce((sum, p) => sum + (p.completed_tasks || 0), 0);
    const totalHours = projects.reduce((sum, p) => sum + (p.total_hours_logged || 0), 0);
    
    return {
      totalProjects,
      activeProjects,
      completedProjects,
      totalTasks,
      completedTasks,
      totalHours,
      taskCompletionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
    };
  };

  const stats = getStatsData();

  const recentProjectsColumns = [
    {
      title: 'Project',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Project) => (
        <Space direction="vertical" size={0}>
          <Text strong>{name}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.description?.substring(0, 50)}...
          </Text>
        </Space>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colors = {
          planning: 'blue',
          active: 'green',
          on_hold: 'orange',
          completed: 'purple',
          cancelled: 'red'
        };
        return (
          <Tag color={colors[status as keyof typeof colors]}>
            {ProjectStatusLabels[status as keyof typeof ProjectStatusLabels]}
          </Tag>
        );
      }
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: string) => {
        const colors = {
          critical: 'red',
          high: 'orange',
          medium: 'blue',
          low: 'green'
        };
        return (
          <Tag color={colors[priority as keyof typeof colors]}>
            {PriorityLabels[priority as keyof typeof PriorityLabels]}
          </Tag>
        );
      }
    },
    {
      title: 'Progress',
      dataIndex: 'progress_percentage',
      key: 'progress',
      render: (progress: number) => (
        <Progress 
          percent={progress} 
          size="small" 
          status={progress === 100 ? 'success' : 'active'}
        />
      )
    },
    {
      title: 'Hours',
      dataIndex: 'total_hours_logged',
      key: 'hours',
      render: (hours: number) => (
        <Text>{hours?.toFixed(1) || '0.0'}h</Text>
      )
    }
  ];

  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <Alert
          message="Failed to load dashboard"
          description={error}
          type="error"
          showIcon
          action={
            <Button size="small" onClick={loadDashboardData}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* Welcome Section */}
      <div style={{ marginBottom: '32px' }}>
        <Title level={2} style={{ margin: 0 }}>
          {getWelcomeMessage()}
        </Title>
        <Text type="secondary" style={{ fontSize: '16px' }}>
          Welcome to your RPA Team dashboard. You're logged in as{' '}
          <Text strong>{user ? RoleLabels[user.role] : 'User'}</Text>.
        </Text>
      </div>

      {/* Stats Cards */}
      <Row gutter={[24, 24]} style={{ marginBottom: '32px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Projects"
              value={stats.totalProjects}
              prefix={<ProjectOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Active Projects"
              value={stats.activeProjects}
              prefix={<TrophyOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Task Completion"
              value={stats.taskCompletionRate}
              suffix="%"
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: stats.taskCompletionRate > 70 ? '#52c41a' : '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Hours"
              value={stats.totalHours.toFixed(1)}
              suffix="hrs"
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* ROI Dashboard for Team Lead */}
      {user?.role === 'team_lead' && roiDashboard && (
        <>
          <Row gutter={[24, 24]} style={{ marginBottom: '32px' }}>
            <Col span={24}>
              <Title level={3} style={{ marginBottom: '16px', color: '#1890ff' }}>
                📊 Financial Performance & ROI
              </Title>
            </Col>
          </Row>
          
          <Row gutter={[24, 24]} style={{ marginBottom: '32px' }}>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Total Revenue"
                  value={roiDashboard.overall_metrics?.total_revenue || 0}
                  precision={0}
                  prefix={<DollarOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Average ROI"
                  value={Math.round(roiDashboard.overall_metrics?.avg_roi || 0)}
                  precision={0}
                  suffix="%"
                  prefix={roiDashboard.overall_metrics?.avg_roi >= 20 ? <RiseOutlined /> : <FallOutlined />}
                  valueStyle={{ 
                    color: roiDashboard.overall_metrics?.avg_roi >= 20 ? '#52c41a' : 
                           roiDashboard.overall_metrics?.avg_roi >= 0 ? '#faad14' : '#f5222d' 
                  }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Total Profit"
                  value={roiDashboard.overall_metrics?.total_profit || 0}
                  precision={0}
                  prefix={<DollarOutlined />}
                  valueStyle={{ 
                    color: roiDashboard.overall_metrics?.total_profit >= 0 ? '#52c41a' : '#f5222d' 
                  }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Active Alerts"
                  value={roiDashboard.active_alerts?.length || 0}
                  prefix={<ExclamationCircleOutlined />}
                  valueStyle={{ 
                    color: roiDashboard.active_alerts?.length > 0 ? '#f5222d' : '#52c41a' 
                  }}
                />
              </Card>
            </Col>
          </Row>

          {/* ROI Alerts */}
          {roiDashboard.active_alerts && roiDashboard.active_alerts.length > 0 && (
            <Row gutter={[24, 24]} style={{ marginBottom: '32px' }}>
              <Col span={24}>
                <Card 
                  title="🚨 Active Financial Alerts" 
                  headStyle={{ backgroundColor: '#fff2f0' }}
                >
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    {roiDashboard.active_alerts.slice(0, 5).map((alert: any, index: number) => (
                      <Alert
                        key={index}
                        message={`${alert.project_name}: ${alert.alert_type.replace('_', ' ').toUpperCase()}`}
                        description={`Alert Level: ${alert.alert_level} | ${alert.alert_type === 'cost_overrun' ? 'Budget exceeded' : 'ROI below target'}`}
                        type={alert.alert_level === 'critical' ? 'error' : 'warning'}
                        showIcon
                        style={{ borderRadius: '6px' }}
                      />
                    ))}
                  </Space>
                </Card>
              </Col>
            </Row>
          )}
        </>
      )}

      {/* Recent Projects */}
      <Row gutter={[24, 24]}>
        <Col span={24}>
          <Card 
            title="Recent Projects" 
            extra={
              <Button type="primary" onClick={() => window.location.href = '/projects'}>
                View All Projects
              </Button>
            }
          >
            <Table
              columns={recentProjectsColumns}
              dataSource={projects.slice(0, 5)}
              rowKey="id"
              loading={loading}
              pagination={false}
              size="middle"
              onRow={(record) => ({
                onClick: () => navigate(`/projects/${record.id}`),
                style: { cursor: 'pointer' }
              })}
            />
          </Card>
        </Col>
      </Row>

      {/* Quick Actions based on role */}
      <Row gutter={[24, 24]} style={{ marginTop: '32px' }}>
        <Col span={24}>
          <Card title="Quick Actions">
            <Space wrap size="middle">
              {user?.role === 'team_lead' && (
                <>
                  <Button type="primary" onClick={() => window.location.href = '/projects'}>
                    Create New Project
                  </Button>
                  <Button onClick={() => window.location.href = '/admin'}>
                    Team Management
                  </Button>
                </>
              )}
              {(user?.role === 'rpa_developer' || user?.role === 'rpa_operations') && (
                <>
                  <Button type="primary" onClick={() => window.location.href = '/tasks'}>
                    View My Tasks
                  </Button>
                  <Button onClick={() => window.location.href = '/time'}>
                    Log Time
                  </Button>
                </>
              )}
              <Button onClick={() => window.location.href = '/ideas'}>
                Share an Idea
              </Button>
              {user?.role === 'it_support' && (
                <Button onClick={() => window.location.href = '/admin'}>
                  System Health
                </Button>
              )}
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Role-specific insights */}
      {user?.role === 'team_lead' && (
        <Row gutter={[24, 24]} style={{ marginTop: '32px' }}>
          <Col span={24}>
            <Alert
              message="Team Lead Insights"
              description={`You have ${stats.activeProjects} active projects with a ${stats.taskCompletionRate}% task completion rate. Total team effort: ${stats.totalHours.toFixed(1)} hours logged.`}
              type="info"
              showIcon
            />
          </Col>
        </Row>
      )}
    </div>
  );
};