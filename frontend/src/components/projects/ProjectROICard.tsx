import React, { useEffect, useState } from 'react';
import { Card, Statistic, Row, Col, Tag, Progress, Divider, Space, Typography, Alert } from 'antd';
import {
  DollarOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { apiService } from '@/services/api';
import { useAuthStore } from '@/store/authStore';

const { Text } = Typography;

interface ProjectROIData {
  project_id: number;
  project_name: string;
  
  // BASIC PARAMETERS
  planned_hours: number;
  financial_data_complete?: boolean;
  missing_financial_data?: string[];
  planned_hours_source?: 'budget' | 'tasks' | 'missing';
  real_hours: number;
  real_hours_source: 'approved' | 'projected';
  approved_hours: number;
  client_delay_hours: number;
  hourly_rate_uf: number;
  uf_value_clp: number;
  engineer_hourly_cost: number;
  
  // FINANCIAL RESULTS
  sale_price: number;
  planned_cost: number;
  real_cost: number;
  planned_profit: number;
  real_profit: number;
  
  // ROI METRICS
  planned_roi: number;
  real_roi: number;
  
  // CLIENT IMPACT
  delay_impact: number;
  lost_profit: number;
  
  // ALERTS
  alerts: Array<{
    type: string;
    level: string;
    message: string;
    impact: string;
  }>;
}

interface ProjectROICardProps {
  projectId: number;
  projectName: string;
  assignedUserId?: number;
}

export const ProjectROICard: React.FC<ProjectROICardProps> = ({
  projectId,
  projectName
}) => {
  const [roiData, setRoiData] = useState<ProjectROIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setUserCosts] = useState<any[]>([]);
  const { user } = useAuthStore();

  useEffect(() => {
    if (user?.role === 'team_lead') {
      loadROIData();
      loadUserCosts();
    }
  }, [projectId, user]);

  const loadROIData = async () => {
    try {
      setLoading(true);
      const data = await apiService.getProjectROI(projectId);
      setRoiData(data);
    } catch (error) {
      console.error('Failed to load ROI data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserCosts = async () => {
    try {
      const costs = await apiService.getUserCosts();
      setUserCosts(costs);
    } catch (error) {
      console.error('Failed to load user costs:', error);
    }
  };

  // Hay dato real si ya existen horas aprobadas (Fase 3) o atraso atribuible al cliente.
  const hasClientDelays = (roiData?.client_delay_hours ?? 0) > 0;
  const shouldShowReal = hasClientDelays || roiData?.real_hours_source === 'approved';
  
  // Get the appropriate values to display
  const getDisplayValues = () => {
    if (!roiData) return null;
    
    return {
      hours: shouldShowReal ? roiData.real_hours : roiData.planned_hours,
      cost: shouldShowReal ? roiData.real_cost : roiData.planned_cost,
      profit: shouldShowReal ? roiData.real_profit : roiData.planned_profit,
      roi: shouldShowReal ? roiData.real_roi : roiData.planned_roi,
      costLabel: shouldShowReal ? "Costo Real" : "Costo Planificado",
      profitLabel: shouldShowReal ? "Ganancia Real" : "Ganancia Planificada",
      roiLabel: shouldShowReal ? "ROI Real" : "ROI Planificado",
      hoursLabel: shouldShowReal ? "Horas Reales" : "Horas Planificadas"
    };
  };

  const getROIColor = (roi: number) => {
    if (roi >= 30) return 'var(--color-success)'; // Green
    if (roi >= 15) return 'var(--color-warning)'; // Orange  
    return 'var(--color-error)'; // Red
  };

  const getROIStatus = (roi: number) => {
    if (roi >= 30) return { text: 'Excelente', color: 'var(--color-success)' };
    if (roi >= 15) return { text: 'Bueno', color: 'var(--color-warning)' };
    return { text: 'Riesgo', color: 'var(--color-error)' };
  };

  if (!user || user.role !== 'team_lead') {
    return null; // Solo team_lead puede ver métricas financieras
  }

  if (loading) {
    return (
      <Card title={`💰 Rentabilidad - ${projectName}`} loading={true} />
    );
  }

  if (!roiData) {
    return (
      <Card title={`💰 Rentabilidad - ${projectName}`}>
        <Alert
          message="Datos financieros no configurados"
          description="Configure el precio de venta y las horas presupuestadas para ver métricas de rentabilidad."
          type="warning"
          showIcon
        />
      </Card>
    );
  }

  const displayValues = getDisplayValues();
  if (!displayValues) return null;
  
  const incomplete = roiData.financial_data_complete === false;
  const status = incomplete ? { text: 'Sin configurar', color: 'default' } : getROIStatus(displayValues.roi);

  return (
    <Card 
      title={
        <Space>
          <DollarOutlined style={{ color: 'var(--color-info)' }} />
          <span>💰 Rentabilidad - {projectName}</span>
          <Tag color={status.color}>{status.text}</Tag>
        </Space>
      }
    >
      {incomplete && <Alert style={{ marginBottom: 16 }} type="warning" showIcon
        message="Rentabilidad pendiente de configuración"
        description={`Falta configurar: ${roiData.missing_financial_data?.join(', ') || 'horas y costos'}. El precio de venta no equivale a la ganancia.`} />}
      {/* Métricas Principales */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Statistic
            title="Precio de Venta"
            value={roiData.sale_price}
            prefix="$"
            formatter={(value) => `${Number(value).toLocaleString('es-CL')}`} 
            valueStyle={{ color: 'var(--color-info)' }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title={displayValues.costLabel}
            value={displayValues.cost}
            prefix="$"
            formatter={(value) => incomplete ? 'Por definir' : Number(value).toLocaleString('es-CL')}
            valueStyle={{ color: 'var(--color-warning)' }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title={displayValues.profitLabel}
            value={displayValues.profit}
            prefix="$"
            formatter={(value) => incomplete ? 'Por definir' : Number(value).toLocaleString('es-CL')}
            valueStyle={{ 
              color: displayValues.profit > 0 ? 'var(--color-success)' : 'var(--color-error)' 
            }}
          />
        </Col>
      </Row>

      {/* ROI y Progreso */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card type="inner" size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>{displayValues.roiLabel}</Text>
              <Progress
                type="circle"
                size={80}
                percent={incomplete ? 0 : Math.max(0, Math.min(100, displayValues.roi))}
                format={() => incomplete ? 'N/D' : `${displayValues.roi}%`}
                strokeColor={incomplete ? 'var(--color-border)' : getROIColor(displayValues.roi)}
              />
            </Space>
          </Card>
        </Col>
        <Col span={12}>
          <Card type="inner" size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>{displayValues.hoursLabel}</Text>
              <Statistic
                value={displayValues.hours}
                formatter={(value) => roiData.planned_hours > 0 ? String(value) : 'Por definir'}
                suffix={shouldShowReal && roiData.planned_hours > 0 ? `/ ${roiData.planned_hours} h` : roiData.planned_hours > 0 ? 'h' : undefined}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ fontSize: 20 }}
              />
              {shouldShowReal && roiData.planned_hours > 0 && (
                <Progress
                  percent={Math.round((displayValues.hours / roiData.planned_hours) * 100)}
                  size="small"
                  status={displayValues.hours > roiData.planned_hours ? 'exception' : 'active'}
                />
              )}
              {roiData.client_delay_hours > 0 && (
                <Text type="warning" style={{ fontSize: 12 }}>
                  +{roiData.client_delay_hours}h demora cliente
                </Text>
              )}
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Alertas */}
      {roiData.alerts && roiData.alerts.length > 0 && (
        <>
          <Divider>Alertas</Divider>
          <Space direction="vertical" style={{ width: '100%' }}>
            {roiData.alerts.map((alert, index) => (
              <Alert
                key={index}
                message={alert.message}
                type={
                  alert.level === 'critical' ? 'error' : 
                  alert.level === 'warning' ? 'warning' : 
                  alert.level === 'success' ? 'success' : 'info'
                }
                showIcon
                icon={
                  alert.level === 'critical' ? 
                    <ExclamationCircleOutlined /> : 
                  alert.level === 'success' ? 
                    <CheckCircleOutlined /> :
                    <ExclamationCircleOutlined />
                }
              />
            ))}
          </Space>
        </>
      )}

      {/* Indicadores de Status */}
      {!incomplete && <>
      <Divider>Indicadores</Divider>
      <Row gutter={16}>
        <Col span={8}>
          <Space>
            {displayValues.roi >= 20 ? <CheckCircleOutlined style={{ color: 'var(--color-success)' }} /> : <ExclamationCircleOutlined style={{ color: 'var(--color-error)' }} />}
            <Text>Rentabilidad</Text>
          </Space>
        </Col>
        <Col span={8}>
          <Space>
            {displayValues.hours <= roiData.planned_hours ? <CheckCircleOutlined style={{ color: 'var(--color-success)' }} /> : <ExclamationCircleOutlined style={{ color: 'var(--color-error)' }} />}
            <Text>Tiempo</Text>
          </Space>
        </Col>
        <Col span={8}>
          <Space>
            {displayValues.profit > 0 ? <CheckCircleOutlined style={{ color: 'var(--color-success)' }} /> : <ExclamationCircleOutlined style={{ color: 'var(--color-error)' }} />}
            <Text>Margen</Text>
          </Space>
        </Col>
      </Row>

      </>}
      {/* Info adicional */}
      {!shouldShowReal ? (
        <Alert
          style={{ marginTop: 16 }}
          message="Cálculo Planificado"
          description="Los valores mostrados son cálculos planificados basados en las horas y costos presupuestados inicialmente."
          type="info"
          showIcon
          closable
        />
      ) : hasClientDelays ? (
        <Alert
          style={{ marginTop: 16 }}
          message="Impacto de Demoras del Cliente"
          description={`Las demoras del cliente han generado ${roiData.client_delay_hours} horas adicionales, impactando el costo en $${roiData.delay_impact.toLocaleString()} y reduciendo la ganancia en $${roiData.lost_profit.toLocaleString()}.`}
          type="warning"
          showIcon
          closable
        />
      ) : <Alert style={{ marginTop: 16 }} type="info" showIcon message="Costo de horas aprobadas" description="El costo real corresponde a las horas aprobadas hasta la fecha; puede ser parcial mientras el proyecto está en ejecución." />}
    </Card>
  );
};