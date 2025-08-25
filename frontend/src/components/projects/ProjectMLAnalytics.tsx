import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Typography,
  Spin,
  Alert,
  Progress,
  Statistic,
  Tag,
  Space,
  Collapse,
  List,
  Tooltip,
  message
} from 'antd';
import {
  RobotOutlined,
  BarChartOutlined,
  ThunderboltOutlined,
  CalendarOutlined,
  DollarOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons';
import { apiService } from '@/services/api';

const { Title, Text } = Typography;
const { Panel } = Collapse;

interface MLPrediction {
  prediction: number;
  confidence: number;
  probability_ranges?: {
    low: number;
    medium: number;
    high: number;
  };
  feature_importance?: Array<{
    feature: string;
    importance: number;
  }>;
}

interface MLAnalytics {
  project_id: number;
  predictions: {
    completion_time?: MLPrediction;
    budget_variance?: MLPrediction;
    risk_score?: MLPrediction;
  };
  explanations: {
    completion_time?: any;
    budget_variance?: any;
    risk_score?: any;
  };
  generated_at: string;
}

interface ProjectMLAnalyticsProps {
  projectId: number;
  projectName: string;
}

export const ProjectMLAnalytics: React.FC<ProjectMLAnalyticsProps> = ({
  projectId,
  projectName
}) => {
  const [analytics, setAnalytics] = useState<MLAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mlServiceHealth, setMLServiceHealth] = useState<boolean>(false);

  useEffect(() => {
    checkMLService();
  }, []);

  const checkMLService = async () => {
    try {
      const health = await apiService.request({ url: '/ai/health' });
      setMLServiceHealth(health.success);
      if (health.success) {
        message.success('ML Service is online and ready!');
      } else {
        message.error('ML Service is not responding');
      }
    } catch (error) {
      setMLServiceHealth(false);
      message.error('Failed to connect to ML Service');
    }
  };

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('Loading analytics for project:', projectId);
      const response = await apiService.request({ url: `/ai/projects/${projectId}/analytics` });
      console.log('Analytics response:', response);
      console.log('Analytics data:', response.data);
      console.log('Predictions:', response.data?.predictions);
      
      if (response.success) {
        setAnalytics(response.data);
        message.success('AI predictions generated successfully!');
      } else {
        setError(response.error || 'Failed to load analytics');
        message.error('Failed to load predictions: ' + (response.error || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Analytics error:', error);
      setError(error.message || 'Failed to load ML analytics');
      message.error('Failed to load ML predictions: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (score: number) => {
    if (score <= 30) return '#52c41a'; // green
    if (score <= 70) return '#faad14'; // yellow
    return '#f5222d'; // red
  };

  const getRiskLabel = (score: number) => {
    if (score <= 30) return 'Low Risk';
    if (score <= 70) return 'Medium Risk';
    return 'High Risk';
  };

  const formatDays = (days: number) => {
    if (days < 1) return `${Math.round(days * 24)} hours`;
    return `${Math.round(days)} days`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (!mlServiceHealth) {
    return (
      <div style={{ padding: '24px' }}>
        <Alert
          message="ML Service Unavailable"
          description="The AI/ML service is currently offline. Please ensure the ML service is running on port 8001 or contact your administrator."
          type="warning"
          showIcon
          action={
            <Button size="small" onClick={checkMLService}>
              Retry Connection
            </Button>
          }
        />
        <Card style={{ marginTop: '16px' }}>
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <RobotOutlined style={{ fontSize: '48px', color: '#d9d9d9' }} />
            <Title level={4} type="secondary" style={{ marginTop: '16px' }}>
              AI Predictions Unavailable
            </Title>
            <Text type="secondary">
              Start the ML service to get AI-powered project insights including:
            </Text>
            <List
              style={{ marginTop: '16px', textAlign: 'left', maxWidth: '400px', margin: '16px auto' }}
              dataSource={[
                'Project completion time predictions',
                'Budget variance analysis',
                'Risk assessment and scoring',
                'Feature importance explanations'
              ]}
              renderItem={(item) => (
                <List.Item>
                  <CheckCircleOutlined style={{ color: '#1890ff', marginRight: '8px' }} />
                  {item}
                </List.Item>
              )}
            />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <Space align="center">
          <RobotOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
          <Title level={3} style={{ margin: 0 }}>
            AI-Powered Project Analytics
          </Title>
          <Tag color="blue">ML Predictions</Tag>
        </Space>
        <Text type="secondary" style={{ display: 'block', marginTop: '8px' }}>
          Advanced machine learning insights for {projectName}
        </Text>
      </div>

      {/* Action Buttons */}
      <Space style={{ marginBottom: '24px' }}>
        <Button
          type="primary"
          icon={<ThunderboltOutlined />}
          onClick={loadAnalytics}
          loading={loading}
        >
          Generate AI Predictions
        </Button>
        <Button
          icon={<SyncOutlined />}
          onClick={checkMLService}
        >
          Check ML Service
        </Button>
      </Space>

      {error && (
        <Alert
          message="Prediction Error"
          description={error}
          type="error"
          style={{ marginBottom: '24px' }}
          closable
        />
      )}

      {loading && (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
            <div style={{ marginTop: '16px' }}>
              <Text>Analyzing project data with AI models...</Text>
            </div>
          </div>
        </Card>
      )}

      {/* Debug info */}
      {analytics && (
        <Alert
          message="Debug Info"
          description={
            <div>
              <div>Project ID: {analytics.project_id}</div>
              <div>Has predictions: {JSON.stringify(!!analytics.predictions)}</div>
              <div>Completion time: {JSON.stringify(analytics.predictions?.completion_time)}</div>
            </div>
          }
          type="info"
          style={{ marginBottom: '16px' }}
          closable
        />
      )}

      {analytics && !loading && (
        <Row gutter={[24, 24]}>
          {/* Completion Time Prediction */}
          <Col xs={24} md={8}>
            <Card
              title={
                <Space>
                  <CalendarOutlined />
                  <span>Completion Prediction</span>
                  <Tooltip title="AI prediction of when this project will be completed">
                    <QuestionCircleOutlined style={{ color: '#8c8c8c' }} />
                  </Tooltip>
                </Space>
              }
              bordered={false}
              style={{ height: '100%' }}
            >
              {analytics.predictions.completion_time ? (
                <>
                  <Statistic
                    title="Estimated Days to Complete"
                    value={analytics.predictions.completion_time.prediction}
                    precision={1}
                    valueStyle={{ color: '#1890ff', fontSize: '32px' }}
                    suffix="days"
                  />
                  <Progress
                    percent={Math.round(analytics.predictions.completion_time.confidence * 100)}
                    strokeColor="#1890ff"
                    style={{ marginTop: '16px' }}
                    format={(percent) => `${percent}% confidence`}
                  />
                  <div style={{ marginTop: '16px' }}>
                    <Text type="secondary">
                      Predicted completion: {formatDays(analytics.predictions.completion_time.prediction)}
                    </Text>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <Text type="secondary">No completion prediction available</Text>
                </div>
              )}
            </Card>
          </Col>

          {/* Budget Variance Prediction */}
          <Col xs={24} md={8}>
            <Card
              title={
                <Space>
                  <DollarOutlined />
                  <span>Budget Variance</span>
                  <Tooltip title="AI prediction of budget overrun or savings">
                    <QuestionCircleOutlined style={{ color: '#8c8c8c' }} />
                  </Tooltip>
                </Space>
              }
              bordered={false}
              style={{ height: '100%' }}
            >
              {analytics.predictions.budget_variance ? (
                <>
                  <Statistic
                    title="Predicted Budget Variance"
                    value={analytics.predictions.budget_variance.prediction}
                    precision={0}
                    valueStyle={{ 
                      color: analytics.predictions.budget_variance.prediction > 0 ? '#f5222d' : '#52c41a',
                      fontSize: '28px'
                    }}
                    prefix={analytics.predictions.budget_variance.prediction > 0 ? '+' : ''}
                    formatter={(value) => formatCurrency(Number(value))}
                  />
                  <Progress
                    percent={Math.round(analytics.predictions.budget_variance.confidence * 100)}
                    strokeColor={analytics.predictions.budget_variance.prediction > 0 ? '#f5222d' : '#52c41a'}
                    style={{ marginTop: '16px' }}
                    format={(percent) => `${percent}% confidence`}
                  />
                  <div style={{ marginTop: '16px' }}>
                    <Text type="secondary">
                      {analytics.predictions.budget_variance.prediction > 0 ? 'Over budget' : 'Under budget'}
                    </Text>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <Text type="secondary">No budget prediction available</Text>
                </div>
              )}
            </Card>
          </Col>

          {/* Risk Score */}
          <Col xs={24} md={8}>
            <Card
              title={
                <Space>
                  <ExclamationCircleOutlined />
                  <span>Risk Assessment</span>
                  <Tooltip title="AI-powered risk score from 0-100">
                    <QuestionCircleOutlined style={{ color: '#8c8c8c' }} />
                  </Tooltip>
                </Space>
              }
              bordered={false}
              style={{ height: '100%' }}
            >
              {analytics.predictions.risk_score ? (
                <>
                  <Statistic
                    title="Risk Score"
                    value={analytics.predictions.risk_score.prediction}
                    precision={0}
                    valueStyle={{ 
                      color: getRiskColor(analytics.predictions.risk_score.prediction),
                      fontSize: '32px'
                    }}
                    suffix="/100"
                  />
                  <Progress
                    percent={analytics.predictions.risk_score?.prediction || 0}
                    strokeColor={getRiskColor(analytics.predictions.risk_score?.prediction || 0)}
                    style={{ marginTop: '16px' }}
                    format={() => getRiskLabel(analytics.predictions.risk_score?.prediction || 0)}
                  />
                  <div style={{ marginTop: '16px' }}>
                    <Tag color={getRiskColor(analytics.predictions.risk_score?.prediction || 0)}>
                      {getRiskLabel(analytics.predictions.risk_score?.prediction || 0)}
                    </Tag>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <Text type="secondary">No risk assessment available</Text>
                </div>
              )}
            </Card>
          </Col>

          {/* Feature Importance & Explanations */}
          <Col xs={24}>
            <Card title={
              <Space>
                <BarChartOutlined />
                <span>AI Model Explanations</span>
                <Tooltip title="Feature importance and model explanations using SHAP">
                  <QuestionCircleOutlined style={{ color: '#8c8c8c' }} />
                </Tooltip>
              </Space>
            }>
              <Collapse
                items={[
                  ...(analytics.explanations.completion_time ? [{
                    key: 'completion',
                    label: 'Completion Time Factors',
                    children: (
                      <div>
                        <Text type="secondary">Key factors influencing the completion time prediction:</Text>
                        {analytics.explanations.completion_time.explanation?.feature_importance && (
                          <List
                            style={{ marginTop: '16px' }}
                            dataSource={analytics.explanations.completion_time.explanation.feature_importance}
                            renderItem={(item: any) => (
                              <List.Item>
                                <div style={{ width: '100%' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Text strong>{item.feature.replace('_', ' ')}</Text>
                                    <Text>{item.value}</Text>
                                  </div>
                                  <Progress 
                                    percent={Math.round(item.importance * 100)} 
                                    size="small" 
                                    showInfo={false}
                                  />
                                </div>
                              </List.Item>
                            )}
                          />
                        )}
                      </div>
                    )
                  }] : []),
                  
                  ...(analytics.explanations.budget_variance ? [{
                    key: 'budget',
                    label: 'Budget Variance Factors',
                    children: (
                      <div>
                        <Text type="secondary">Key factors influencing budget variance:</Text>
                        {analytics.explanations.budget_variance.explanation?.feature_importance && (
                          <List
                            style={{ marginTop: '16px' }}
                            dataSource={analytics.explanations.budget_variance.explanation.feature_importance}
                            renderItem={(item: any) => (
                              <List.Item>
                                <div style={{ width: '100%' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Text strong>{item.feature.replace('_', ' ')}</Text>
                                    <Text>{item.value}</Text>
                                  </div>
                                  <Progress 
                                    percent={Math.round(item.importance * 100)} 
                                    size="small" 
                                    showInfo={false}
                                    strokeColor="#fa8c16"
                                  />
                                </div>
                              </List.Item>
                            )}
                          />
                        )}
                      </div>
                    )
                  }] : []),
                  
                  ...(analytics.explanations.risk_score ? [{
                    key: 'risk',
                    label: 'Risk Assessment Factors',
                    children: (
                      <div>
                        <Text type="secondary">Key factors contributing to project risk:</Text>
                        {analytics.explanations.risk_score.explanation?.feature_importance && (
                          <List
                            style={{ marginTop: '16px' }}
                            dataSource={analytics.explanations.risk_score.explanation.feature_importance}
                            renderItem={(item: any) => (
                              <List.Item>
                                <div style={{ width: '100%' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Text strong>{item.feature.replace('_', ' ')}</Text>
                                    <Text>{item.value}</Text>
                                  </div>
                                  <Progress 
                                    percent={Math.round(item.importance * 100)} 
                                    size="small" 
                                    showInfo={false}
                                    strokeColor="#f5222d"
                                  />
                                </div>
                              </List.Item>
                            )}
                          />
                        )}
                      </div>
                    )
                  }] : [])
                ]}
              />
            </Card>
          </Col>

          {/* Analytics Metadata */}
          <Col xs={24}>
            <Alert
              message="AI Analytics Generated"
              description={
                <Space>
                  <span>Analysis completed at: {new Date(analytics.generated_at).toLocaleString()}</span>
                  <span>•</span>
                  <span>Project ID: {analytics.project_id}</span>
                  <span>•</span>
                  <span>Models: Completion Time, Budget Variance, Risk Assessment</span>
                </Space>
              }
              type="info"
              showIcon
            />
          </Col>
        </Row>
      )}
    </div>
  );
};