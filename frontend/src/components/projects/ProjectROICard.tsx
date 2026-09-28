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
  projected_cost?: number;
  projected_hours?: number;
  planned_profit: number;
  real_profit: number;
  projected_profit?: number;
  
  // MARGINS & ROI
  planned_margin_percentage?: number;
  real_margin_percentage?: number;
  projected_margin_percentage?: number;
  planned_roi: number;
  real_roi: number;
  projected_roi?: number;
  
  // CLIENT & VARIANCE IMPACT
  delay_impact: number;
  lost_profit: number;
  variance_impact?: number;
  
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
    if (roi >= 30) return '#52c41a'; // Green
    if (roi >= 15) return '#faad14'; // Orange  
    return '#f5222d'; // Red
  };

  const getROIStatus = (roi: number) => {
    if (roi >= 30) return { text: 'Excelente', color: '#52c41a' };
    if (roi >= 15) return { text: 'Bueno', color: '#faad14' };
    return { text: 'Riesgo', color: '#f5222d' };
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
  
  const status = getROIStatus(displayValues.roi);

  const projectedCost = roiData.projected_cost ?? (shouldShowReal ? roiData.real_cost : roiData.planned_cost);
  const projectedProfit = roiData.projected_profit ?? (shouldShowReal ? roiData.real_profit : roiData.planned_profit);
  const projectedHours = roiData.projected_hours ?? (shouldShowReal ? roiData.real_hours : roiData.planned_hours);
  const projectedMarginPct = roiData.projected_margin_percentage ?? (roiData.sale_price > 0 ? Math.round(((projectedProfit / roiData.sale_price) * 100) * 100) / 100 : 0);
  const plannedMarginPct = roiData.planned_margin_percentage ?? (roiData.sale_price > 0 ? Math.round(((roiData.planned_profit / roiData.sale_price) * 100) * 100) / 100 : 0);
  const projectedROI = roiData.projected_roi ?? (shouldShowReal ? roiData.real_roi : roiData.planned_roi);
  const varianceImpact = roiData.variance_impact ?? (roiData.planned_profit - projectedProfit);

  return (
    <Card 
      title={
        <Space wrap>
          <DollarOutlined style={{ color: '#1890ff' }} />
          <span>💰 Rentabilidad - {projectName}</span>
          <Tag color={status.color}>{status.text}</Tag>
          {varianceImpact > 0 && (
            <Tag color="volcano">Desvío: -${varianceImpact.toLocaleString()}</Tag>
          )}
          {varianceImpact < 0 && (
            <Tag color="green">Ahorro: +${Math.abs(varianceImpact).toLocaleString()}</Tag>
          )}
        </Space>
      }
    >
      {/* Métricas Principales */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Statistic
            title="Precio de Venta"
            value={roiData.sale_price}
            prefix="$"
            formatter={(value) => `${Number(value).toLocaleString()}`}
            valueStyle={{ color: '#1890ff' }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title={displayValues.costLabel}
            value={displayValues.cost}
            prefix="$"
            formatter={(value) => `${Number(value).toLocaleString()}`}
            valueStyle={{ color: '#fa8c16' }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title={displayValues.profitLabel}
            value={displayValues.profit}
            prefix="$"
            formatter={(value) => `${Number(value).toLocaleString()}`}
            valueStyle={{ 
              color: displayValues.profit > 0 ? '#52c41a' : '#f5222d' 
            }}
          />
        </Col>
      </Row>

      {/* Proyección al Término & Desvío Económico (Fase 6C) */}
      <Divider style={{ margin: '12px 0' }}>Proyección al Término & Desvío Económico</Divider>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card type="inner" size="small" style={{ height: '100%' }}>
            <Statistic
              title="Costo Proyectado"
              value={projectedCost}
              prefix="$"
              formatter={(value) => `${Number(value).toLocaleString()}`}
              valueStyle={{ color: projectedCost > roiData.planned_cost ? '#cf1322' : '#3f8600' }}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
              <div>Planificado: <strong>${roiData.planned_cost.toLocaleString()}</strong> ({roiData.planned_hours}h)</div>
              {roiData.approved_hours > 0 && (
                <div>Aprobado a la fecha: <strong>${roiData.real_cost.toLocaleString()}</strong> ({roiData.approved_hours}h)</div>
              )}
              <div>Horas Proyectadas: <strong>{projectedHours}h</strong></div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card type="inner" size="small" style={{ height: '100%' }}>
            <Statistic
              title="Margen % Proyectado"
              value={projectedMarginPct}
              suffix="%"
              precision={1}
              valueStyle={{ color: projectedMarginPct >= 20 ? '#3f8600' : '#cf1322' }}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
              <div>Margen Planificado: <strong>{plannedMarginPct.toFixed(1)}%</strong></div>
              <div>Utilidad Proyectada: <strong>${projectedProfit.toLocaleString()}</strong></div>
              <div>ROI Proyectado: <strong>{projectedROI.toFixed(1)}%</strong></div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card type="inner" size="small" style={{ height: '100%' }}>
            <Statistic
              title="Impacto del Desvío"
              value={Math.abs(varianceImpact)}
              prefix={varianceImpact > 0 ? '-$' : varianceImpact < 0 ? '+$' : '$'}
              formatter={(value) => `${Number(value).toLocaleString()}`}
              valueStyle={{ color: varianceImpact > 0 ? '#cf1322' : varianceImpact < 0 ? '#3f8600' : '#595959' }}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
              {varianceImpact > 0 && (
                <Tag color="error">Sobrecosto de ${varianceImpact.toLocaleString()}</Tag>
              )}
              {varianceImpact < 0 && (
                <Tag color="success">Ahorro de ${Math.abs(varianceImpact).toLocaleString()}</Tag>
              )}
              {varianceImpact === 0 && (
                <Tag color="default">En línea con presupuesto</Tag>
              )}
              <div style={{ marginTop: 4 }}>Diferencia utilidad planificada vs proyectada</div>
            </div>
          </Card>
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
                percent={Math.max(0, Math.min(100, displayValues.roi + 50))} // Normalize for display
                format={() => `${displayValues.roi}%`}
                strokeColor={getROIColor(displayValues.roi)}
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
                suffix={`/ ${roiData.planned_hours}`}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ fontSize: 20 }}
              />
              {roiData.planned_hours > 0 && (
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
      <Divider>Indicadores</Divider>
      <Row gutter={16}>
        <Col span={8}>
          <Space>
            {displayValues.roi >= 20 ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <ExclamationCircleOutlined style={{ color: '#f5222d' }} />}
            <Text>Rentabilidad</Text>
          </Space>
        </Col>
        <Col span={8}>
          <Space>
            {displayValues.hours <= roiData.planned_hours ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <ExclamationCircleOutlined style={{ color: '#f5222d' }} />}
            <Text>Tiempo</Text>
          </Space>
        </Col>
        <Col span={8}>
          <Space>
            {displayValues.profit > 0 ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <ExclamationCircleOutlined style={{ color: '#f5222d' }} />}
            <Text>Margen</Text>
          </Space>
        </Col>
      </Row>

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
      ) : (
        <Alert
          style={{ marginTop: 16 }}
          message="Impacto de Demoras del Cliente"
          description={`Las demoras del cliente han generado ${roiData.client_delay_hours} horas adicionales, impactando el costo en $${roiData.delay_impact.toLocaleString()} y reduciendo la ganancia en $${roiData.lost_profit.toLocaleString()}.`}
          type="warning"
          showIcon
          closable
        />
      )}
    </Card>
  );
};