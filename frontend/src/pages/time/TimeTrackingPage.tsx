import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Table, 
  Typography, 
  Space, 
  Select, 
  Input, 
  DatePicker, 
  Tag, 
  message, 
  Row, 
  Col, 
  Statistic,
  Modal,
  Form,
  InputNumber,
  Tooltip,
  Alert
} from 'antd';
import { 
  PlayCircleOutlined, 
  PauseCircleOutlined, 
  ClockCircleOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ProjectOutlined,
  DashboardOutlined
} from '@ant-design/icons';
import { apiService } from '@/services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface Project {
  id: number;
  name: string;
}

interface Task {
  id: number;
  title: string;
  project_id: number;
}

interface TimeEntry {
  id: number;
  user_id: number;
  project_id: number;
  task_id?: number;
  description?: string;
  hours: number;
  date: string;
  start_time?: string;
  end_time?: string;
  is_billable: boolean;
  hourly_rate: number;
  project_name?: string;
  task_title?: string;
  user_name?: string;
  created_at: string;
  updated_at: string;
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

interface DashboardData {
  today: {
    entries_count: number;
    total_hours: number;
    total_value: number;
  };
  week: {
    entries_count: number;
    total_hours: number;
    total_value: number;
  };
  top_projects: Array<{
    project_id: number;
    project_name: string;
    entries_count: number;
    total_hours: number;
    total_value: number;
  }>;
}

export const TimeTrackingPage: React.FC = () => {
  // State management
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [timerLoading, setTimerLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [form] = Form.useForm();

  // Timer state
  const [elapsedTime, setElapsedTime] = useState(0);
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadActiveTimer, 5000); // Check timer every 5 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTimer) {
      startTimerInterval();
    } else {
      stopTimerInterval();
    }
    return () => stopTimerInterval();
  }, [activeTimer]);

  useEffect(() => {
    loadTimeEntries();
  }, [selectedDate]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadProjects(),
        loadActiveTimer(),
        loadTimeEntries(),
        loadDashboard()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const loadTimeEntries = async () => {
    try {
      const dateString = selectedDate.format('YYYY-MM-DD');
      const response = await apiService.get(`/time-entries?date=${dateString}`);
      setTimeEntries(response || []);
    } catch (error) {
      console.error('Error loading time entries:', error);
      message.error('Error al cargar entradas de tiempo');
    }
  };

  const loadDashboard = async () => {
    try {
      const response = await apiService.get('/time-entries/dashboard');
      setDashboardData(response);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  };

  const startTimerInterval = () => {
    if (!activeTimer) return;
    
    stopTimerInterval();
    
    const calculateElapsed = () => {
      const startTime = dayjs(`${activeTimer.date} ${activeTimer.start_time}`);
      const now = dayjs();
      const elapsed = now.diff(startTime, 'second');
      setElapsedTime(elapsed);
    };

    calculateElapsed();
    const interval = setInterval(calculateElapsed, 1000);
    setTimerInterval(interval);
  };

  const stopTimerInterval = () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
    setElapsedTime(0);
  };

  const formatElapsedTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartTimer = async (values: { project_id: number; task_id?: number; description?: string }) => {
    try {
      setTimerLoading(true);
      const response = await apiService.post('/time-entries/start-timer', values);
      setActiveTimer(response);
      message.success('Timer iniciado exitosamente');
    } catch (error: any) {
      console.error('Error starting timer:', error);
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
      await Promise.all([loadTimeEntries(), loadDashboard()]);
      message.success('Timer detenido exitosamente');
    } catch (error: any) {
      console.error('Error stopping timer:', error);
      message.error(error.response?.data?.error || 'Error al detener timer');
    } finally {
      setTimerLoading(false);
    }
  };

  const handleCreateEntry = async (values: any) => {
    try {
      await apiService.post('/time-entries', {
        ...values,
        date: selectedDate.format('YYYY-MM-DD')
      });
      message.success('Entrada creada exitosamente');
      setIsModalOpen(false);
      form.resetFields();
      await Promise.all([loadTimeEntries(), loadDashboard()]);
    } catch (error: any) {
      console.error('Error creating entry:', error);
      message.error(error.response?.data?.error || 'Error al crear entrada');
    }
  };

  const handleUpdateEntry = async (values: any) => {
    if (!editingEntry) return;
    
    try {
      await apiService.put(`/time-entries/${editingEntry.id}`, values);
      message.success('Entrada actualizada exitosamente');
      setIsModalOpen(false);
      setEditingEntry(null);
      form.resetFields();
      await Promise.all([loadTimeEntries(), loadDashboard()]);
    } catch (error: any) {
      console.error('Error updating entry:', error);
      message.error(error.response?.data?.error || 'Error al actualizar entrada');
    }
  };

  const handleDeleteEntry = async (entryId: number) => {
    try {
      await apiService.delete(`/time-entries/${entryId}`);
      message.success('Entrada eliminada exitosamente');
      await Promise.all([loadTimeEntries(), loadDashboard()]);
    } catch (error: any) {
      console.error('Error deleting entry:', error);
      message.error(error.response?.data?.error || 'Error al eliminar entrada');
    }
  };

  const openEditModal = (entry: TimeEntry) => {
    setEditingEntry(entry);
    form.setFieldsValue({
      project_id: entry.project_id,
      task_id: entry.task_id,
      description: entry.description,
      hours: entry.hours,
      is_billable: entry.is_billable
    });
    setIsModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingEntry(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  // Timer form for starting new timer
  const TimerForm = () => {
    const [timerForm] = Form.useForm();

    return (
      <Card 
        title={
          <Space>
            <ClockCircleOutlined />
            Timer de Trabajo
          </Space>
        }
        style={{ marginBottom: '24px' }}
      >
        {activeTimer ? (
          <div>
            <Row gutter={16} align="middle">
              <Col>
                <Statistic
                  title="Tiempo Transcurrido"
                  value={formatElapsedTime(elapsedTime)}
                  valueStyle={{ fontSize: '32px', fontFamily: 'monospace' }}
                />
              </Col>
              <Col>
                <div>
                  <Text strong>Proyecto: </Text>
                  <Text>{activeTimer.project_name}</Text>
                </div>
                {activeTimer.task_title && (
                  <div>
                    <Text strong>Tarea: </Text>
                    <Text>{activeTimer.task_title}</Text>
                  </div>
                )}
                {activeTimer.description && (
                  <div>
                    <Text strong>Descripción: </Text>
                    <Text>{activeTimer.description}</Text>
                  </div>
                )}
              </Col>
              <Col>
                <Button
                  type="primary"
                  danger
                  size="large"
                  icon={<PauseCircleOutlined />}
                  loading={timerLoading}
                  onClick={handleStopTimer}
                >
                  Detener Timer
                </Button>
              </Col>
            </Row>
          </div>
        ) : (
          <Form
            form={timerForm}
            layout="inline"
            onFinish={handleStartTimer}
            style={{ width: '100%' }}
          >
            <Form.Item
              name="project_id"
              rules={[{ required: true, message: 'Seleccione un proyecto' }]}
              style={{ minWidth: '200px' }}
            >
              <Select placeholder="Seleccionar proyecto">
                {projects.map(project => (
                  <Option key={project.id} value={project.id}>
                    {project.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item name="description" style={{ minWidth: '300px' }}>
              <Input placeholder="Descripción de la tarea (opcional)" />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                icon={<PlayCircleOutlined />}
                loading={timerLoading}
                size="large"
              >
                Iniciar Timer
              </Button>
            </Form.Item>
          </Form>
        )}
      </Card>
    );
  };

  // Dashboard statistics
  const DashboardStats = () => (
    <Row gutter={16} style={{ marginBottom: '24px' }}>
      <Col xs={24} sm={8}>
        <Card>
          <Statistic
            title="Hoy"
            value={dashboardData?.today.total_hours || 0}
            precision={2}
            suffix="hrs"
            prefix={<ClockCircleOutlined />}
          />
          <Text type="secondary">
            ${(dashboardData?.today.total_value || 0).toLocaleString()}
          </Text>
        </Card>
      </Col>
      <Col xs={24} sm={8}>
        <Card>
          <Statistic
            title="Esta Semana"
            value={dashboardData?.week.total_hours || 0}
            precision={2}
            suffix="hrs"
            prefix={<DashboardOutlined />}
          />
          <Text type="secondary">
            ${(dashboardData?.week.total_value || 0).toLocaleString()}
          </Text>
        </Card>
      </Col>
      <Col xs={24} sm={8}>
        <Card>
          <Statistic
            title="Entradas Hoy"
            value={dashboardData?.today.entries_count || 0}
            prefix={<ProjectOutlined />}
          />
        </Card>
      </Col>
    </Row>
  );

  // Time entries table columns
  const columns = [
    {
      title: 'Proyecto',
      dataIndex: 'project_name',
      key: 'project_name',
      render: (name: string) => <Text strong>{name}</Text>
    },
    {
      title: 'Descripción',
      dataIndex: 'description',
      key: 'description',
      render: (desc: string) => desc || '-'
    },
    {
      title: 'Horas',
      dataIndex: 'hours',
      key: 'hours',
      render: (hours: number) => `${hours}h`,
      sorter: (a: TimeEntry, b: TimeEntry) => a.hours - b.hours
    },
    {
      title: 'Tiempo',
      key: 'time_range',
      render: (entry: TimeEntry) => {
        if (entry.start_time && entry.end_time) {
          return `${entry.start_time} - ${entry.end_time}`;
        }
        return '-';
      }
    },
    {
      title: 'Facturable',
      dataIndex: 'is_billable',
      key: 'is_billable',
      render: (billable: boolean) => (
        <Tag color={billable ? 'green' : 'orange'}>
          {billable ? 'Sí' : 'No'}
        </Tag>
      )
    },
    {
      title: 'Valor',
      key: 'value',
      render: (entry: TimeEntry) => {
        const value = entry.hours * entry.hourly_rate;
        return `$${value.toLocaleString()}`;
      }
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (entry: TimeEntry) => (
        <Space>
          <Tooltip title="Editar">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => openEditModal(entry)}
            />
          </Tooltip>
          <Tooltip title="Eliminar">
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                Modal.confirm({
                  title: '¿Eliminar entrada?',
                  content: 'Esta acción no se puede deshacer.',
                  okText: 'Eliminar',
                  okType: 'danger',
                  cancelText: 'Cancelar',
                  onOk: () => handleDeleteEntry(entry.id)
                });
              }}
            />
          </Tooltip>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Title level={2}>⏱️ Time Tracking</Title>
        <Text type="secondary">
          Registra y gestiona tu tiempo de trabajo en proyectos
        </Text>
      </div>

      <TimerForm />
      <DashboardStats />

      {/* Time entries table */}
      <Card
        title={
          <Space>
            <ClockCircleOutlined />
            Entradas de Tiempo
          </Space>
        }
        extra={
          <Space>
            <DatePicker
              value={selectedDate}
              onChange={(date) => setSelectedDate(date || dayjs())}
              format="DD/MM/YYYY"
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openCreateModal}
            >
              Nueva Entrada
            </Button>
          </Space>
        }
      >
        {timeEntries.length === 0 ? (
          <Alert
            message="No hay entradas de tiempo"
            description={`No se encontraron entradas para ${selectedDate.format('DD/MM/YYYY')}`}
            type="info"
            showIcon
            style={{ margin: '20px 0' }}
          />
        ) : (
          <Table
            columns={columns}
            dataSource={timeEntries}
            rowKey="id"
            loading={loading}
            pagination={false}
          />
        )}
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        title={editingEntry ? 'Editar Entrada' : 'Nueva Entrada de Tiempo'}
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          setEditingEntry(null);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={editingEntry ? handleUpdateEntry : handleCreateEntry}
        >
          <Form.Item
            name="project_id"
            label="Proyecto"
            rules={[{ required: true, message: 'Seleccione un proyecto' }]}
          >
            <Select placeholder="Seleccionar proyecto">
              {projects.map(project => (
                <Option key={project.id} value={project.id}>
                  {project.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label="Descripción"
          >
            <TextArea rows={3} placeholder="Describe el trabajo realizado..." />
          </Form.Item>

          <Form.Item
            name="hours"
            label="Horas"
            rules={[
              { required: true, message: 'Ingrese las horas trabajadas' },
              { type: 'number', min: 0.1, max: 24, message: 'Entre 0.1 y 24 horas' }
            ]}
          >
            <InputNumber
              min={0.1}
              max={24}
              step={0.25}
              precision={2}
              style={{ width: '100%' }}
              placeholder="Ej: 2.5"
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingEntry ? 'Actualizar' : 'Crear'} Entrada
              </Button>
              <Button 
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingEntry(null);
                  form.resetFields();
                }}
              >
                Cancelar
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};