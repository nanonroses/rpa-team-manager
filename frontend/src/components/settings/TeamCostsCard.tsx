import React, { useEffect, useState } from 'react';
import { Card, Table, InputNumber, Button, Alert, Tag, Typography, message } from 'antd';
import { TeamOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { apiService } from '@/services/api';
import { TeamCostMember } from '@/types/teamCosts';

const { Text } = Typography;

const ROLE_LABELS: Record<string, string> = {
  team_lead: 'Team Lead',
  rpa_developer: 'RPA Developer',
  rpa_operations: 'RPA Operations',
  it_support: 'Soporte TI'
};

const formatCLP = (value: number) => `$${Math.round(value).toLocaleString('es-CL')}`;

export const TeamCostsCard: React.FC = () => {
  const [members, setMembers] = useState<TeamCostMember[]>([]);
  const [monthlyHours, setMonthlyHours] = useState(168);
  const [drafts, setDrafts] = useState<Record<number, number | null>>({});
  const [loading, setLoading] = useState(false);
  const [savingUserId, setSavingUserId] = useState<number | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const data = await apiService.getTeamCosts();
      setMembers(data.members);
      setMonthlyHours(data.monthly_hours);
      setDrafts({});
    } catch (error) {
      console.error('Error loading team costs:', error);
      message.error('Error al cargar el costo empresa del equipo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const currentValue = (member: TeamCostMember): number | null =>
    drafts[member.user_id] !== undefined ? drafts[member.user_id] : member.monthly_cost;

  const handleSave = async (member: TeamCostMember) => {
    const monthlyCost = drafts[member.user_id];
    if (!monthlyCost || monthlyCost <= 0) return;
    try {
      setSavingUserId(member.user_id);
      await apiService.createUserCost({
        user_id: member.user_id,
        monthly_cost: monthlyCost,
        effective_from: dayjs().format('YYYY-MM-DD')
      });
      message.success(`Costo empresa de ${member.full_name} actualizado`);
      await load();
    } catch (error) {
      console.error('Error saving team cost:', error);
      message.error('Error al guardar el costo empresa');
    } finally {
      setSavingUserId(null);
    }
  };

  const columns = [
    { title: 'Persona', dataIndex: 'full_name', key: 'full_name' },
    {
      title: 'Rol',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => <Tag>{ROLE_LABELS[role] || role}</Tag>
    },
    {
      title: 'Costo empresa mensual (CLP)',
      key: 'monthly_cost',
      render: (_: unknown, member: TeamCostMember) => (
        <InputNumber
          aria-label={`Costo empresa de ${member.full_name}`}
          value={currentValue(member)}
          min={0}
          step={50000}
          style={{ width: 180 }}
          onChange={(value) =>
            setDrafts((prev) => ({ ...prev, [member.user_id]: typeof value === 'number' ? value : null }))
          }
        />
      )
    },
    {
      title: 'Valor HH',
      key: 'hourly_rate',
      render: (_: unknown, member: TeamCostMember) => {
        const value = currentValue(member);
        return value && value > 0 ? formatCLP(value / monthlyHours) : '—';
      }
    },
    {
      title: 'Vigente desde',
      key: 'effective_from',
      render: (_: unknown, member: TeamCostMember) =>
        member.effective_from || <Text type="secondary">Sin costo registrado</Text>
    },
    {
      title: '',
      key: 'actions',
      render: (_: unknown, member: TeamCostMember) => {
        const draft = drafts[member.user_id];
        const canSave = typeof draft === 'number' && draft > 0 && draft !== member.monthly_cost;
        return (
          <Button
            type="primary"
            size="small"
            disabled={!canSave}
            loading={savingUserId === member.user_id}
            onClick={() => handleSave(member)}
          >
            Guardar
          </Button>
        );
      }
    }
  ];

  return (
    <Card title={<><TeamOutlined /> Costo empresa por persona</>} style={{ marginBottom: '24px' }}>
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="Solo visible para Team Lead"
        description={`Ingresa el costo empresa mensual de cada persona (sueldo + leyes sociales + otros costos). Valor HH = costo empresa ÷ ${monthlyHours} horas del mes. Un cambio aplica desde hoy; las horas ya aprobadas conservan el valor con que se aprobaron.`}
      />
      <Table
        rowKey="user_id"
        size="small"
        loading={loading}
        dataSource={members}
        columns={columns}
        pagination={false}
      />
    </Card>
  );
};
