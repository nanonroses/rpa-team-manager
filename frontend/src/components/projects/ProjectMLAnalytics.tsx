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
        message.success("El servicio de analítica está disponible");
      } else {
        message.error("El servicio de analítica no responde");
      }
    } catch (error) {
      setMLServiceHealth(false);
      message.error("No se pudo conectar con el servicio de analítica");
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
        message.success("Predicciones generadas");
      } else {
        setError(response.error || "No se pudo cargar la analítica");
        message.error('No se pudieron cargar las predicciones: ' + (response.error || "Error desconocido"));
      }
    } catch (error: any) {
      console.error('Analytics error:', error);
      setError(error.message || "No se pudo cargar la analítica predictiva");
      message.error('No se pudieron cargar las predicciones: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (score: number) => {
    if (score <= 30) return 'var(--color-success)'; // green
    if (score <= 70) return 'var(--color-warning)'; // yellow
    return 'var(--color-error)'; // red
  };

  const getRiskLabel = (score: number) => {
    if (score <= 30) return "Riesgo bajo";
    if (score <= 70) return "Riesgo medio";
    return "Riesgo alto";
  };

  const formatDays = (days: number) => {
    if (days < 1) return `${Math.round(days * 24)} horas`;
    return `${Math.round(days)} días`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
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
          message="Servicio de analítica no disponible"
          description="El servicio de analítica IA no está disponible. Contacta al administrador."
          type="warning"
          showIcon
          action={
            <Button size="small" onClick={checkMLService}>
              Reintentar conexión
            </Button>
          }
        />
        <Card style={{ marginTop: '16px' }}>
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <RobotOutlined style={{ fontSize: '48px', color: 'var(--color-border)' }} />
            <Title level={4} type="secondary" style={{ marginTop: '16px' }}>
              Predicciones IA no disponibles
            </Title>
            <Text type="secondary">
              
              Activa el servicio de analítica para obtener:
            </Text>
            <List
              style={{ marginTop: '16px', textAlign: 'left', maxWidth: '400px', margin: '16px auto' }}
              dataSource={[
                "Predicciones de fecha de término",
                "Análisis de desviación de presupuesto",
                "Evaluación y puntaje de riesgo",
                "Explicación de los factores relevantes"
              ]}
              renderItem={(item) => (
                <List.Item>
                  <CheckCircleOutlined style={{ color: 'var(--color-info)', marginRight: '8px' }} />
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
          <RobotOutlined style={{ fontSize: '24px', color: 'var(--color-info)' }} />
          <Title level={3} style={{ margin: 0 }}>
            
            Analítica predictiva del proyecto
          </Title>
          <Tag color="blue">Predicciones IA</Tag>
        </Space>
        <Text type="secondary" style={{ display: 'block', marginTop: '8px' }}>
          
          Predicciones y análisis para {projectName}
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
          Generar predicciones
        </Button>
        <Button
          icon={<SyncOutlined />}
          onClick={checkMLService}
        >
          Comprobar servicio de analítica
        </Button>
      </Space>

      {error && (
        <Alert
          message="Error de predicción"
          description={error || "Ocurrió un error desconocido"}
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
              <Text>Analizando los datos del proyecto...</Text>
            </div>
          </div>
        </Card>
      )}

      {analytics && !loading && (
        <Row gutter={[24, 24]}>
          {/* Completion Time Prediction */}
          <Col xs={24} md={8}>
            <Card
              title={
                <Space>
                  <CalendarOutlined />
                  <span>Predicción de término</span>
                  <Tooltip title="Predicción de cuándo se completará el proyecto">
                    <QuestionCircleOutlined style={{ color: 'var(--color-text-muted)' }} />
                  </Tooltip>
                </Space>
              }
              bordered={false}
              style={{ height: '100%' }}
            >
              {analytics.predictions.completion_time ? (
                <>
                  <Statistic
                    title="Días estimados para completar"
                    value={analytics.predictions.completion_time.prediction}
                    precision={1}
                    valueStyle={{ color: 'var(--color-info)', fontSize: '32px' }}
                    suffix="días"
                  />
                  <Progress
                    percent={Math.round(analytics.predictions.completion_time.confidence * 100)}
                    strokeColor="var(--color-info)"
                    style={{ marginTop: '16px' }}
                    format={(percent) => `${percent}% de confianza`}
                  />
                  <div style={{ marginTop: '16px' }}>
                    <Text type="secondary">
                      Término previsto: {formatDays(analytics.predictions.completion_time.prediction)}
                    </Text>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <Text type="secondary">No hay predicción de término disponible</Text>
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
                  <span>Desviación de presupuesto</span>
                  <Tooltip title="Predicción de sobrecostos o ahorros">
                    <QuestionCircleOutlined style={{ color: 'var(--color-text-muted)' }} />
                  </Tooltip>
                </Space>
              }
              bordered={false}
              style={{ height: '100%' }}
            >
              {analytics.predictions.budget_variance ? (
                <>
                  <Statistic
                    title="Desviación de presupuesto prevista"
                    value={analytics.predictions.budget_variance.prediction}
                    precision={0}
                    valueStyle={{ 
                      color: analytics.predictions.budget_variance.prediction > 0 ? 'var(--color-error)' : 'var(--color-success)',
                      fontSize: '28px'
                    }}
                    prefix={analytics.predictions.budget_variance.prediction > 0 ? '+' : ''}
                    formatter={(value) => formatCurrency(Number(value))}
                  />
                  <Progress
                    percent={Math.round(analytics.predictions.budget_variance.confidence * 100)}
                    strokeColor={analytics.predictions.budget_variance.prediction > 0 ? 'var(--color-error)' : 'var(--color-success)'}
                    style={{ marginTop: '16px' }}
                    format={(percent) => `${percent}% de confianza`}
                  />
                  <div style={{ marginTop: '16px' }}>
                    <Text type="secondary">
                      {analytics.predictions.budget_variance.prediction > 0 ? "Sobre el presupuesto" : "Bajo el presupuesto"}
                    </Text>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <Text type="secondary">No hay predicción de presupuesto disponible</Text>
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
                  <span>Evaluación de riesgo</span>
                  <Tooltip title="Puntaje predictivo de riesgo de 0 a 100">
                    <QuestionCircleOutlined style={{ color: 'var(--color-text-muted)' }} />
                  </Tooltip>
                </Space>
              }
              bordered={false}
              style={{ height: '100%' }}
            >
              {analytics.predictions.risk_score ? (
                <>
                  <Statistic
                    title="Puntaje de riesgo"
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
                  <Text type="secondary">No hay evaluación de riesgo disponible</Text>
                </div>
              )}
            </Card>
          </Col>

          {/* Feature Importance & Explanations */}
          <Col xs={24}>
            <Card title={
              <Space>
                <BarChartOutlined />
                <span>Explicación de los modelos</span>
                <Tooltip title="Importancia de los factores y explicación del modelo con SHAP">
                  <QuestionCircleOutlined style={{ color: 'var(--color-text-muted)' }} />
                </Tooltip>
              </Space>
            }>
              <Collapse
                items={[
                  ...(analytics.explanations.completion_time ? [{
                    key: 'completion',
                    label: "Factores de la fecha de término",
                    children: (
                      <div>
                        <Text type="secondary">Factores principales de la predicción de término:</Text>
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
                    label: "Factores de desviación de presupuesto",
                    children: (
                      <div>
                        <Text type="secondary">Factores principales de desviación del presupuesto:</Text>
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
                                    strokeColor="var(--color-warning)"
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
                    label: "Factores de riesgo",
                    children: (
                      <div>
                        <Text type="secondary">Factores principales del riesgo del proyecto:</Text>
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
                                    strokeColor="var(--color-error)"
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
              message="Analítica IA generada"
              description={
                <Space>
                  <span>Análisis completado el: {new Date(analytics.generated_at).toLocaleString()}</span>
                  <span>•</span>
                  <span>ID del proyecto: {analytics.project_id}</span>
                  <span>•</span>
                  <span>Modelos: fecha de término, desviación de presupuesto y riesgo</span>
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
