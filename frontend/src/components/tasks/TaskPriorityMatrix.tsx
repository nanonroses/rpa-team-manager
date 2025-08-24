import React from 'react';
import { Card, Typography, Tooltip, Tag, Space, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { 
  ClockCircleOutlined, 
  UserOutlined, 
  CalendarOutlined,
  FlagOutlined,
  EyeOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { PriorityMatrix, QuadrantConfig, QuadrantRules, MatrixAxisConfig, MatrixItemRenderer, MatrixSummary } from '@/components/common';
import { getTaskStatusColor, getPriorityColor } from '@/utils';

const { Title, Text } = Typography;

interface Task {
  id: number;
  board_id: number;
  column_id: number;
  title: string;
  description?: string;
  task_type: 'task' | 'bug' | 'feature' | 'research' | 'documentation';
  status: 'todo' | 'in_progress' | 'review' | 'testing' | 'done' | 'blocked';
  priority: 'critical' | 'high' | 'medium' | 'low';
  assignee_id?: number;
  assignee_name?: string;
  assignee_avatar?: string;
  reporter_name?: string;
  estimated_hours?: number;
  story_points?: number;
  due_date?: string;
  position: number;
  total_hours?: number;
  total_value?: number;
  created_at: string;
  updated_at: string;
}

interface TaskPriorityMatrixProps {
  tasks: Task[];
}

const TaskPriorityMatrix: React.FC<TaskPriorityMatrixProps> = ({ tasks }) => {
  const navigate = useNavigate();

  // Calculate urgency score based on due date and priority
  const calculateUrgencyScore = (task: Task): number => {
    let urgencyScore = 3; // default medium
    
    // Priority contribution (40% weight)
    const priorityScores = {
      critical: 5,
      high: 4,
      medium: 3,
      low: 2
    };
    const priorityScore = priorityScores[task.priority] || 3;
    
    // Due date contribution (60% weight)
    let dueDateScore = 3;
    if (task.due_date) {
      const today = dayjs();
      const dueDate = dayjs(task.due_date);
      const daysUntilDue = dueDate.diff(today, 'day');
      
      if (daysUntilDue < 0) dueDateScore = 5; // Overdue
      else if (daysUntilDue <= 1) dueDateScore = 5; // Due today/tomorrow
      else if (daysUntilDue <= 3) dueDateScore = 4; // Due within 3 days
      else if (daysUntilDue <= 7) dueDateScore = 3; // Due within a week
      else if (daysUntilDue <= 14) dueDateScore = 2; // Due within 2 weeks
      else dueDateScore = 1; // Due later
    }
    
    // Blocked status increases urgency
    if (task.status === 'blocked') {
      dueDateScore = Math.min(5, dueDateScore + 1);
    }
    
    urgencyScore = Math.round((priorityScore * 0.4) + (dueDateScore * 0.6));
    return Math.max(1, Math.min(5, urgencyScore));
  };

  // Calculate impact score based on task type, story points, and business value
  const calculateImpactScore = (task: Task): number => {
    let impactScore = 3; // default medium
    
    // Task type contribution (40% weight)
    const typeScores = {
      bug: 4, // Bugs have high impact on user experience
      feature: 4, // Features drive business value
      task: 3, // Regular tasks medium impact
      research: 2, // Research is important but less immediate impact
      documentation: 2 // Documentation is valuable but lower immediate impact
    };
    const typeScore = typeScores[task.task_type] || 3;
    
    // Story points contribution (30% weight)
    let complexityScore = 3;
    if (task.story_points) {
      if (task.story_points >= 8) complexityScore = 5; // Very complex = high impact when done
      else if (task.story_points >= 5) complexityScore = 4; // Complex
      else if (task.story_points >= 3) complexityScore = 3; // Medium
      else if (task.story_points >= 1) complexityScore = 2; // Simple
      else complexityScore = 1; // Very simple
    }
    
    // Business value from estimated hours (30% weight)
    let valueScore = 3;
    if (task.estimated_hours) {
      if (task.estimated_hours >= 40) valueScore = 5; // Major work item
      else if (task.estimated_hours >= 20) valueScore = 4; // Significant work
      else if (task.estimated_hours >= 8) valueScore = 3; // Medium work
      else if (task.estimated_hours >= 2) valueScore = 2; // Small work
      else valueScore = 1; // Very small work
    }
    
    impactScore = Math.round((typeScore * 0.4) + (complexityScore * 0.3) + (valueScore * 0.3));
    return Math.max(1, Math.min(5, impactScore));
  };

  const getTaskTypeIcon = (type: string) => {
    switch (type) {
      case 'bug': return '🐛';
      case 'feature': return '✨';
      case 'research': return '🔍';
      case 'documentation': return '📄';
      default: return '📋';
    }
  };


  const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    return dayjs().isAfter(dayjs(dueDate), 'day');
  };

  const getDaysUntilDue = (dueDate?: string) => {
    if (!dueDate) return null;
    const days = dayjs(dueDate).diff(dayjs(), 'day');
    return days;
  };

  const handleTaskClick = (task: Task) => {
    // Navigate to tasks page and potentially highlight the specific task
    navigate('/tasks');
  };

  // Quadrant rules for tasks (Eisenhower Matrix)
  const quadrantRules: QuadrantRules<Task> = {
    getQuadrantInfo: (impact: number, urgency: number) => {
      if (urgency >= 4 && impact >= 4) {
        return { 
          label: 'DO FIRST', 
          color: '#f5222d', 
          backgroundColor: '#fff2f0',
          description: 'Critical - handle immediately!'
        };
      } else if (urgency <= 2 && impact >= 4) {
        return { 
          label: 'SCHEDULE', 
          color: '#faad14', 
          backgroundColor: '#fffbe6',
          description: 'Important - plan and schedule properly'
        };
      } else if (urgency >= 4 && impact <= 2) {
        return { 
          label: 'DELEGATE', 
          color: '#1890ff', 
          backgroundColor: '#f0f9ff',
          description: 'Urgent but low impact - delegate if possible'
        };
      } else if (urgency <= 2 && impact <= 2) {
        return { 
          label: 'ELIMINATE', 
          color: '#8c8c8c', 
          backgroundColor: '#f5f5f5',
          description: 'Low priority - eliminate or do later'
        };
      }
      
      return { 
        label: 'EVALUATE', 
        color: '#722ed1', 
        backgroundColor: '#f9f0ff',
        description: 'Medium priority - evaluate based on capacity'
      };
    }
  };

  // X-axis configuration (Impact)
  const xAxis: MatrixAxisConfig = {
    label: 'Impact',
    min: 1,
    max: 5,
    getAxisLabel: (value) => `Impact ${value}`,
    getAxisDescription: (value) => {
      const descriptions = { 1: 'Very Low', 2: 'Low', 3: 'Medium', 4: 'High', 5: 'Very High' };
      return descriptions[value as keyof typeof descriptions] || '';
    }
  };

  // Y-axis configuration (Urgency)
  const yAxis: MatrixAxisConfig = {
    label: 'Urgency',
    min: 1,
    max: 5,
    getAxisLabel: (value) => `Urgency ${value}`,
    getAxisDescription: (value) => {
      const descriptions = { 1: 'Very Low', 2: 'Low', 3: 'Medium', 4: 'High', 5: 'Critical' };
      return descriptions[value as keyof typeof descriptions] || '';
    }
  };

  // Item renderer
  const itemRenderer: MatrixItemRenderer<Task> = {
    getItemKey: (task) => task.id,
    renderTooltip: (task) => {
      const overdue = isOverdue(task.due_date);
      return (
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
            {getTaskTypeIcon(task.task_type)} {task.title}
          </div>
          <div style={{ marginBottom: '4px' }}>
            Priority: {task.priority.toUpperCase()}
          </div>
          <div style={{ marginBottom: '4px' }}>
            Status: {task.status.replace('_', ' ').toUpperCase()}
          </div>
          {task.assignee_name && (
            <div style={{ marginBottom: '4px' }}>
              Assigned to: {task.assignee_name}
            </div>
          )}
          {task.due_date && (
            <div style={{ marginBottom: '4px' }}>
              Due: {dayjs(task.due_date).format('MMM DD, YYYY')}
              {overdue && <span style={{ color: '#f5222d' }}> (OVERDUE)</span>}
            </div>
          )}
          {task.estimated_hours && (
            <div style={{ marginBottom: '4px' }}>
              Estimated: {task.estimated_hours}h
            </div>
          )}
          {task.story_points && (
            <div style={{ marginBottom: '4px' }}>
              Story Points: {task.story_points}
            </div>
          )}
          <div>
            {task.description?.substring(0, 100)}
            {task.description && task.description.length > 100 ? '...' : ''}
          </div>
        </div>
      );
    },
    renderItem: (task) => {
      const daysUntilDue = getDaysUntilDue(task.due_date);
      const overdue = isOverdue(task.due_date);
      
      return (
        <Card
          size="small"
          style={{
            cursor: 'pointer',
            fontSize: '11px',
            border: overdue ? '1px solid #f5222d' : undefined
          }}
          bodyStyle={{ padding: '6px' }}
          onClick={() => handleTaskClick(task)}
          hoverable
        >
          <div style={{ 
            fontWeight: 'bold', 
            marginBottom: '2px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {getTaskTypeIcon(task.task_type)} {task.title}
          </div>
          <Space direction="vertical" size={1} style={{ width: '100%' }}>
            <div>
              <Space size="small">
                <Tag 
                  color={getPriorityColor(task.priority)}
                  style={{ fontSize: '9px', padding: '1px 4px' }}
                >
                  {task.priority.charAt(0).toUpperCase()}
                </Tag>
                <Tag 
                  color={getTaskStatusColor(task.status)}
                  style={{ fontSize: '9px', padding: '1px 4px' }}
                >
                  {task.status === 'in_progress' ? 'PROG' : task.status.toUpperCase()}
                </Tag>
              </Space>
            </div>
            {task.assignee_name && (
              <div style={{ fontSize: '10px' }}>
                <UserOutlined /> {task.assignee_name.split(' ')[0]}
              </div>
            )}
            {task.due_date && (
              <div style={{ 
                fontSize: '10px',
                color: overdue ? '#f5222d' : daysUntilDue !== null && daysUntilDue <= 3 ? '#faad14' : undefined
              }}>
                <CalendarOutlined /> 
                {overdue 
                  ? 'OVERDUE' 
                  : daysUntilDue === 0 
                    ? 'TODAY' 
                    : daysUntilDue === 1 
                      ? 'TOMORROW'
                      : dayjs(task.due_date).format('MM/DD')
                }
              </div>
            )}
            {task.estimated_hours && (
              <div style={{ fontSize: '10px' }}>
                <ClockCircleOutlined /> {task.estimated_hours}h
              </div>
            )}
          </Space>
        </Card>
      );
    }
  };

  // Summary configuration
  const summary: MatrixSummary<Task> = {
    getStats: (tasks) => [
      { label: 'Total Tasks', value: tasks.length },
      { 
        label: 'Critical (Do First)', 
        value: tasks.filter(t => {
          const urgency = calculateUrgencyScore(t);
          const impact = calculateImpactScore(t);
          return urgency >= 4 && impact >= 4;
        }).length 
      },
      { 
        label: 'Important (Schedule)', 
        value: tasks.filter(t => {
          const urgency = calculateUrgencyScore(t);
          const impact = calculateImpactScore(t);
          return urgency <= 2 && impact >= 4;
        }).length 
      },
      { 
        label: 'Overdue', 
        value: tasks.filter(t => isOverdue(t.due_date)).length 
      }
    ]
  };

  // Legend configuration
  const legend: QuadrantConfig[] = [
    { label: 'DO FIRST', color: 'red', backgroundColor: '', description: 'High Urgency, High Impact' },
    { label: 'SCHEDULE', color: 'orange', backgroundColor: '', description: 'Low Urgency, High Impact' },
    { label: 'DELEGATE', color: 'blue', backgroundColor: '', description: 'High Urgency, Low Impact' },
    { label: 'ELIMINATE', color: 'gray', backgroundColor: '', description: 'Low Urgency, Low Impact' },
    { label: 'EVALUATE', color: 'purple', backgroundColor: '', description: 'Medium Priority' }
  ];

  return (
    <div>
      <PriorityMatrix
        items={tasks}
        title="Task Priority Matrix - Eisenhower Method"
        description="Tasks are positioned based on urgency (due dates + priority) vs impact (business value + complexity). Higher positions indicate greater urgency, while positions to the right indicate greater impact."
        xAxis={xAxis}
        yAxis={yAxis}
        quadrantRules={quadrantRules}
        itemRenderer={itemRenderer}
        summary={summary}
        getXValue={calculateImpactScore}
        getYValue={calculateUrgencyScore}
        legend={legend}
      />
      
      <div style={{ marginTop: '16px', textAlign: 'center' }}>
        <Text type="secondary" style={{ fontSize: '12px' }}>
          Click on any task card to navigate to the full task management view
        </Text>
      </div>
    </div>
  );
};

export default TaskPriorityMatrix;