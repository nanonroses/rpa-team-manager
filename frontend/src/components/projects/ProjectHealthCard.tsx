import React, { useEffect, useState, useCallback } from 'react';
import { Card, Tag, Statistic, Row, Col, Button, Typography, message } from 'antd';
import { apiService } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { ProjectHealth } from '@/types/projectHealth';

const { Text } = Typography;

const SEMAPHORE_LABEL: Record<ProjectHealth['semaphore'], string> = {
  green: 'En curso',
  yellow: 'En riesgo',
  red: 'Desviado',
  gray: 'Sin datos'
};

const SEMAPHORE_COLOR: Record<ProjectHealth['semaphore'], string> = {
  green: 'green',
  yellow: 'orange',
  red: 'red',
  gray: 'default'
};

interface ProjectHealthCardProps {
  projectId: number;
}

export const ProjectHealthCard: React.FC<ProjectHealthCardProps> = ({ projectId }) => {
  const [health, setHealth] = useState<ProjectHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [freezing, setFreezing] = useState(false);
  const { user } = useAuthStore();

  const loadHealth = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiService.getProjectHealth(projectId);
      setHealth(data);
    } catch (error) {
      message.error('No se pudo cargar la salud del proyecto');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  const handleFreezeBaseline = async () => {
    try {
      setFreezing(true);
      await apiService.freezeProjectBaseline(projectId);
      message.success("Línea base fijada");
      await loadHealth();
    } catch (error: any) {
      message.error(error?.response?.data?.error || "No se pudo fijar la línea base");
    } finally {
      setFreezing(false);
    }
  };

  if (loading || !health) {
    return <Card loading title="Salud del proyecto" />;
  }

  return (
    <Card title="Salud del proyecto" size="small">
      <Tag color={SEMAPHORE_COLOR[health.semaphore]} style={{ marginBottom: 12 }}>
        {SEMAPHORE_LABEL[health.semaphore]}
      </Tag>

      {health.status === 'insufficient_data' ? (
        <>
          <Text type="secondary">
            Sin datos suficientes para calcular desvío (falta baseline o hitos con fecha planificada).
          </Text>
          {user?.role === 'team_lead' && !health.has_baseline && (
            <div style={{ marginTop: 12 }}>
              <Button type="primary" loading={freezing} onClick={handleFreezeBaseline}>
                Fijar línea base
              </Button>
            </div>
          )}
        </>
      ) : (
        <Row gutter={16}>
          <Col span={6}>
            <Statistic title="Avance por hitos" value={health.ev_percentage} suffix="%" />
          </Col>
          <Col span={6}>
            <Statistic
              title="SPI"
              value={health.spi ?? 0}
              precision={2}
              formatter={(value) => Number(value).toFixed(2)}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="CPI"
              value={health.cpi ?? '—'}
              precision={2}
              formatter={(value) => (health.cpi === null ? '—' : Number(value).toFixed(2))}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Fin proyectado"
              value={health.projected_end_date ?? '-'}
              valueStyle={{ fontSize: 14 }}
            />
          </Col>
        </Row>
      )}
    </Card>
  );
};
