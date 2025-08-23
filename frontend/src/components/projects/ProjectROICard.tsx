import React, { useEffect, useState } from 'react';
import { Card, Statistic, Row, Col, Tag, Progress, Divider, Space, Typography, Alert } from 'antd';
import {
  DollarOutlined,
  TrophyOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { apiService } from '@/services/api';
import { useAuthStore } from '@/store/authStore';

const { Text, Title } = Typography;

interface ProjectROIData {
  project_id: string;
  sale_price: number | null;
  budget_allocated: number | null;
  actual_cost: number;
  profit_margin: number;
  roi_percentage: number;
  efficiency_percentage: number;
  hours_budgeted: number;
  hours_spent: number;
  cost_breakdown: any[];
  alerts: Array<{
    type: string;
    level: string;
    message: string;
    threshold: number;
    current: number;
  }>;
}

interface ProjectROICardProps {
  projectId: number;
  projectName: string;
  assignedUserId?: number;
}

export const ProjectROICard: React.FC<ProjectROICardProps> = ({ 
  projectId, 
  projectName,
  assignedUserId 
}) => {
  const [roiData, setRoiData] = useState<ProjectROIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [userCosts, setUserCosts] = useState<any[]>([]);
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

  // Calculate estimated cost for budgeted hours
  const calculateEstimatedCost = () => {
    if (!roiData || !assignedUserId) return 0;
    
    const userCost = userCosts.find(cost => cost.user_id === assignedUserId);
    if (!userCost) return 0;
    
    return roiData.hours_budgeted * userCost.hourly_rate;
  };

  // Calculate estimated ROI based on budgeted data
  const calculateEstimatedROI = () => {
    if (!roiData?.sale_price) return 0;
    
    const estimatedCost = calculateEstimatedCost();
    if (estimatedCost === 0) return 0;
    
    const profit = roiData.sale_price - estimatedCost;
    return Math.round((profit / estimatedCost) * 100);
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

  const estimatedCost = calculateEstimatedCost();
  const estimatedROI = calculateEstimatedROI();
  const actualROI = roiData.roi_percentage;
  const hasActualData = roiData.hours_spent > 0;
  
  const roiToShow = hasActualData ? actualROI : estimatedROI;
  const costToShow = hasActualData ? roiData.actual_cost : estimatedCost;
  const hoursToShow = hasActualData ? roiData.hours_spent : roiData.hours_budgeted;
  
  const status = getROIStatus(roiToShow);

  return (
    <Card 
      title={
        <Space>
          <DollarOutlined style={{ color: '#1890ff' }} />
          <span>💰 Rentabilidad - {projectName}</span>
          <Tag color={status.color}>{status.text}</Tag>
        </Space>
      }
    >
      {/* Métricas Principales */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Statistic
            title="Precio de Venta"
            value={roiData.sale_price || 0}
            prefix="$"
            formatter={(value) => `${Number(value).toLocaleString()}`}
            valueStyle={{ color: '#1890ff' }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title={hasActualData ? "Costo Real" : "Costo Estimado"}
            value={costToShow}
            prefix="$"
            formatter={(value) => `${Number(value).toLocaleString()}`}
            valueStyle={{ color: '#fa8c16' }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="Ganancia"
            value={(roiData.sale_price || 0) - costToShow}
            prefix="$"
            formatter={(value) => `${Number(value).toLocaleString()}`}
            valueStyle={{ 
              color: ((roiData.sale_price || 0) - costToShow) > 0 ? '#52c41a' : '#f5222d' 
            }}
          />
        </Col>
      </Row>

      {/* ROI y Progreso */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card type="inner" size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>ROI {hasActualData ? 'Real' : 'Estimado'}</Text>
              <Progress
                type="circle"
                size={80}
                percent={Math.max(0, Math.min(100, roiToShow + 50))} // Normalize for display
                format={() => `${roiToShow}%`}
                strokeColor={getROIColor(roiToShow)}
              />
            </Space>
          </Card>
        </Col>
        <Col span={12}>
          <Card type="inner" size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>Horas {hasActualData ? 'Trabajadas' : 'Presupuestadas'}</Text>
              <Statistic
                value={hoursToShow}
                suffix={`/ ${roiData.hours_budgeted}`}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ fontSize: 20 }}
              />
              {roiData.hours_budgeted > 0 && (
                <Progress
                  percent={Math.round((hoursToShow / roiData.hours_budgeted) * 100)}
                  size="small"
                  status={hoursToShow > roiData.hours_budgeted ? 'exception' : 'active'}
                />
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
                type={alert.level === 'critical' ? 'error' : 'warning'}
                showIcon
                icon={
                  alert.level === 'critical' ? 
                    <ExclamationCircleOutlined /> : 
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
            {roiToShow >= 20 ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <ExclamationCircleOutlined style={{ color: '#f5222d' }} />}
            <Text>Rentabilidad</Text>
          </Space>
        </Col>
        <Col span={8}>
          <Space>
            {hoursToShow <= roiData.hours_budgeted ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <ExclamationCircleOutlined style={{ color: '#f5222d' }} />}
            <Text>Tiempo</Text>
          </Space>
        </Col>
        <Col span={8}>
          <Space>
            {((roiData.sale_price || 0) - costToShow) > 0 ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <ExclamationCircleOutlined style={{ color: '#f5222d' }} />}
            <Text>Margen</Text>
          </Space>
        </Col>
      </Row>

      {/* Info adicional */}
      {!hasActualData && (
        <Alert
          style={{ marginTop: 16 }}
          message="Cálculo Estimado"
          description="Los valores mostrados son estimaciones basadas en las horas presupuestadas y el costo del usuario asignado. Los valores reales aparecerán cuando se registren horas trabajadas."
          type="info"
          showIcon
          closable
        />
      )}
    </Card>
  );
};