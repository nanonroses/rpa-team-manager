import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Statistic,
  Progress,
  Tag,
  Timeline,
  Space,
  Button,
  Alert,
  Typography,
  Tooltip,
  Divider,
  List,
  Avatar,
  Empty,
  Spin,
  message
} from 'antd';
import {
  ProjectOutlined,
  AlertOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  TeamOutlined,
  RiseOutlined,
  FallOutlined,
  BarChartOutlined,
  LineChartOutlined,
  WarningOutlined,
  TrophyOutlined,
  CalendarOutlined,
  FireOutlined,
  ThunderboltOutlined,
  EyeOutlined,
  FundOutlined,
  ExclamationCircleOutlined,
  SyncOutlined
} from '@ant-design/icons';
import apiService from '@/services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

interface ProjectPMOViewProps {
  projectId: number;
  projectName: string;
  projectStatus?: string;
  startDate?: string;
  endDate?: string;
}

interface PMOMetrics {
  completion_percentage: number;
  schedule_variance_days: number;
  cost_variance_percentage: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  team_velocity: number;
  bugs_found: number;
  bugs_resolved: number;
  actual_hours: number;
  planned_hours: number;
}

interface Milestone {
  id: number;
  name: string;
  description: string;
  milestone_type: string;
  planned_date: string;
  actual_date: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed' | 'cancelled';
  priority: 'critical' | 'high' | 'medium' | 'low';
  completion_percentage: number;
  responsibility: 'internal' | 'client' | 'external' | 'shared';
  delay_justification?: string;
  financial_impact?: number;
}

export const ProjectPMOView: React.FC<ProjectPMOViewProps> = ({
  projectId,
  projectName,
  projectStatus,
  startDate,
  endDate
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pmoMetrics, setPmoMetrics] = useState<PMOMetrics | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [ganttData, setGanttData] = useState<any>(null);

  useEffect(() => {
    loadPMOData();
  }, [projectId]);

  const loadPMOData = async () => {
    try {
      setLoading(true);
      
      // Load PMO metrics for this project
      const metricsResponse = await apiService.getPMOAnalytics();
      const projectMetrics = metricsResponse.projects?.find((p: any) => p.project_id === projectId);
      
      if (projectMetrics) {
        setPmoMetrics({
          completion_percentage: projectMetrics.completion_percentage || 0,
          schedule_variance_days: projectMetrics.schedule_variance_days || 0,
          cost_variance_percentage: projectMetrics.cost_variance_percentage || 0,
          risk_level: projectMetrics.risk_level || 'low',
          team_velocity: projectMetrics.team_velocity || 0,
          bugs_found: projectMetrics.bugs_found || 0,
          bugs_resolved: projectMetrics.bugs_resolved || 0,
          actual_hours: projectMetrics.actual_hours || 0,
          planned_hours: projectMetrics.planned_hours || 0
        });
      }

      // Load Gantt data to get milestones
      const ganttResponse = await apiService.getProjectGantt(projectId);
      setGanttData(ganttResponse);
      setMilestones(ganttResponse.milestones || []);
      
    } catch (error) {
      console.error('Error loading PMO data:', error);
      message.error('Failed to load PMO data');
    } finally {
      setLoading(false);
    }
  };

  const handleViewFullPMO = () => {
    navigate(`/pmo?project=${projectId}`);
  };

  const handleViewGantt = () => {
    navigate(`/pmo/gantt/${projectId}`);
  };

  const getRiskColor = (riskLevel: string) => {
    const colors = {
      low: '#52c41a',
      medium: '#faad14', 
      high: '#fa8c16',
      critical: '#ff4d4f'
    };
    return colors[riskLevel as keyof typeof colors] || '#d9d9d9';
  };

  const getMilestoneStatusColor = (status: string) => {
    const colors = {
      pending: 'default',
      in_progress: 'processing',
      completed: 'success',
      delayed: 'error',
      cancelled: 'error'
    };
    return colors[status as keyof typeof colors] || 'default';
  };

  const getResponsibilityColor = (responsibility: string) => {
    const colors = {
      internal: 'blue',
      client: 'orange',
      external: 'purple',
      shared: 'cyan'
    };
    return colors[responsibility as keyof typeof colors] || 'default';
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>
          <Text>Loading PMO analytics...</Text>
        </div>
      </div>
    );
  }

  if (!pmoMetrics && milestones.length === 0) {
    return (
      <div style={{ padding: '24px' }}>
        <Empty
          description="No PMO data available for this project"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Space>
            <Button 
              type="primary" 
              icon={<FundOutlined />}
              onClick={handleViewFullPMO}
            >
              Go to PMO Dashboard
            </Button>
            <Button 
              icon={<SyncOutlined />}
              onClick={loadPMOData}
            >
              Refresh Data
            </Button>
          </Space>
        </Empty>
      </div>
    );
  }

  const scheduleStatus = pmoMetrics?.schedule_variance_days || 0;
  const costStatus = pmoMetrics?.cost_variance_percentage || 0;
  const qualityScore = pmoMetrics?.bugs_found ? 
    Math.max(0, 100 - ((pmoMetrics.bugs_found - (pmoMetrics.bugs_resolved || 0)) * 10)) : 100;

  return (
    <div style={{ padding: '8px 0' }}>
      {/* Quick Actions */}
      <div style={{ marginBottom: '24px', textAlign: 'right' }}>
        <Space>
          <Button 
            type="primary" 
            icon={<FundOutlined />}
            onClick={handleViewFullPMO}
          >
            Open PMO Dashboard
          </Button>
          <Button 
            icon={<BarChartOutlined />}
            onClick={handleViewGantt}
          >
            View Gantt Chart
          </Button>
        </Space>
      </div>

      <Row gutter={[24, 24]}>
        {/* Left Column - Metrics & Performance */}
        <Col xs={24} lg={14}>
          {/* Performance Metrics */}
          {pmoMetrics && (
            <Card title="Project Performance Metrics" style={{ marginBottom: '24px' }}>
              <Row gutter={[16, 16]}>
                <Col xs={12} sm={6}>
                  <Statistic
                    title="Completion"
                    value={pmoMetrics.completion_percentage}
                    suffix="%"
                    valueStyle={{ 
                      color: pmoMetrics.completion_percentage > 75 ? '#52c41a' : 
                             pmoMetrics.completion_percentage > 50 ? '#faad14' : '#ff4d4f' 
                    }}
                    prefix={<TrophyOutlined />}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <Tooltip title={scheduleStatus >= 0 ? "Days ahead of schedule" : "Days behind schedule"}>
                    <Statistic
                      title="Schedule"
                      value={Math.abs(scheduleStatus)}
                      suffix={scheduleStatus >= 0 ? " ahead" : " behind"}
                      valueStyle={{ 
                        color: scheduleStatus >= 0 ? '#52c41a' : '#ff4d4f' 
                      }}
                      prefix={scheduleStatus >= 0 ? <RiseOutlined /> : <FallOutlined />}
                    />
                  </Tooltip>
                </Col>
                <Col xs={12} sm={6}>
                  <Tooltip title={costStatus <= 0 ? "Under budget" : "Over budget"}>
                    <Statistic
                      title="Budget"
                      value={Math.abs(costStatus)}
                      suffix="%"
                      prefix={costStatus <= 0 ? "+" : "-"}
                      valueStyle={{ 
                        color: costStatus <= 0 ? '#52c41a' : '#ff4d4f' 
                      }}
                    />
                  </Tooltip>
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic
                    title="Quality Score"
                    value={qualityScore}
                    suffix="/100"
                    valueStyle={{ 
                      color: qualityScore > 80 ? '#52c41a' : 
                             qualityScore > 60 ? '#faad14' : '#ff4d4f' 
                    }}
                    prefix={<CheckCircleOutlined />}
                  />
                </Col>
              </Row>

              <Divider />

              {/* Risk Assessment */}
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Text strong>Risk Level</Text>
                    <Tag 
                      color={getRiskColor(pmoMetrics.risk_level)} 
                      style={{ fontSize: '14px', padding: '4px 12px' }}
                    >
                      <WarningOutlined /> {pmoMetrics.risk_level.toUpperCase()}
                    </Tag>
                  </Space>
                </Col>
                <Col xs={24} sm={12}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Text strong>Team Velocity</Text>
                    <Statistic
                      value={pmoMetrics.team_velocity}
                      suffix="tasks/week"
                      valueStyle={{ fontSize: '18px' }}
                      prefix={<ThunderboltOutlined />}
                    />
                  </Space>
                </Col>
              </Row>

              {/* Hours Tracking */}
              {(pmoMetrics.planned_hours > 0 || pmoMetrics.actual_hours > 0) && (
                <>
                  <Divider />
                  <Row gutter={16}>
                    <Col xs={24} sm={12}>
                      <Statistic
                        title="Planned Hours"
                        value={pmoMetrics.planned_hours}
                        suffix="h"
                        prefix={<CalendarOutlined />}
                      />
                    </Col>
                    <Col xs={24} sm={12}>
                      <Statistic
                        title="Actual Hours"
                        value={pmoMetrics.actual_hours}
                        suffix="h"
                        prefix={<ClockCircleOutlined />}
                        valueStyle={{ 
                          color: pmoMetrics.actual_hours > pmoMetrics.planned_hours ? '#ff4d4f' : '#52c41a' 
                        }}
                      />
                    </Col>
                  </Row>
                  <div style={{ marginTop: '16px' }}>
                    <Text strong>Hours Progress: </Text>
                    <Progress 
                      percent={pmoMetrics.planned_hours > 0 ? 
                        Math.round((pmoMetrics.actual_hours / pmoMetrics.planned_hours) * 100) : 0}
                      status={pmoMetrics.actual_hours > pmoMetrics.planned_hours ? 'exception' : 'active'}
                    />
                  </div>
                </>
              )}
            </Card>
          )}

          {/* Quality Metrics */}
          {pmoMetrics && (pmoMetrics.bugs_found > 0 || pmoMetrics.bugs_resolved > 0) && (
            <Card title="Quality Metrics" style={{ marginBottom: '24px' }}>
              <Row gutter={16}>
                <Col span={8}>
                  <Statistic
                    title="Bugs Found"
                    value={pmoMetrics.bugs_found}
                    valueStyle={{ color: '#ff4d4f' }}
                    prefix={<ExclamationCircleOutlined />}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Bugs Resolved"
                    value={pmoMetrics.bugs_resolved}
                    valueStyle={{ color: '#52c41a' }}
                    prefix={<CheckCircleOutlined />}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Resolution Rate"
                    value={pmoMetrics.bugs_found > 0 ? 
                      Math.round((pmoMetrics.bugs_resolved / pmoMetrics.bugs_found) * 100) : 100}
                    suffix="%"
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Col>
              </Row>
            </Card>
          )}
        </Col>

        {/* Right Column - Milestones & Timeline */}
        <Col xs={24} lg={10}>
          {/* Project Milestones */}
          <Card 
            title="Project Milestones"
            extra={
              <Button 
                type="link" 
                size="small"
                onClick={handleViewGantt}
                icon={<EyeOutlined />}
              >
                View Full Timeline
              </Button>
            }
            style={{ marginBottom: '24px' }}
          >
            {milestones.length > 0 ? (
              <Timeline
                items={milestones.slice(0, 5).map(milestone => ({
                  dot: milestone.status === 'completed' ? 
                    <CheckCircleOutlined style={{ color: '#52c41a' }} /> :
                    milestone.status === 'delayed' ?
                    <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} /> :
                    <ClockCircleOutlined style={{ color: '#1890ff' }} />,
                  children: (
                    <div>
                      <div style={{ marginBottom: '4px' }}>
                        <Text strong>{milestone.name}</Text>
                        <div style={{ float: 'right' }}>
                          <Tag color={getMilestoneStatusColor(milestone.status)} size="small">
                            {milestone.status.replace('_', ' ')}
                          </Tag>
                        </div>
                      </div>
                      <div style={{ marginBottom: '4px' }}>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          Due: {dayjs(milestone.planned_date).format('MMM DD, YYYY')}
                          {milestone.actual_date && (
                            <span> | Completed: {dayjs(milestone.actual_date).format('MMM DD, YYYY')}</span>
                          )}
                        </Text>
                      </div>
                      <div style={{ marginBottom: '8px' }}>
                        <Tag color={getResponsibilityColor(milestone.responsibility)} size="small">
                          {milestone.responsibility}
                        </Tag>
                        {milestone.completion_percentage > 0 && (
                          <Progress 
                            percent={milestone.completion_percentage} 
                            size="small" 
                            style={{ marginTop: '4px' }}
                            showInfo={false}
                          />
                        )}
                      </div>
                      {milestone.delay_justification && (
                        <Alert
                          message={milestone.delay_justification}
                          type="warning"
                          size="small"
                          showIcon
                          style={{ fontSize: '11px', marginTop: '4px' }}
                        />
                      )}
                    </div>
                  )
                }))}
              />
            ) : (
              <Empty 
                description="No milestones defined"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                style={{ padding: '20px 0' }}
              >
                <Button 
                  type="primary" 
                  size="small"
                  onClick={handleViewFullPMO}
                  icon={<PlusOutlined />}
                >
                  Define Milestones
                </Button>
              </Empty>
            )}
          </Card>

          {/* Quick Insights */}
          <Card title="PMO Insights">
            <Space direction="vertical" style={{ width: '100%' }}>
              {pmoMetrics?.risk_level === 'critical' && (
                <Alert
                  message="Critical Risk Detected"
                  description="This project requires immediate attention from PMO."
                  type="error"
                  showIcon
                  icon={<FireOutlined />}
                />
              )}
              
              {scheduleStatus < -7 && (
                <Alert
                  message="Schedule Delay"
                  description={`Project is ${Math.abs(scheduleStatus)} days behind schedule.`}
                  type="warning"
                  showIcon
                />
              )}

              {costStatus > 20 && (
                <Alert
                  message="Budget Overrun"
                  description={`Project is ${costStatus}% over budget.`}
                  type="error"
                  showIcon
                />
              )}

              {(!pmoMetrics || (pmoMetrics.completion_percentage < 10 && milestones.length === 0)) && (
                <Alert
                  message="PMO Setup Required"
                  description="Set up project milestones and metrics for better tracking."
                  type="info"
                  showIcon
                  action={
                    <Button size="small" onClick={handleViewFullPMO}>
                      Setup PMO
                    </Button>
                  }
                />
              )}

              {pmoMetrics && pmoMetrics.completion_percentage > 90 && (
                <Alert
                  message="Project Near Completion"
                  description="Consider project closure activities and lessons learned."
                  type="success"
                  showIcon
                />
              )}
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};