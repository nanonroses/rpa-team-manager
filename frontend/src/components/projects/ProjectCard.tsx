import React from 'react';
import { Card, Tag, Progress, Typography, Space, Avatar, Tooltip, Dropdown, Button } from 'antd';
import type { MenuProps } from 'antd';
import {
  CalendarOutlined,
  UserOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  MoreOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { Project, ProjectStatusLabels, PriorityLabels } from '@/types/project';
import { useAuthStore } from '@/store/authStore';
import dayjs from 'dayjs';

const { Text, Title } = Typography;

interface ProjectCardProps {
  project: Project;
  onEdit?: (project: Project) => void;
  onDelete?: (project: Project) => void;
  onView?: (project: Project) => void;
  onClick?: (project: Project) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onEdit,
  onDelete,
  onView,
  onClick
}) => {
  const { user, hasPermission } = useAuthStore();

  const getStatusColor = (status: string) => {
    const colors = {
      planning: 'blue',
      active: 'green',
      on_hold: 'orange',
      completed: 'purple',
      cancelled: 'red'
    };
    return colors[status as keyof typeof colors] || 'default';
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      critical: 'red',
      high: 'orange',
      medium: 'blue',
      low: 'green'
    };
    return colors[priority as keyof typeof colors] || 'default';
  };

  const getProgressStatus = (percentage: number) => {
    if (percentage === 100) return 'success';
    if (percentage >= 70) return 'active';
    if (percentage >= 30) return 'normal';
    return 'exception';
  };

  // For team_lead role, allow all project operations
  const canEdit = user?.role === 'team_lead' || 
    hasPermission('projects:update') || 
    hasPermission('projects:*') ||
    (user?.role === 'rpa_developer' && project.assigned_to === user.id);
  
  const canDelete = user?.role === 'team_lead' || 
    hasPermission('projects:delete') || 
    hasPermission('projects:*');

  const menuItems: MenuProps['items'] = [
    {
      key: 'view',
      icon: <EyeOutlined />,
      label: 'View Details',
      onClick: () => onView?.(project)
    },
    ...(canEdit ? [{
      key: 'edit',
      icon: <EditOutlined />,
      label: 'Edit Project',
      onClick: () => onEdit?.(project)
    }] : []),
    ...(canDelete ? [{
      type: 'divider' as const
    }, {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: 'Delete Project',
      danger: true,
      onClick: () => onDelete?.(project)
    }] : [])
  ];

  const isOverdue = project.end_date && 
    dayjs(project.end_date).isBefore(dayjs()) && 
    project.status !== 'completed';

  const daysRemaining = project.end_date ? 
    dayjs(project.end_date).diff(dayjs(), 'day') : null;

  return (
    <Card
      hoverable
      className={`project-card ${isOverdue ? 'overdue' : ''}`}
      style={{ 
        height: '100%',
        border: isOverdue ? '1px solid #ff4d4f' : undefined
      }}
      bodyStyle={{ padding: '16px' }}
      extra={
        <Dropdown menu={{ items: menuItems }} trigger={['click']}>
          <Button type="text" icon={<MoreOutlined />} size="small" />
        </Dropdown>
      }
      onClick={() => onClick?.(project)}
    >
      <div style={{ marginBottom: '12px' }}>
        <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
          <div style={{ flex: 1 }}>
            <Title level={5} style={{ margin: 0, marginBottom: '4px' }}>
              {project.name}
            </Title>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {project.description?.substring(0, 80)}
              {project.description && project.description.length > 80 ? '...' : ''}
            </Text>
          </div>
        </Space>
      </div>

      <Space direction="vertical" style={{ width: '100%' }} size="small">
        {/* Status and Priority */}
        <Space>
          <Tag color={getStatusColor(project.status)}>
            {ProjectStatusLabels[project.status]}
          </Tag>
          <Tag color={getPriorityColor(project.priority)}>
            {PriorityLabels[project.priority]}
          </Tag>
        </Space>

        {/* Progress */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <Text style={{ fontSize: '12px' }}>Progress</Text>
            <Text style={{ fontSize: '12px' }}>
              {project.completed_tasks || 0}/{project.total_tasks || 0} tasks
            </Text>
          </div>
          <Progress 
            percent={project.progress_percentage} 
            size="small" 
            status={getProgressStatus(project.progress_percentage)}
            showInfo={false}
          />
        </div>

        {/* Project Info */}
        <Space wrap style={{ fontSize: '12px' }}>
          {project.assigned_to_name && (
            <Tooltip title={`Assigned to: ${project.assigned_to_name}`}>
              <Space size={4}>
                <UserOutlined />
                <Text style={{ fontSize: '12px' }}>
                  {project.assigned_to_name.split(' ')[0]}
                </Text>
              </Space>
            </Tooltip>
          )}

          {project.budget && (
            <Tooltip title={`Budget: $${project.budget.toLocaleString()}`}>
              <Space size={4}>
                <DollarOutlined />
                <Text style={{ fontSize: '12px' }}>
                  ${(project.budget / 1000).toFixed(0)}k
                </Text>
              </Space>
            </Tooltip>
          )}

          {project.total_hours_logged && (
            <Tooltip title={`${project.total_hours_logged} hours logged`}>
              <Space size={4}>
                <ClockCircleOutlined />
                <Text style={{ fontSize: '12px' }}>
                  {project.total_hours_logged.toFixed(1)}h
                </Text>
              </Space>
            </Tooltip>
          )}

          {project.end_date && (
            <Tooltip title={`Due: ${dayjs(project.end_date).format('MMM DD, YYYY')}`}>
              <Space size={4}>
                <CalendarOutlined />
                <Text 
                  style={{ 
                    fontSize: '12px',
                    color: isOverdue ? '#ff4d4f' : 
                           daysRemaining !== null && daysRemaining < 7 ? '#faad14' : 
                           undefined
                  }}
                >
                  {daysRemaining !== null ? (
                    daysRemaining < 0 ? 
                      `${Math.abs(daysRemaining)}d overdue` :
                      daysRemaining === 0 ? 'Due today' :
                      `${daysRemaining}d left`
                  ) : 'No due date'}
                </Text>
              </Space>
            </Tooltip>
          )}
        </Space>
      </Space>

      <style jsx>{`
        .project-card.overdue {
          box-shadow: 0 0 0 1px #ff4d4f, 0 2px 8px rgba(255, 77, 79, 0.15);
        }
      `}</style>
    </Card>
  );
};