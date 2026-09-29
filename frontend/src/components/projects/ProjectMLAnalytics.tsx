import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Typography,
  Spin,
  Progress,
  Statistic,
  Tag,
  Space,
  List,
  Select,
  Divider,
  Empty,
  Badge,
  App
} from 'antd';
import {
  RobotOutlined,
  ThunderboltOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  StopOutlined,
  CopyOutlined,
  CheckOutlined,
  FlagOutlined,
  FileTextOutlined,
  AimOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { apiService } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { SkillConfigModal } from './SkillConfigModal';

const { Title, Text, Paragraph } = Typography;

export interface ProjectReviewBottleneck {
  title: string;
  description: string;
  severity: 'alta' | 'media' | 'baja';
  mitigation: string;
}

export interface ProjectReviewRecommendation {
  action: string;
  priority: 'alta' | 'media' | 'baja';
  area: 'Técnica' | 'Gestión' | 'Cliente' | 'Financiera' | string;
  expected_outcome: string;
}

export interface ProjectReviewKPIs {
  total_tasks: number;
  completed_tasks: number;
  blocked_tasks: number;
  progress_percentage: number;
  hours_budgeted: number;
  hours_spent: number;
  days_remaining: number | null;
  is_overdue: boolean;
  milestones_total: number;
  milestones_completed: number;
}

export interface ProjectReviewMetadata {
  source: 'llm_service' | 'rule_based_engine' | string;
  model_used?: string;
  provider?: string;
  analyzed_at: string;
  skill_name: string;
  skill_version: string;
}

export interface ProjectReviewResult {
  project_id: number;
  project_name: string;
  client_name: string | null;
  health_status: 'saludable' | 'en_riesgo' | 'critico';
  health_score: number;
  summary: string;
  schedule_assessment: string;
  budget_assessment: string;
  bottlenecks: ProjectReviewBottleneck[];
  recommendations: ProjectReviewRecommendation[];
  client_report_draft: string;
  kpis: ProjectReviewKPIs;
  metadata: ProjectReviewMetadata;
}

interface ProjectMLAnalyticsProps {
  projectId: number;
  projectName: string;
}

export const ProjectMLAnalytics: React.FC<ProjectMLAnalyticsProps> = ({
  projectId,
  projectName
}) => {
  const { message } = App.useApp();
  const { user } = useAuthStore();
  const canEditSkill = user?.role === 'team_lead' || (user as any)?.role === 'admin';

  const [review, setReview] = useState<ProjectReviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>('auto');
  const [lastAnalyzed, setLastAnalyzed] = useState<string | null>(null);
  const [configModalVisible, setConfigModalVisible] = useState(false);

  useEffect(() => {
    const cached = localStorage.getItem(`rpa_project_review_${projectId}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setReview(parsed);
        setLastAnalyzed(parsed.metadata?.analyzed_at || null);
      } catch (e) {
        console.warn('Failed to parse cached review:', e);
      }
    }
  }, [projectId]);

  const executeReview = async (providerOverride?: string) => {
    setLoading(true);
    try {
      const provider = (providerOverride || selectedProvider) === 'auto' ? undefined : (providerOverride || selectedProvider);
      const response = await apiService.reviewProjectWithSkill(projectId, provider);

      if (response && response.success && response.data) {
        const reviewData: ProjectReviewResult = response.data;
        setReview(reviewData);
        setLastAnalyzed(reviewData.metadata?.analyzed_at || new Date().toISOString());
        localStorage.setItem(`rpa_project_review_${projectId}`, JSON.stringify(reviewData));

        const sourceLabel = reviewData.metadata?.provider
          ? `IA (${reviewData.metadata.provider})`
          : reviewData.metadata?.source === 'rule_based_engine'
            ? 'Motor de Reglas RPA'
            : 'IA';

        message.success(`Revisión completada exitosamente vía ${sourceLabel}`);
      } else {
        message.error(response?.error || 'No se pudo generar la revisión del proyecto');
      }
    } catch (err: any) {
      console.error('Error running project review skill:', err);
      const errMsg = err?.response?.data?.error || err?.message || 'Error de conexión al ejecutar la revisión';
      message.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyReport = () => {
    if (!review?.client_report_draft) return;
    navigator.clipboard.writeText(review.client_report_draft).then(() => {
      setCopied(true);
      message.success('¡Borrador de reporte copiado al portapapeles!');
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {
      message.error('No se pudo copiar automáticamente. Por favor selecciónalo manualmente.');
    });
  };

  const getHealthBadge = (status: 'saludable' | 'en_riesgo' | 'critico') => {
    switch (status) {
      case 'saludable':
        return <Tag color="success" style={{ fontSize: '13px', padding: '4px 10px' }}><CheckCircleOutlined /> Proyecto Saludable</Tag>;
      case 'en_riesgo':
        return <Tag color="warning" style={{ fontSize: '13px', padding: '4px 10px' }}><WarningOutlined /> En Riesgo</Tag>;
      case 'critico':
        return <Tag color="error" style={{ fontSize: '13px', padding: '4px 10px' }}><StopOutlined /> Estado Crítico</Tag>;
      default:
        return <Tag color="default">Desconocido</Tag>;
    }
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return '#52c41a';
    if (score >= 60) return '#faad14';
    return '#f5222d';
  };

  const getSeverityTag = (severity: 'alta' | 'media' | 'baja') => {
    switch (severity) {
      case 'alta':
        return <Tag color="error">Severidad Alta</Tag>;
      case 'media':
        return <Tag color="warning">Severidad Media</Tag>;
      case 'baja':
        return <Tag color="blue">Severidad Baja</Tag>;
      default:
        return <Tag>{severity}</Tag>;
    }
  };

  const getAreaTag = (area: string) => {
    const map: Record<string, string> = {
      'Técnica': 'purple',
      'Gestión': 'cyan',
      'Cliente': 'blue',
      'Financiera': 'green'
    };
    return <Tag color={map[area] || 'geekblue'}>{area}</Tag>;
  };

  return (
    <div style={{ padding: '8px 0 24px 0' }}>
      {/* Skill Banner & Header */}
      <Card className="ai-reviewer-card">
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col xs={24} md={14}>
            <Space align="center" size="middle" wrap>
              <div className="ai-reviewer-icon-wrapper">
                <RobotOutlined />
              </div>
              <div>
                <Space align="center">
                  <Title level={4} style={{ margin: 0 }}>
                    Revisor IA de Proyecto RPA
                  </Title>
                  <Tag color="geekblue" icon={<SafetyCertificateOutlined />}>
                    Skill Estandarizada
                  </Tag>
                </Space>
                <Paragraph type="secondary" style={{ margin: '4px 0 0 0' }}>
                  Auditoría inteligente del estado real de {projectName}: detecta cuellos de botella, evalúa riesgos y redacta reportes ejecutivos.
                </Paragraph>
              </div>
            </Space>
          </Col>

          <Col xs={24} md={10} style={{ textAlign: 'right' }}>
            <Space wrap>
              <Select
                value={selectedProvider}
                onChange={(val) => setSelectedProvider(val)}
                style={{ width: 170 }}
                options={[
                  { value: 'auto', label: '🤖 Motor Automático' },
                  { value: 'gemini', label: '✨ Google Gemini' },
                  { value: 'openai', label: '⚡ OpenAI GPT' },
                  { value: 'claude', label: '🧠 Anthropic Claude' },
                  { value: 'deepseek', label: '🔮 DeepSeek' }
                ]}
              />

              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                loading={loading}
                onClick={() => executeReview()}
                size="large"
              >
                {review ? 'Re-auditar Proyecto' : 'Ejecutar Revisión IA'}
              </Button>

              {canEditSkill && (
                <Button
                  icon={<SettingOutlined />}
                  onClick={() => setConfigModalVisible(true)}
                  size="large"
                >
                  Configurar Skill
                </Button>
              )}
            </Space>

            {lastAnalyzed && (
              <div style={{ marginTop: '8px' }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Última auditoría: {new Date(lastAnalyzed).toLocaleString()}
                </Text>
                {review?.metadata && (
                  <Tag style={{ marginLeft: 8 }} color="default">
                    {review.metadata.provider
                      ? `${review.metadata.provider.toUpperCase()} (${review.metadata.model_used || 'default'})`
                      : review.metadata.skill_name}
                  </Tag>
                )}
              </div>
            )}
          </Col>
        </Row>
      </Card>

      {/* Loading State */}
      {loading && (
        <Card style={{ marginBottom: 20, textAlign: 'center', padding: '40px 20px' }}>
          <Spin size="large" />
          <Title level={5} style={{ marginTop: 16 }}>
            El Revisor IA está auditando el proyecto...
          </Title>
          <Text type="secondary">
            Analizando tareas, hitos, horas registradas, dependencias y tiempos de entrega para generar diagnóstico y plan de acción.
          </Text>
        </Card>
      )}

      {/* Initial Empty State (if no review yet and not loading) */}
      {!review && !loading && (
        <Card style={{ textAlign: 'center', padding: '40px 20px' }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div>
                <Title level={4} style={{ marginBottom: 8 }}>
                  Aún no se ha ejecutado la revisión de este proyecto
                </Title>
                <Paragraph type="secondary" style={{ maxWidth: 540, margin: '0 auto 20px' }}>
                  Presiona el botón a continuación para que la Skill de Revisión IA inspeccione el tablero de tareas, cronograma, horas invertidas y redacte un informe ejecutivo listo para el cliente.
                </Paragraph>
              </div>
            }
          >
            <Button
              type="primary"
              size="large"
              icon={<ThunderboltOutlined />}
              onClick={() => executeReview()}
            >
              Comenzar Revisión del Proyecto
            </Button>
          </Empty>

          <Divider style={{ margin: '32px 0 24px 0' }} />

          <Row gutter={[24, 16]} style={{ textAlign: 'left', maxWidth: 900, margin: '0 auto' }}>
            <Col xs={24} sm={12} md={6}>
              <Space direction="vertical" size={4}>
                <Text strong><AimOutlined style={{ color: '#1677ff' }} /> Diagnóstico Real</Text>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Índice de salud de 0 a 100 basado en avance real de tareas e hitos.
                </Text>
              </Space>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Space direction="vertical" size={4}>
                <Text strong><WarningOutlined style={{ color: '#faad14' }} /> Cuellos de Botella</Text>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Detección proactiva de tareas bloqueadas, desvíos y retrasos.
                </Text>
              </Space>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Space direction="vertical" size={4}>
                <Text strong><RocketOutlined style={{ color: '#52c41a' }} /> Plan de Acción</Text>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Recomendaciones tácticas priorizadas para Team Lead y desarrolladores.
                </Text>
              </Space>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Space direction="vertical" size={4}>
                <Text strong><FileTextOutlined style={{ color: '#722ed1' }} /> Reporte al Cliente</Text>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Borrador profesional formateado listo para copiar a WhatsApp o email.
                </Text>
              </Space>
            </Col>
          </Row>
        </Card>
      )}

      {/* Main Review Results */}
      {review && !loading && (
        <>
          {/* Key Execution Metrics Strip */}
          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            <Col xs={12} sm={8} lg={4}>
              <Card size="small">
                <Statistic
                  title="Progreso Real"
                  value={review.kpis.progress_percentage}
                  precision={0}
                  suffix="%"
                  valueStyle={{ color: '#1677ff' }}
                  prefix={<Progress type="circle" percent={review.kpis.progress_percentage} width={28} showInfo={false} />}
                />
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {review.kpis.completed_tasks} de {review.kpis.total_tasks} tareas
                </Text>
              </Card>
            </Col>

            <Col xs={12} sm={8} lg={5}>
              <Card size="small">
                <Statistic
                  title="Horas Invertidas"
                  value={review.kpis.hours_spent}
                  suffix={review.kpis.hours_budgeted > 0 ? `/ ${review.kpis.hours_budgeted}h` : 'h'}
                  prefix={<ClockCircleOutlined />}
                  valueStyle={{ color: '#fa8c16' }}
                />
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {review.kpis.hours_budgeted > 0
                    ? `${Math.round((review.kpis.hours_spent / review.kpis.hours_budgeted) * 100)}% del presupuesto`
                    : 'Sin presupuesto asignado'}
                </Text>
              </Card>
            </Col>

            <Col xs={12} sm={8} lg={5}>
              <Card size="small">
                <Statistic
                  title="Cronograma / Entrega"
                  value={
                    review.kpis.is_overdue
                      ? 'Atrasado'
                      : review.kpis.days_remaining !== null
                        ? `${review.kpis.days_remaining} días`
                        : 'Sin fecha límite'
                  }
                  valueStyle={{
                    color: review.kpis.is_overdue
                      ? '#f5222d'
                      : review.kpis.days_remaining !== null && review.kpis.days_remaining < 7
                        ? '#faad14'
                        : '#52c41a',
                    fontSize: '18px'
                  }}
                  prefix={<CalendarOutlined />}
                />
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {review.kpis.is_overdue ? 'Plazo límite excedido' : 'Tiempo estimado restante'}
                </Text>
              </Card>
            </Col>

            <Col xs={12} sm={8} lg={5}>
              <Card size="small">
                <Statistic
                  title="Bloqueos Activos"
                  value={review.kpis.blocked_tasks}
                  valueStyle={{
                    color: review.kpis.blocked_tasks > 0 ? '#f5222d' : '#52c41a'
                  }}
                  prefix={review.kpis.blocked_tasks > 0 ? <StopOutlined /> : <CheckCircleOutlined />}
                />
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {review.kpis.blocked_tasks > 0 ? 'Requieren intervención' : 'Flujo de trabajo limpio'}
                </Text>
              </Card>
            </Col>

            <Col xs={12} sm={8} lg={5}>
              <Card size="small">
                <Statistic
                  title="Hitos Cumplidos"
                  value={review.kpis.milestones_completed}
                  suffix={`/ ${review.kpis.milestones_total}`}
                  prefix={<FlagOutlined />}
                  valueStyle={{ color: '#722ed1' }}
                />
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Entregables formalizados
                </Text>
              </Card>
            </Col>
          </Row>

          {/* Row 1: Executive Diagnostic & Bottlenecks */}
          <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
            {/* Executive Health Diagnostic */}
            <Col xs={24} lg={12}>
              <Card
                title={
                  <Space>
                    <SafetyCertificateOutlined style={{ color: '#1677ff' }} />
                    <span>Diagnóstico Ejecutivo de Salud</span>
                  </Space>
                }
                extra={getHealthBadge(review.health_status)}
                style={{ height: '100%' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                  <Progress
                    type="dashboard"
                    percent={review.health_score}
                    strokeColor={getHealthScoreColor(review.health_score)}
                    size={90}
                    format={(percent) => (
                      <span style={{ fontSize: 18, fontWeight: 'bold' }}>
                        {percent}<span style={{ fontSize: 11, fontWeight: 'normal' }}>/100</span>
                      </span>
                    )}
                  />
                  <div style={{ marginLeft: 20, flex: 1 }}>
                    <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 4 }}>
                      Estado del Proyecto: {review.health_status.toUpperCase()}
                    </Text>
                    <Paragraph style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 13, lineHeight: '1.5' }}>
                      {review.summary}
                    </Paragraph>
                  </div>
                </div>

                <Divider style={{ margin: '14px 0' }} />

                <div style={{ marginBottom: 10 }}>
                  <Text strong style={{ fontSize: 13 }}>
                    📅 Evaluación del Cronograma:
                  </Text>
                  <Paragraph style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                    {review.schedule_assessment}
                  </Paragraph>
                </div>

                <div>
                  <Text strong style={{ fontSize: 13 }}>
                    💰 Evaluación del Presupuesto y Esfuerzo:
                  </Text>
                  <Paragraph style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                    {review.budget_assessment}
                  </Paragraph>
                </div>
              </Card>
            </Col>

            {/* Bottlenecks and Critical Points */}
            <Col xs={24} lg={12}>
              <Card
                title={
                  <Space>
                    <WarningOutlined style={{ color: review.bottlenecks?.length > 0 ? '#faad14' : '#52c41a' }} />
                    <span>Cuellos de Botella y Puntos Críticos</span>
                    <Badge count={review.bottlenecks?.length || 0} style={{ backgroundColor: review.bottlenecks?.length > 0 ? '#f5222d' : '#52c41a' }} />
                  </Space>
                }
                style={{ height: '100%' }}
              >
                {!review.bottlenecks || review.bottlenecks.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '36px 16px' }}>
                    <CheckCircleOutlined style={{ fontSize: 42, color: '#52c41a', marginBottom: 12 }} />
                    <Title level={5} style={{ margin: 0, color: '#52c41a' }}>
                      Sin Cuellos de Botella Activos
                    </Title>
                    <Text type="secondary" style={{ marginTop: 6, display: 'block', fontSize: 13 }}>
                      No se detectaron tareas bloqueadas ni retrasos críticos que comprometan el avance inmediato.
                    </Text>
                  </div>
                ) : (
                  <List
                    itemLayout="vertical"
                    size="small"
                    dataSource={review.bottlenecks}
                    renderItem={(item) => (
                      <List.Item
                        key={item.title}
                        className="ai-reviewer-bottleneck-card"
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                          <Text strong style={{ fontSize: 14 }}>
                            {item.title}
                          </Text>
                          {getSeverityTag(item.severity)}
                        </div>
                        <Paragraph style={{ margin: '0 0 8px 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                          {item.description}
                        </Paragraph>
                        <div className="ai-reviewer-mitigation-box">
                          <Text style={{ fontSize: 12 }}>
                            <strong>Mitigación sugerida:</strong> {item.mitigation}
                          </Text>
                        </div>
                      </List.Item>
                    )}
                  />
                )}
              </Card>
            </Col>
          </Row>

          {/* Row 2: Action Plan & Client Report Draft */}
          <Row gutter={[20, 20]}>
            {/* Recommended Action Plan */}
            <Col xs={24} lg={12}>
              <Card
                title={
                  <Space>
                    <RocketOutlined style={{ color: '#52c41a' }} />
                    <span>Plan de Acción Táctico Recomendado</span>
                  </Space>
                }
                style={{ height: '100%' }}
              >
                <List
                  itemLayout="horizontal"
                  dataSource={review.recommendations || []}
                  renderItem={(item, index) => (
                    <List.Item style={{ padding: '12px 0' }}>
                      <List.Item.Meta
                        avatar={
                          <div className="ai-reviewer-action-number">
                            {index + 1}
                          </div>
                        }
                        title={
                          <Space size={6} wrap>
                            <Text strong style={{ fontSize: 13 }}>{item.action}</Text>
                            {getAreaTag(item.area)}
                            <Tag color={item.priority === 'alta' ? 'red' : item.priority === 'media' ? 'orange' : 'default'}>
                              Prioridad {item.priority}
                            </Tag>
                          </Space>
                        }
                        description={
                          <div style={{ marginTop: 4 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              <strong>Resultado esperado:</strong> {item.expected_outcome}
                            </Text>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Card>
            </Col>

            {/* Client-Ready Status Report Draft */}
            <Col xs={24} lg={12}>
              <Card
                title={
                  <Space>
                    <FileTextOutlined style={{ color: '#722ed1' }} />
                    <span>Borrador de Reporte para el Cliente</span>
                  </Space>
                }
                extra={
                  <Button
                    type="primary"
                    ghost
                    icon={copied ? <CheckOutlined /> : <CopyOutlined />}
                    onClick={handleCopyReport}
                    style={{ borderColor: '#722ed1', color: '#722ed1' }}
                  >
                    {copied ? '¡Copiado!' : 'Copiar Reporte'}
                  </Button>
                }
                style={{ height: '100%' }}
              >
                <div style={{ marginBottom: 12 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Este borrador formal está redactado y listo para copiar y enviar al cliente (vía WhatsApp o Correo):
                  </Text>
                </div>

                <div className="ai-reviewer-report-box">
                  {review.client_report_draft}
                </div>

                <div style={{ marginTop: 12, textAlign: 'right' }}>
                  <Button
                    type="default"
                    icon={copied ? <CheckOutlined /> : <CopyOutlined />}
                    onClick={handleCopyReport}
                    size="small"
                  >
                    {copied ? '¡Texto Copiado!' : 'Copiar al Portapapeles'}
                  </Button>
                </div>
              </Card>
            </Col>
          </Row>
        </>
      )}

      {canEditSkill && (
        <SkillConfigModal
          visible={configModalVisible}
          onClose={() => setConfigModalVisible(false)}
          onConfigSaved={(_savedConfig) => {
            message.info('Directivas de la Skill actualizadas. Puedes re-auditar el proyecto cuando desees.');
          }}
        />
      )}
    </div>
  );
};
