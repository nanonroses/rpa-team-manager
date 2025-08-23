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

  // Create matrix based on Urgency vs Impact
  const createMatrix = () => {
    const matrix: Array<Array<Task[]>> = [];
    
    // Initialize 5x5 matrix
    for (let urgency = 5; urgency >= 1; urgency--) {
      matrix[5 - urgency] = [];
      for (let impact = 1; impact <= 5; impact++) {
        matrix[5 - urgency][impact - 1] = [];
      }
    }

    // Populate matrix with tasks
    tasks.forEach(task => {
      const urgencyScore = calculateUrgencyScore(task);
      const impactScore = calculateImpactScore(task);
      
      const urgencyIndex = 5 - urgencyScore;
      const impactIndex = impactScore - 1;
      
      if (matrix[urgencyIndex] && matrix[urgencyIndex][impactIndex]) {
        matrix[urgencyIndex][impactIndex].push(task);
      }
    });

    return matrix;
  };

  const getQuadrantInfo = (urgency: number, impact: number) => {
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

  const getStatusColor = (status: string) => {
    const colors = {
      todo: 'default',
      in_progress: 'processing',
      review: 'warning',
      testing: 'purple',
      done: 'success',
      blocked: 'error'
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

  const matrix = createMatrix();

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
        <Title level={4}>Task Priority Matrix - Eisenhower Method</Title>
        <Text type="secondary">
          Tasks are positioned based on urgency (due dates + priority) vs impact (business value + complexity). 
          Higher positions indicate greater urgency, while positions to the right indicate greater impact.
        </Text>
      </div>

      {/* Legend */}
      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
        <Space wrap>
          <Tag color="red">DO FIRST (High Urgency, High Impact)</Tag>
          <Tag color="orange">SCHEDULE (Low Urgency, High Impact)</Tag>
          <Tag color="blue">DELEGATE (High Urgency, Low Impact)</Tag>
          <Tag color="gray">ELIMINATE (Low Urgency, Low Impact)</Tag>
          <Tag color="purple">EVALUATE (Medium Priority)</Tag>
        </Space>
      </div>

      {/* Matrix Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'auto repeat(5, 1fr)',
        gridTemplateRows: 'auto repeat(5, 1fr)',
        gap: '2px',
        backgroundColor: '#f0f0f0',
        padding: '2px',
        borderRadius: '8px'
      }}>
        {/* Empty top-left corner */}
        <div style={{ 
          backgroundColor: '#fafafa', 
          padding: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          fontSize: '12px'
        }}>
          Urgency ↑<br/>Impact →
        </div>

        {/* Impact headers */}
        {[1, 2, 3, 4, 5].map(impact => (
          <div key={`impact-${impact}`} style={{
            backgroundColor: '#fafafa',
            padding: '8px',
            textAlign: 'center',
            fontWeight: 'bold',
            fontSize: '12px'
          }}>
            Impact {impact}
            <br />
            <Text type="secondary" style={{ fontSize: '10px' }}>
              {impact === 1 ? 'Very Low' : 
               impact === 2 ? 'Low' :
               impact === 3 ? 'Medium' :
               impact === 4 ? 'High' : 'Very High'}
            </Text>
          </div>
        ))}

        {/* Matrix cells */}
        {matrix.map((row, urgencyIndex) => {
          const urgency = 5 - urgencyIndex;
          return [
            // Urgency header for this row
            <div key={`urgency-${urgency}`} style={{
              backgroundColor: '#fafafa',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '12px',
              writingMode: 'vertical-rl',
              textAlign: 'center'
            }}>
              Urgency {urgency}
              <br />
              <Text type="secondary" style={{ fontSize: '10px' }}>
                {urgency === 1 ? 'Very Low' : 
                 urgency === 2 ? 'Low' :
                 urgency === 3 ? 'Medium' :
                 urgency === 4 ? 'High' : 'Critical'}
              </Text>
            </div>,
            
            // Impact cells for this row
            ...row.map((cellTasks, impactIndex) => {
              const impact = impactIndex + 1;
              const quadrant = getQuadrantInfo(urgency, impact);
              
              return (
                <div
                  key={`cell-${urgency}-${impact}`}
                  style={{
                    backgroundColor: quadrant.backgroundColor,
                    border: `2px solid ${quadrant.color}`,
                    borderRadius: '6px',
                    padding: '8px',
                    minHeight: '140px',
                    position: 'relative'
                  }}
                >
                  {/* Quadrant label */}
                  <div style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    color: quadrant.color,
                    textAlign: 'right'
                  }}>
                    {quadrant.label}
                  </div>

                  {/* Tasks in this cell */}
                  <div style={{ marginTop: '16px' }}>
                    {cellTasks.map(task => {
                      const daysUntilDue = getDaysUntilDue(task.due_date);
                      const overdue = isOverdue(task.due_date);
                      
                      return (
                        <Tooltip 
                          key={task.id}
                          title={
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
                          }
                          placement="topLeft"
                        >
                          <Card
                            size="small"
                            style={{
                              marginBottom: '4px',
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
                                    color={getStatusColor(task.status)}
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
                        </Tooltip>
                      );
                    })}
                    
                    {cellTasks.length === 0 && (
                      <Text type="secondary" style={{ fontSize: '10px' }}>
                        No tasks
                      </Text>
                    )}
                  </div>
                </div>
              );
            })
          ];
        }).flat()}
      </div>

      {/* Summary Stats */}
      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <Space split={<span style={{ color: '#d9d9d9' }}>•</span>}>
          <Text>Total Tasks: {tasks.length}</Text>
          <Text style={{ color: '#f5222d' }}>
            Critical (Do First): {tasks.filter(t => {
              const urgency = calculateUrgencyScore(t);
              const impact = calculateImpactScore(t);
              return urgency >= 4 && impact >= 4;
            }).length}
          </Text>
          <Text style={{ color: '#faad14' }}>
            Important (Schedule): {tasks.filter(t => {
              const urgency = calculateUrgencyScore(t);
              const impact = calculateImpactScore(t);
              return urgency <= 2 && impact >= 4;
            }).length}
          </Text>
          <Text style={{ color: '#f5222d' }}>
            Overdue: {tasks.filter(t => isOverdue(t.due_date)).length}
          </Text>
        </Space>
      </div>

      <div style={{ marginTop: '16px', textAlign: 'center' }}>
        <Text type="secondary" style={{ fontSize: '12px' }}>
          Click on any task card to navigate to the full task management view
        </Text>
      </div>
    </div>
  );
};

export default TaskPriorityMatrix;