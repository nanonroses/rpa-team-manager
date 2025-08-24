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
  Empty,
  Spin,
  message
} from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  RiseOutlined,
  FallOutlined,
  WarningOutlined,
  TrophyOutlined,
  CalendarOutlined,
  FireOutlined,
  ThunderboltOutlined,
  EyeOutlined,
  FundOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
  PlusOutlined,
  DisconnectOutlined,
  DatabaseOutlined
} from '@ant-design/icons';
import apiService from '@/services/api';
import dayjs from 'dayjs';

const { Text } = Typography;

interface ProjectPMOViewProps {
  projectId: number;
  projectName: string;
  projectStatus?: string;
  startDate?: string;
  endDate?: string;
}

interface ErrorState {
  hasError: boolean;
  errorMessage: string;
  errorType: 'network' | 'permission' | 'data' | 'unknown';
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
  projectName
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pmoMetrics, setPmoMetrics] = useState<PMOMetrics | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [ganttData, setGanttData] = useState<any>(null);
  const [error, setError] = useState<ErrorState>({
    hasError: false,
    errorMessage: '',
    errorType: 'unknown'
  });
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    loadPMOData();
  }, [projectId]);

  const loadPMOData = async () => {
    try {
      setLoading(true);
      setError({ hasError: false, errorMessage: '', errorType: 'unknown' });
      
      // Load PMO metrics for this specific project
      const pmoData = await apiService.getProjectPMOMetrics(projectId);
      
      if (pmoData && pmoData.success) {
        // Set PMO metrics
        if (pmoData.data.metrics) {
          setPmoMetrics({
            completion_percentage: pmoData.data.metrics.completion_percentage || 0,
            schedule_variance_days: pmoData.data.metrics.schedule_variance_days || 0,
            cost_variance_percentage: pmoData.data.metrics.cost_variance_percentage || 0,
            risk_level: pmoData.data.metrics.risk_level || 'low',
            team_velocity: pmoData.data.metrics.team_velocity || 0,
            bugs_found: pmoData.data.metrics.bugs_found || 0,
            bugs_resolved: pmoData.data.metrics.bugs_resolved || 0,
            actual_hours: pmoData.data.metrics.actual_hours || 0,
            planned_hours: pmoData.data.metrics.planned_hours || 0
          });
        }

        // Set milestones from PMO data
        if (pmoData.data.milestones) {
          setMilestones(pmoData.data.milestones);
        }

        // Set gantt data if available
        if (pmoData.data.gantt) {
          setGanttData(pmoData.data.gantt);
        }

        // Reset retry count on successful load
        setRetryCount(0);
      } else {
        // Handle case where response is not successful
        setError({
          hasError: true,
          errorMessage: pmoData?.message || 'Invalid response from server',
          errorType: 'data'
        });
      }
      
    } catch (error: any) {
      console.error('Error loading PMO data:', error);
      
      let errorState: ErrorState = {
        hasError: true,
        errorMessage: 'Unknown error occurred',
        errorType: 'unknown'
      };

      // Categorize error types
      if (error.response) {
        const status = error.response.status;
        if (status === 401 || status === 403) {
          errorState = {
            hasError: true,
            errorMessage: 'Access denied. You may not have permission to view this project\'s PMO data.',
            errorType: 'permission'
          };
        } else if (status === 404) {
          errorState = {
            hasError: true,
            errorMessage: 'PMO data not found for this project.',
            errorType: 'data'
          };
        } else if (status >= 500) {
          errorState = {
            hasError: true,
            errorMessage: 'Server error. Please try again later.',
            errorType: 'network'
          };
        } else {
          errorState = {
            hasError: true,
            errorMessage: error.response.data?.message || `Request failed with status ${status}`,
            errorType: 'data'
          };
        }
      } else if (error.request) {
        errorState = {
          hasError: true,
          errorMessage: 'Network error. Please check your connection and try again.',
          errorType: 'network'
        };
      } else {
        errorState = {
          hasError: true,
          errorMessage: error.message || 'An unexpected error occurred',
          errorType: 'unknown'
        };
      }

      setError(errorState);
      
      // Show appropriate message based on error type
      if (errorState.errorType === 'network') {
        message.error('Network error - unable to load PMO data');
      } else if (errorState.errorType === 'permission') {
        message.warning('Access denied for PMO data');
      } else {
        message.error('Failed to load PMO data');
      }
      
      // Fallback: try to load basic gantt data for milestones only for non-permission errors
      if (errorState.errorType !== 'permission' && retryCount < 2) {
        try {
          const ganttResponse = await apiService.getProjectGantt(projectId);
          if (ganttResponse) {
            setGanttData(ganttResponse);
            if (ganttResponse && ganttResponse.milestones) {
              setMilestones(ganttResponse.milestones);
            }
            message.info('Loaded basic milestone data as fallback');
          }
        } catch (ganttError) {
          console.error('Error loading fallback Gantt data:', ganttError);
        }
      }
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

  // Enhanced error display
  if (error.hasError && !loading) {
    const getErrorIcon = () => {
      switch (error.errorType) {
        case 'network': return <DisconnectOutlined />;
        case 'permission': return <ExclamationCircleOutlined />;
        case 'data': return <DatabaseOutlined />;
        default: return <WarningOutlined />;
      }
    };

    const getErrorActions = () => {
      const actions = [
        <Button 
          key="retry"
          type="primary" 
          icon={<SyncOutlined />}
          onClick={() => {
            setRetryCount(prev => prev + 1);
            loadPMOData();
          }}
          disabled={retryCount >= 3}
        >
          {retryCount >= 3 ? 'Max Retries Reached' : 'Retry'}
        </Button>
      ];

      if (error.errorType !== 'permission') {
        actions.push(
          <Button 
            key="pmo-dashboard"
            icon={<FundOutlined />}
            onClick={handleViewFullPMO}
          >
            Go to PMO Dashboard
          </Button>
        );
      }

      return actions;
    };

    return (
      <div style={{ padding: '24px' }}>
        <Alert
          message={`Error Loading PMO Data (${error.errorType})`}
          description={error.errorMessage}
          type={error.errorType === 'permission' ? 'warning' : 'error'}
          showIcon
          icon={getErrorIcon()}
          action={<Space>{getErrorActions()}</Space>}
          style={{ marginBottom: '24px' }}
        />
        
        {/* Show partial data if available */}
        {(pmoMetrics || milestones.length > 0) && (
          <Alert
            message="Partial Data Available"
            description="Some PMO data was loaded successfully despite errors."
            type="info"
            showIcon
            style={{ marginBottom: '16px' }}
          />
        )}
      </div>
    );
  }

  // No data state (when no error but no data)
  if (!error.hasError && !pmoMetrics && milestones.length === 0 && !loading) {
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
                          <Tag color={getMilestoneStatusColor(milestone.status)}>
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
                        <Tag color={getResponsibilityColor(milestone.responsibility)}>
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