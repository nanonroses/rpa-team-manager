import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Button,
  Table,
  Typography,
  Space,
  Select,
  Input,
  Tag,
  message,
  Row,
  Col,
  Statistic,
  Tabs,
  InputNumber,
  Popconfirm,
  Alert,
  Checkbox
} from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  ClockCircleOutlined,
  PlusOutlined,
  DeleteOutlined,
  LeftOutlined,
  RightOutlined,
  SendOutlined
} from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { apiService } from '@/services/api';
import {
  SaveWeekEntryInput,
  TimesheetWeek,
  TimesheetPeriod,
  EffectivenessMetrics,
  PendingReminders
} from '@/types/timesheet';
import { useAuthStore } from '@/store/authStore';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

interface Project {
  id: number;
  name: string;
}

interface ActiveTimer {
  id: number;
  project_id: number;
  task_id?: number;
  description?: string;
  date: string;
  start_time: string;
  project_name?: string;
  task_title?: string;
}

function mondayOf(date: dayjs.Dayjs): string {
  const weekday = date.day(); // 0 = domingo ... 6 = sábado
  const diffFromMonday = weekday === 0 ? 6 : weekday - 1;
  return date.subtract(diffFromMonday, 'day').format('YYYY-MM-DD');
}

const WeekGrid: React.FC<{ projects: Project[]; refreshSignal: number }> = ({ projects, refreshSignal }) => {
  const [weekStart, setWeekStart] = useState(mondayOf(dayjs()));
  const [week, setWeek] = useState<TimesheetWeek | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftByDay, setDraftByDay] = useState<Record<string, SaveWeekEntryInput[]>>({});

  const seedDraftFromWeek = (data: TimesheetWeek) => {
    const draft: Record<string, SaveWeekEntryInput[]> = {};
    data.days.forEach(day => {
      draft[day.date] = day.entries.map(e => ({
        id: e.id, project_id: e.project_id, task_id: e.task_id, description: e.description,
        date: e.date, hours: e.hours, is_billable: e.is_billable
      }));
    });
    setDraftByDay(draft);
  };

  const loadWeek = useCallback(async () => {
    try {
      setLoading(true);
      const data: TimesheetWeek = await apiService.getTimesheetWeek(weekStart);
      setWeek(data);
      seedDraftFromWeek(data);
    } catch (error) {
      console.error('Error loading timesheet week:', error);
      message.error('Error al cargar la semana');
    } finally {
      setLoading(false);
    }
    // refreshSignal cambia cuando el timer arranca o se detiene: obliga a recargar la semana
    // para que el borrador no quede desfasado respecto de la BD.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, refreshSignal]);

  useEffect(() => { loadWeek(); }, [loadWeek]);

  const isLocked = week?.period?.status === 'submitted' || week?.period?.status === 'approved';

  const addRow = (date: string) => {
    if (isLocked || !projects[0]) return;
    setDraftByDay(prev => ({
      ...prev,
      [date]: [...(prev[date] || []), { project_id: projects[0].id, date, hours: 1, is_billable: true }]
    }));
  };

  const updateRow = (date: string, index: number, patch: Partial<SaveWeekEntryInput>) => {
    setDraftByDay(prev => {
      const rows = [...(prev[date] || [])];
      rows[index] = { ...rows[index], ...patch };
      return { ...prev, [date]: rows };
    });
  };

  const removeRow = (date: string, index: number) => {
    setDraftByDay(prev => {
      const rows = [...(prev[date] || [])];
      rows.splice(index, 1);
      return { ...prev, [date]: rows };
    });
  };

  const handleSave = async (): Promise<boolean> => {
    try {
      setSaving(true);
      const allEntries = Object.values(draftByDay).flat().filter(e => e.hours > 0);
      const updated = await apiService.saveTimesheetWeek(weekStart, allEntries);
      setWeek(updated);
      seedDraftFromWeek(updated);
      message.success('Semana guardada');
      return true;
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Error al guardar la semana');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    const saved = await handleSave();
    if (!saved) {
      return;
    }
    try {
      await apiService.submitTimesheetWeek(weekStart);
      message.success('Semana enviada a aprobación');
      await loadWeek();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Error al enviar la semana');
    }
  };

  const weekTotal = Object.values(draftByDay).flat().reduce((sum, e) => sum + (e.hours || 0), 0);

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Space>
          <Button icon={<LeftOutlined />} onClick={() => setWeekStart(mondayOf(dayjs(weekStart).subtract(7, 'day')))} />
          <Text strong>Semana del {dayjs(weekStart).format('DD/MM/YYYY')}</Text>
          <Button icon={<RightOutlined />} onClick={() => setWeekStart(mondayOf(dayjs(weekStart).add(7, 'day')))} />
        </Space>
        <Space>
          <Statistic title="Total semana" value={weekTotal} suffix="hrs" precision={2} />
          {week?.period && (
            <Tag color={
              week.period.status === 'approved' ? 'green' :
              week.period.status === 'submitted' ? 'blue' :
              week.period.status === 'rejected' ? 'red' : 'default'
            }>
              {week.period.status.toUpperCase()}
            </Tag>
          )}
        </Space>
      </Row>

      {week?.period?.status === 'rejected' && (
        <Alert
          type="warning"
          showIcon
          message="Semana rechazada"
          description={week.period.rejection_reason}
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={[16, 16]}>
        {(week?.days || []).map(day => (
          <Col xs={24} md={12} lg={8} key={day.date}>
            <Card
              size="small"
              title={dayjs(day.date).format('dddd DD/MM')}
              extra={<Text type="secondary">{(draftByDay[day.date] || []).reduce((s, e) => s + (e.hours || 0), 0)}h</Text>}
            >
              {(draftByDay[day.date] || []).map((entry, idx) => (
                <Row gutter={4} key={idx} style={{ marginBottom: 8 }} align="middle">
                  <Col span={9}>
                    <Select
                      size="small"
                      style={{ width: '100%' }}
                      value={entry.project_id}
                      disabled={isLocked}
                      onChange={(v) => updateRow(day.date, idx, { project_id: v })}
                    >
                      {projects.map(p => <Option key={p.id} value={p.id}>{p.name}</Option>)}
                    </Select>
                  </Col>
                  <Col span={7}>
                    <Input
                      size="small"
                      placeholder="Descripción"
                      disabled={isLocked}
                      value={entry.description || ''}
                      onChange={(e) => updateRow(day.date, idx, { description: e.target.value })}
                    />
                  </Col>
                  <Col span={5}>
                    <InputNumber
                      size="small"
                      min={0.25}
                      max={24}
                      step={0.25}
                      style={{ width: '100%' }}
                      disabled={isLocked}
                      value={entry.hours}
                      onChange={(v) => updateRow(day.date, idx, { hours: v || 0 })}
                    />
                  </Col>
                  <Col span={2}>
                    <Checkbox
                      checked={entry.is_billable !== false}
                      disabled={isLocked}
                      onChange={(e) => updateRow(day.date, idx, { is_billable: e.target.checked })}
                    />
                  </Col>
                  <Col span={1}>
                    <Button
                      size="small"
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      disabled={isLocked}
                      onClick={() => removeRow(day.date, idx)}
                    />
                  </Col>
                </Row>
              ))}
              <Button
                size="small"
                type="dashed"
                icon={<PlusOutlined />}
                block
                disabled={isLocked}
                onClick={() => addRow(day.date)}
              >
                Agregar
              </Button>
            </Card>
          </Col>
        ))}
      </Row>

      <Row justify="end" style={{ marginTop: 16 }}>
        <Space>
          <Button onClick={handleSave} loading={saving || loading} disabled={isLocked}>
            Guardar semana
          </Button>
          <Popconfirm
            title="¿Enviar la semana a aprobación?"
            description="No podrás editarla mientras esté pendiente de revisión."
            onConfirm={handleSubmit}
            disabled={isLocked}
          >
            <Button type="primary" icon={<SendOutlined />} disabled={isLocked}>
              Enviar a aprobación
            </Button>
          </Popconfirm>
        </Space>
      </Row>
    </div>
  );
};

export const TimeTrackingPage: React.FC = () => {
  const { user } = useAuthStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [timerLoading, setTimerLoading] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [selectedTimerProject, setSelectedTimerProject] = useState<number | undefined>(undefined);
  const [reminderDates, setReminderDates] = useState<string[]>([]);
  const [gridRefreshSignal, setGridRefreshSignal] = useState(0);

  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'week');

  const canApprove = user?.role === 'team_lead';
  const canSeeEffectiveness = user?.role === 'team_lead' || user?.role === 'rpa_operations';

  const loadProjects = async () => {
    try {
      const response = await apiService.getProjects();
      setProjects(response);
    } catch (error) {
      console.error('Error loading projects:', error);
      message.error('Error al cargar proyectos');
    }
  };

  const loadActiveTimer = async () => {
    try {
      const response = await apiService.get('/time-entries/active');
      setActiveTimer(response || null);
    } catch (error) {
      console.error('Error loading active timer:', error);
    }
  };

  const loadReminders = async () => {
    try {
      const data: PendingReminders = await apiService.getTimesheetReminders();
      setReminderDates(data.missing_dates || []);
    } catch (error) {
      console.error('Error loading reminders:', error);
    }
  };

  useEffect(() => {
    const tabFromParams = searchParams.get('tab') || 'week';
    setActiveTab(tabFromParams);
  }, [searchParams]);

  useEffect(() => {
    loadProjects();
    loadActiveTimer();
    loadReminders();
    const interval = setInterval(loadActiveTimer, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTimer) {
      const calc = () => setElapsedTime(dayjs().diff(dayjs(`${activeTimer.date} ${activeTimer.start_time}`), 'second'));
      calc();
      const id = setInterval(calc, 1000);
      return () => clearInterval(id);
    }
    setElapsedTime(0);
  }, [activeTimer]);

  const formatElapsedTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleStartTimer = async (projectId: number) => {
    try {
      setTimerLoading(true);
      const response = await apiService.post('/time-entries/start-timer', { project_id: projectId });
      setActiveTimer(response);
      setGridRefreshSignal(s => s + 1);
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Error al iniciar timer');
    } finally {
      setTimerLoading(false);
    }
  };

  const handleStopTimer = async () => {
    try {
      setTimerLoading(true);
      await apiService.post('/time-entries/stop-timer');
      setActiveTimer(null);
      setGridRefreshSignal(s => s + 1);
      message.success('Timer detenido');
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Error al detener timer');
    } finally {
      setTimerLoading(false);
    }
  };

  const tabItems = [
    {
      key: 'week',
      label: 'Mi semana',
      children: <WeekGrid projects={projects} refreshSignal={gridRefreshSignal} />
    }
  ];

  if (canApprove) {
    tabItems.push({ key: 'approvals', label: 'Aprobaciones', children: <ApprovalsTab /> });
  }
  if (canSeeEffectiveness) {
    tabItems.push({ key: 'effectiveness', label: 'Efectividad', children: <EffectivenessTab /> });
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Title level={2}>⏱️ Tiempo</Title>
        <Text type="secondary">Carga tu semana, revisa aprobaciones y efectividad del equipo</Text>
      </div>

      {reminderDates.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={`Tienes ${reminderDates.length} día(s) hábil(es) sin horas registradas en las últimas 2 semanas`}
          description={reminderDates.join(', ')}
        />
      )}

      <Card
        title={
          <Space>
            <ClockCircleOutlined />
            Timer de trabajo
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        {activeTimer ? (
          <Row gutter={16} align="middle">
            <Col>
              <Statistic title="Tiempo transcurrido" value={formatElapsedTime(elapsedTime)} valueStyle={{ fontFamily: 'monospace' }} />
            </Col>
            <Col flex="auto">
              <Text strong>{activeTimer.project_name}</Text>
            </Col>
            <Col>
              <Button type="primary" danger icon={<PauseCircleOutlined />} loading={timerLoading} onClick={handleStopTimer}>
                Detener timer
              </Button>
            </Col>
          </Row>
        ) : (
          <Space>
            <Select
              placeholder="Proyecto"
              style={{ width: 240 }}
              value={selectedTimerProject}
              onChange={(v) => setSelectedTimerProject(v)}
            >
              {projects.map(p => <Option key={p.id} value={p.id}>{p.name}</Option>)}
            </Select>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={timerLoading}
              disabled={!selectedTimerProject}
              onClick={() => selectedTimerProject && handleStartTimer(selectedTimerProject)}
            >
              Iniciar timer
            </Button>
          </Space>
        )}
      </Card>

      <Tabs
        items={tabItems}
        activeKey={activeTab}
        onChange={(key) => {
          setActiveTab(key);
          setSearchParams(key === 'week' ? {} : { tab: key }, { replace: true });
        }}
      />
    </div>
  );
};

const ApprovalsTab: React.FC = () => {
  const [periods, setPeriods] = useState<TimesheetPeriod[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const data: TimesheetPeriod[] = await apiService.getPendingTimesheetApprovals();
      setPeriods(data);
    } catch (error) {
      message.error('Error al cargar aprobaciones pendientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (id: number) => {
    try {
      await apiService.approveTimesheetWeek(id);
      message.success('Semana aprobada');
      load();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Error al aprobar');
    }
  };

  const handleReject = async (id: number) => {
    const reason = window.prompt('Motivo del rechazo:');
    if (!reason) return;
    try {
      await apiService.rejectTimesheetWeek(id, reason);
      message.success('Semana rechazada');
      load();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Error al rechazar');
    }
  };

  return (
    <Table
      loading={loading}
      dataSource={periods}
      rowKey="id"
      columns={[
        { title: 'Persona', dataIndex: 'user_name' },
        { title: 'Semana', render: (_: any, r: TimesheetPeriod) => `${dayjs(r.period_start).format('DD/MM')} - ${dayjs(r.period_end).format('DD/MM')}` },
        { title: 'Horas', dataIndex: 'total_hours' },
        {
          title: 'Acciones',
          render: (_: any, r: TimesheetPeriod) => (
            <Space>
              <Button size="small" type="primary" onClick={() => handleApprove(r.id)}>Aprobar</Button>
              <Button size="small" danger onClick={() => handleReject(r.id)}>Rechazar</Button>
            </Space>
          )
        }
      ]}
    />
  );
};

const EffectivenessTab: React.FC = () => {
  const [metrics, setMetrics] = useState<EffectivenessMetrics | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const from = dayjs().startOf('month').format('YYYY-MM-DD');
    const to = dayjs().endOf('month').format('YYYY-MM-DD');
    setLoading(true);
    apiService.getEffectivenessMetrics(from, to)
      .then(setMetrics)
      .catch(() => message.error('Error al cargar métricas de efectividad'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <Title level={4}>Por persona (mes actual)</Title>
      <Table
        loading={loading}
        dataSource={metrics?.by_person || []}
        rowKey="user_id"
        columns={[
          { title: 'Persona', dataIndex: 'user_name' },
          { title: 'Estimado (h)', dataIndex: 'estimated_hours' },
          { title: 'Real (h)', dataIndex: 'real_hours' },
          { title: 'Utilización %', dataIndex: 'utilization_pct', render: (v: number) => `${v}%` },
          { title: 'Facturable %', dataIndex: 'billable_pct', render: (v: number) => `${v}%` }
        ]}
      />
      <Title level={4} style={{ marginTop: 24 }}>Por tarea (mes actual)</Title>
      <Table
        loading={loading}
        dataSource={metrics?.by_task || []}
        rowKey="task_id"
        columns={[
          { title: 'Tarea', dataIndex: 'task_title' },
          { title: 'Proyecto', dataIndex: 'project_name' },
          { title: 'Estimado (h)', dataIndex: 'estimated_hours' },
          { title: 'Real (h)', dataIndex: 'real_hours' },
          {
            title: 'Desvío (h)', dataIndex: 'variance_hours',
            render: (v: number) => <Tag color={v > 0 ? 'red' : 'green'}>{v > 0 ? '+' : ''}{v}</Tag>
          }
        ]}
      />
    </div>
  );
};
