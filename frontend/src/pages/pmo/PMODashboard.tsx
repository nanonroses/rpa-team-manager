import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Progress,
  Tag,
  Timeline,
  Space,
  Button,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  message,
  Tabs,
  Divider,
  Alert,
  Typography,
  Tooltip,
  Upload,
  Drawer
} from 'antd';
import {
  ProjectOutlined,
  AlertOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  TeamOutlined,
  RiseOutlined,
  FallOutlined,
  PlusOutlined,
  BarChartOutlined,
  LineChartOutlined,
  WarningOutlined,
  TrophyOutlined,
  CalendarOutlined,
  FireOutlined,
  ThunderboltOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  ImportOutlined,
  CodeOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { useAuthStore } from '@/store/authStore';
import apiService from '@/services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

interface PMODashboardData {
  projects: any[];
  overallMetrics: any;
  upcomingMilestones: any[];
  teamWorkload: any[];
}

interface PMOAnalytics {
  executiveSummary: {
    total_projects: number;
    active_projects: number;
    completed_projects: number;
    critical_projects: number;
    over_budget_projects: number;
    delayed_projects: number;
    avg_completion: number;
    avg_satisfaction: number;
    total_planned_budget: number;
    total_actual_cost: number;
    overall_budget_variance: number;
  };
  trendAnalysis: any[];
  budgetAnalysis: any[];
  scheduleAnalysis: any[];
  riskAnalysis: any[];
  teamAnalysis: any[];
  qualityMetrics: any[];
  resourceUtilization: any[];
  satisfactionTrends: any[];
  riskDistribution: any[];
}

interface PMODashboardProps {
  ganttMode?: boolean;
}

export const PMODashboard: React.FC<PMODashboardProps> = ({ ganttMode = false }) => {
  const { user } = useAuthStore();
  const { id: projectIdParam } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<PMODashboardData | null>(null);
  const [analytics, setAnalytics] = useState<PMOAnalytics | null>(null);
  const [milestoneModalVisible, setMilestoneModalVisible] = useState(false);
  const [milestoneForm] = Form.useForm();
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [ganttData, setGanttData] = useState<any>(null);
  const [ganttLoading, setGanttLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editForm] = Form.useForm();
  const [taskModalVisible, setTaskModalVisible] = useState(false);
  const [taskForm] = Form.useForm();
  const [activeTab, setActiveTab] = useState(ganttMode ? 'gantt' : 'overview');
  const [mermaidDrawerVisible, setMermaidDrawerVisible] = useState(false);
  const [mermaidCode, setMermaidCode] = useState('');
  
  // Refs to prevent multiple simultaneous API calls
  const loadingDashboard = useRef(false);
  const loadingGantt = useRef(false);

  // Parse Mermaid code and extract tasks/milestones
  const parseMermaidCode = (mermaidCode: string) => {
    const lines = mermaidCode.split('\n').map(line => line.trim()).filter(line => line);
    const tasks: any[] = [];
    const milestones: any[] = [];
    
    for (const line of lines) {
      // Skip header and empty lines
      if (line.startsWith('gantt') || line.startsWith('title') || line.startsWith('dateFormat') || !line) {
        continue;
      }
      
      // Parse section headers as milestones
      if (line.startsWith('section ')) {
        const sectionName = line.replace('section ', '').trim();
        milestones.push({
          name: sectionName,
          description: `Hito generado desde diagrama Mermaid: ${sectionName}`,
          milestone_type: 'delivery',
          priority: 'medium',
          impact_on_timeline: 'medium'
        });
        continue;
      }
      
      // Parse task lines (format: "Task name :done/active, task-id, start-date, duration")
      const taskMatch = line.match(/([^:]+)\s*:\s*(done|active|crit)?,?\s*([^,]*),?\s*([^,]*),?\s*([^,]*)/);
      if (taskMatch) {
        const [, taskName, status, taskId, startDate, duration] = taskMatch;
        tasks.push({
          title: taskName.trim(),
          description: `Tarea generada desde diagrama Mermaid`,
          task_type: 'feature',
          priority: status === 'crit' ? 'high' : 'medium',
          status: status === 'done' ? 'completed' : 'pending',
          estimated_hours: duration ? parseInt(duration.replace(/\D/g, '')) || 8 : 8
        });
      } else if (line.includes(':')) {
        // Simple task format: "Task name : status"
        const [taskName, status] = line.split(':').map(s => s.trim());
        if (taskName) {
          tasks.push({
            title: taskName,
            description: `Tarea generada desde diagrama Mermaid`,
            task_type: 'feature',
            priority: 'medium',
            status: status === 'done' ? 'completed' : 'pending',
            estimated_hours: 8
          });
        }
      }
    }
    
    return { tasks, milestones };
  };

  // Import Mermaid data
  const handleMermaidImport = async () => {
    if (!mermaidCode.trim()) {
      message.warning('Por favor ingresa código Mermaid válido');
      return;
    }
    
    if (!selectedProjectId) {
      message.error('Por favor selecciona un proyecto antes de importar');
      return;
    }
    
    try {
      const { tasks, milestones } = parseMermaidCode(mermaidCode);
      
      if (tasks.length === 0 && milestones.length === 0) {
        message.warning('No se encontraron tareas ni hitos válidos en el código Mermaid');
        return;
      }
      
      // Create milestones first
      let createdMilestones = 0;
      for (const milestone of milestones) {
        try {
          await apiService.createMilestone({
            ...milestone,
            project_id: selectedProjectId,
            responsible_user_id: user?.id,
            planned_date: dayjs().add(30, 'days').format('YYYY-MM-DD')
          });
          createdMilestones++;
        } catch (error) {
          console.error('Error creating milestone:', error);
        }
      }
      
      // Get project board info first using apiService
      let boardId = null;
      let columnId = null;
      try {
        console.log('Getting boards for project:', selectedProjectId);
        const boards = await apiService.getTaskBoards(selectedProjectId);
        console.log('Boards found:', boards);
        
        if (boards.length > 0) {
          boardId = boards[0].id;
          console.log('Using board ID:', boardId);
          
          // Get board details to find a default column
          const boardData = await apiService.getTaskBoard(boardId);
          console.log('Board data:', boardData);
          
          // Use "To Do" column or first available column
          const todoColumn = boardData.columns.find((col: any) => col.name === 'To Do');
          columnId = todoColumn ? todoColumn.id : boardData.columns[0]?.id;
          console.log('Using column ID:', columnId);
        } else {
          console.warn('No boards found for project');
        }
      } catch (error) {
        console.error('Error getting board info:', error);
      }

      // Create tasks
      let createdTasks = 0;
      if (!boardId || !columnId) {
        console.error('Cannot create tasks: missing boardId or columnId', { boardId, columnId });
        message.warning('No se pudieron crear las tareas: falta información del tablero');
      } else {
        for (const task of tasks) {
          try {
            const taskData = {
              ...task,
              project_id: selectedProjectId,
              board_id: boardId,
              column_id: columnId,
              assignee_id: user?.id,
              due_date: dayjs().add(14, 'days').format('YYYY-MM-DD')
            };
            console.log('Creating task:', taskData);
            await apiService.createTask(taskData);
            createdTasks++;
          } catch (error) {
            console.error('Error creating task:', error);
          }
        }
      }
      
      message.success(`Importación completada: ${createdTasks} tareas y ${createdMilestones} hitos creados`);
      setMermaidDrawerVisible(false);
      setMermaidCode('');
      
      // Reload data with a slight delay to ensure backend processes the data
      setTimeout(async () => {
        await loadDashboardData();
        await loadGanttData(selectedProjectId);
      }, 500);
      
    } catch (error) {
      console.error('Error importing Mermaid:', error);
      message.error('Error al importar el diagrama Mermaid');
    }
  };

  // Load initial data always on mount - no dependencies
  useEffect(() => {
    console.log('🚀 PMO Dashboard mounted - loading initial data');
    loadDashboardData();
    loadAnalytics();
    loadDropdownData();
  }, []);

  // Handle gantt mode and project param separately
  useEffect(() => {
    if (ganttMode && projectIdParam) {
      const projectId = parseInt(projectIdParam, 10);
      console.log('🎯 Gantt mode with project param:', projectId);
      setSelectedProjectId(projectId);
    }
  }, [ganttMode, projectIdParam]);

  // Debug projects state changes
  useEffect(() => {
    console.log('📋 Projects state updated:', projects.length, 'projects available');
    console.log('📋 Projects list:', projects.map((p: any) => ({id: p.id, name: p.name})));
  }, [projects]);

  const loadDashboardData = async () => {
    if (loadingDashboard.current) return;
    
    try {
      loadingDashboard.current = true;
      setLoading(true);
      console.log('📈 Loading PMO dashboard data...');
      const data = await apiService.getPMODashboard();
      console.log('✅ Dashboard data loaded:', {
        projects: data?.projects?.length || 0,
        hasOverallMetrics: !!data?.overallMetrics,
        upcomingMilestones: data?.upcomingMilestones?.length || 0
      });
      setDashboardData(data);
    } catch (error: any) {
      console.error('❌ Error loading PMO dashboard:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Error al cargar el dashboard PMO';
      message.error(errorMessage);
    } finally {
      setLoading(false);
      loadingDashboard.current = false;
    }
  };

  const loadAnalytics = async () => {
    try {
      const data = await apiService.getPMOAnalytics();
      setAnalytics(data);
    } catch (error: any) {
      console.error('Error loading PMO analytics:', error);
      // Solo mostrar error si es crítico, analytics es opcional
    }
  };

  const loadDropdownData = async () => {
    try {
      console.log('📊 Loading dropdown data (users and projects)...');
      const [usersData, projectsData] = await Promise.all([
        apiService.getUsers(),
        apiService.getProjects()
      ]);
      console.log('👥 Users loaded:', usersData?.length || 0);
      console.log('📋 Projects loaded:', projectsData?.length || 0, projectsData?.map((p: any) => ({id: p.id, name: p.name})));
      setUsers(usersData);
      setProjects(projectsData);
    } catch (error) {
      console.error('❌ Error loading dropdown data:', error);
      message.error('Error cargando datos básicos del dashboard');
    }
  };

  const handleCreateMilestone = async (values: any) => {
    try {
      await apiService.createMilestone({
        ...values,
        planned_date: values.planned_date.format('YYYY-MM-DD'),
        actual_date: values.actual_date ? values.actual_date.format('YYYY-MM-DD') : null
      });
      message.success('Hito creado exitosamente');
      setMilestoneModalVisible(false);
      milestoneForm.resetFields();
      loadDashboardData();
      // Reload gantt data if we're in gantt view
      if (selectedProjectId) {
        loadGanttData(selectedProjectId);
      }
    } catch (error) {
      console.error('Error creating milestone:', error);
      message.error('Error al crear el hito');
    }
  };

  const handleCreateTask = async (values: any) => {
    try {
      // For now just show success message since we don't have task creation API
      message.success(`Nueva tarea creada: ${values.title}`);
      console.log('Task creation would send:', {
        ...values,
        start_date: values.start_date ? values.start_date.format('YYYY-MM-DD') : null,
        due_date: values.due_date ? values.due_date.format('YYYY-MM-DD') : null
      });
      setTaskModalVisible(false);
      taskForm.resetFields();
      // Reload gantt data
      if (selectedProjectId) {
        loadGanttData(selectedProjectId);
      }
    } catch (error) {
      console.error('Error creating task:', error);
      message.error('Error al crear la tarea');
    }
  };

  const loadGanttData = async (projectId: number) => {
    if (loadingGantt.current) return;
    
    try {
      loadingGantt.current = true;
      setGanttLoading(true);
      console.log('Loading Gantt data for project:', projectId);
      const data = await apiService.getPMOProjectGantt(projectId);
      console.log('Gantt data received:', data);
      console.log('Data structure:', {
        hasProject: !!data?.project,
        projectName: data?.project?.name,
        milestoneCount: data?.milestones?.length || 0,
        taskCount: data?.tasks?.length || 0,
        isDataTruthy: !!data
      });
      setGanttData(data);
      console.log('Gantt data state set - data is:', !!data ? 'truthy' : 'falsy');
      console.log('Gantt data loaded successfully for project:', data.project?.name || projectId);
    } catch (error: any) {
      console.error('Error loading Gantt data:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Error al cargar datos del cronograma';
      message.error(errorMessage);
      setGanttData(null);
      console.log('Set ganttData to null due to error');
    } finally {
      setGanttLoading(false);
      loadingGantt.current = false;
    }
  };

  useEffect(() => {
    console.log('selectedProjectId changed to:', selectedProjectId);
    if (selectedProjectId) {
      console.log('Loading Gantt data for selected project:', selectedProjectId);
      loadGanttData(selectedProjectId);
    } else {
      console.log('No project selected, clearing Gantt data');
      setGanttData(null);
    }
  }, [selectedProjectId]);

  const handleEditItem = (record: any) => {
    setEditingItem(record);
    editForm.setFieldsValue({
      ...record,
      planned_date: record.planned_date ? dayjs(record.planned_date) : null,
      actual_date: record.actual_date ? dayjs(record.actual_date) : null,
      start_date: record.start_date ? dayjs(record.start_date) : null,
      due_date: record.due_date ? dayjs(record.due_date) : null
    });
    setEditModalVisible(true);
  };

  const handleDeleteItem = async (record: any) => {
    Modal.confirm({
      title: `¿Eliminar ${record.type === 'milestone' ? 'hito' : 'tarea'}?`,
      content: `¿Estás seguro de que quieres eliminar "${record.name || record.title}"?`,
      okText: 'Eliminar',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          if (record.type === 'milestone') {
            await apiService.deleteMilestone(record.id);
            message.success(`Hito "${record.name}" eliminado exitosamente`);
            loadDashboardData();
            // Reload gantt data if we're in gantt view
            if (selectedProjectId) {
              loadGanttData(selectedProjectId);
            }
          } else {
            await apiService.deleteTask(record.id);
            message.success(`Tarea "${record.name}" eliminada exitosamente`);
            loadDashboardData();
            // Reload gantt data if we're in gantt view
            if (selectedProjectId) {
              loadGanttData(selectedProjectId);
            }
          }
        } catch (error) {
          console.error('Error deleting item:', error);
          message.error('Error al eliminar elemento');
        }
      }
    });
  };

  const handleSaveEdit = async (values: any) => {
    try {
      if (editingItem.type === 'milestone') {
        const updateData = {
          ...values,
          planned_date: values.planned_date ? values.planned_date.format('YYYY-MM-DD') : values.planned_date,
          actual_date: values.actual_date ? values.actual_date.format('YYYY-MM-DD') : null
        };
        await apiService.updateMilestone(editingItem.id, updateData);
        message.success(`Hito actualizado: ${values.name}`);
      } else {
        // Task update - use real updateTask API
        const updateData = {
          ...values,
          start_date: values.start_date ? values.start_date.format('YYYY-MM-DD') : null,
          due_date: values.due_date ? values.due_date.format('YYYY-MM-DD') : null
        };
        console.log('🔄 Updating task with data:', updateData);
        await apiService.updateTask(editingItem.id, updateData);
        message.success(`Tarea actualizada: ${values.title}`);
      }
      setEditModalVisible(false);
      setEditingItem(null);
      editForm.resetFields();
      // Reload gantt data
      if (selectedProjectId) {
        loadGanttData(selectedProjectId);
      }
    } catch (error) {
      console.error('Error updating item:', error);
      message.error('Error al actualizar elemento');
    }
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy': return '#52c41a';
      case 'warning': return '#faad14';
      case 'critical': return '#f5222d';
      default: return '#d9d9d9';
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'warning': return <AlertOutlined style={{ color: '#faad14' }} />;
      case 'critical': return <AlertOutlined style={{ color: '#f5222d' }} />;
      default: return <ClockCircleOutlined style={{ color: '#d9d9d9' }} />;
    }
  };

  const getResponsibilityIndicator = (responsibility: string) => {
    switch (responsibility) {
      case 'internal': 
        return { icon: '🏢', color: '#1890ff', bg: '#e6f7ff', label: 'Interno' };
      case 'client': 
        return { icon: '👤', color: '#faad14', bg: '#fff7e6', label: 'Cliente' };
      case 'external': 
        return { icon: '🏪', color: '#f5222d', bg: '#fff1f0', label: 'Externo' };
      case 'shared': 
        return { icon: '🤝', color: '#722ed1', bg: '#f9f0ff', label: 'Compartido' };
      default: 
        return { icon: '🏢', color: '#1890ff', bg: '#e6f7ff', label: 'Interno' };
    }
  };

  const projectColumns = [
    {
      title: 'Proyecto',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: any) => (
        <Space>
          {getHealthIcon(record.project_health_status)}
          <strong>{text}</strong>
        </Space>
      ),
    },
    {
      title: 'Progreso',
      dataIndex: 'completion_percentage',
      key: 'completion_percentage',
      render: (value: number) => (
        <Progress 
          percent={value || 0} 
          size="small" 
          status={value >= 100 ? 'success' : value >= 75 ? 'active' : 'exception'}
        />
      ),
    },
    {
      title: 'Desvío (días)',
      dataIndex: 'schedule_variance_days',
      key: 'schedule_variance_days',
      render: (days: number) => (
        <Tag color={days > 0 ? 'green' : days < -2 ? 'red' : 'orange'}>
          {days > 0 ? `+${days}` : days}
        </Tag>
      ),
    },
    {
      title: 'Presupuesto',
      dataIndex: 'cost_variance_percentage',
      key: 'cost_variance_percentage',
      render: (variance: number) => (
        <Tag color={variance > 10 ? 'red' : variance > 5 ? 'orange' : 'green'}>
          {variance > 0 ? `+${variance}%` : `${variance}%`}
        </Tag>
      ),
    },
    {
      title: 'Riesgo',
      dataIndex: 'risk_level',
      key: 'risk_level',
      render: (risk: string) => {
        const colors = { low: 'green', medium: 'orange', high: 'red', critical: 'purple' };
        return <Tag color={colors[risk as keyof typeof colors]}>{risk?.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Deadline',
      dataIndex: 'days_to_deadline',
      key: 'days_to_deadline',
      render: (days: number) => {
        if (!days) return 'N/A';
        const color = days < 0 ? 'red' : days < 7 ? 'orange' : 'green';
        return <Tag color={color}>{days < 0 ? `${Math.abs(days)} días atrás` : `${days} días`}</Tag>;
      },
    }
  ];

  const milestoneColumns = [
    {
      title: 'Hito',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Proyecto',
      dataIndex: 'project_name',
      key: 'project_name',
    },
    {
      title: 'Fecha Planificada',
      dataIndex: 'planned_date',
      key: 'planned_date',
      render: (date: string) => dayjs(date).format('DD/MM/YYYY'),
    },
    {
      title: 'Días Restantes',
      dataIndex: 'days_until',
      key: 'days_until',
      render: (days: number) => {
        const color = days < 0 ? 'red' : days < 3 ? 'orange' : 'green';
        return <Tag color={color}>{days < 0 ? 'Vencido' : `${days} días`}</Tag>;
      },
    },
    {
      title: 'Responsable',
      dataIndex: 'responsible_name',
      key: 'responsible_name',
      render: (name: string) => name || 'Sin asignar',
    }
  ];

  if (loading) {
    return <div>Cargando...</div>;
  }

  return (
    <div style={{ padding: '24px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: '24px' }}>
        <Col>
          <Title level={2}>PMO Dashboard</Title>
          <Text type="secondary">Vista ejecutiva de proyectos y métricas</Text>
        </Col>
        <Col>
          <Space>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => setMilestoneModalVisible(true)}
            >
              Crear Hito
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Métricas generales */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Proyectos Totales"
              value={dashboardData?.overallMetrics?.total_projects || 0}
              prefix={<ProjectOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Proyectos Críticos"
              value={dashboardData?.overallMetrics?.critical_projects || 0}
              prefix={<AlertOutlined />}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Completitud Promedio"
              value={Math.round(dashboardData?.overallMetrics?.avg_completion || 0)}
              suffix="%"
              prefix={<RiseOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Satisfacción Cliente"
              value={dashboardData?.overallMetrics?.avg_satisfaction?.toFixed(1) || 'N/A'}
              suffix="/10"
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="Vista General" key="overview">
          {/* Dashboard Ejecutivo Completo */}
          
          {/* Fila 1: KPIs Críticos */}
          <Row gutter={[16, 16]} style={{ marginBottom: '20px' }}>
            <Col xs={24} sm={12} md={6}>
              <Card size="small">
                <Statistic
                  title="Proyectos Activos"
                  value={dashboardData?.overallMetrics?.active_projects || 0}
                  prefix={<ThunderboltOutlined style={{ color: '#1890ff' }} />}
                  valueStyle={{ color: '#1890ff', fontSize: '24px' }}
                />
                <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                  de {dashboardData?.overallMetrics?.total_projects || 0} totales
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card size="small">
                <Statistic
                  title="En Riesgo"
                  value={dashboardData?.overallMetrics?.critical_projects || 0}
                  prefix={<WarningOutlined style={{ color: '#ff4d4f' }} />}
                  valueStyle={{ color: '#ff4d4f', fontSize: '24px' }}
                />
                <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                  requieren atención
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card size="small">
                <Statistic
                  title="Presupuesto Total"
                  value={Math.round((dashboardData?.overallMetrics?.total_planned_budget || 0) / 1000000)}
                  suffix="M"
                  prefix={<DollarOutlined style={{ color: '#52c41a' }} />}
                  valueStyle={{ color: '#52c41a', fontSize: '24px' }}
                />
                <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                  CLP planificado
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card size="small">
                <Statistic
                  title="Progreso Global"
                  value={Math.round(dashboardData?.overallMetrics?.avg_completion || 0)}
                  suffix="%"
                  prefix={<TrophyOutlined style={{ color: '#faad14' }} />}
                  valueStyle={{ color: '#faad14', fontSize: '24px' }}
                />
                <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                  completitud promedio
                </div>
              </Card>
            </Col>
          </Row>

          {/* Fila 2: Alertas Críticas y Resumen Visual */}
          <Row gutter={[16, 16]} style={{ marginBottom: '20px' }}>
            {/* Panel de Alertas Críticas */}
            <Col xs={24} lg={8}>
              <Card 
                title={<span><FireOutlined style={{ color: '#ff4d4f' }} /> Alertas Críticas</span>} 
                size="small"
                style={{ height: '300px' }}
              >
                <div style={{ height: '240px', overflowY: 'auto' }}>
                  {dashboardData?.projects
                    ?.filter((p: any) => p.project_health_status === 'critical' || p.days_to_deadline < 7)
                    ?.slice(0, 8)
                    ?.map((project: any) => (
                      <Alert
                        key={project.id}
                        message={project.name}
                        description={
                          project.days_to_deadline < 0 
                            ? `Retrasado ${Math.abs(project.days_to_deadline)} días`
                            : project.days_to_deadline < 7
                              ? `Vence en ${project.days_to_deadline} días`
                              : 'Estado crítico'
                        }
                        type={project.days_to_deadline < 0 ? 'error' : 'warning'}
                        size="small"
                        style={{ marginBottom: '8px' }}
                        showIcon
                      />
                    )) || (
                    <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
                      <CheckCircleOutlined style={{ fontSize: '32px', marginBottom: '8px' }} />
                      <div>No hay alertas críticas</div>
                    </div>
                  )}
                </div>
              </Card>
            </Col>

            {/* Distribución de Estados */}
            <Col xs={24} lg={8}>
              <Card 
                title={<span><BarChartOutlined /> Distribución de Estados</span>} 
                size="small"
                style={{ height: '300px' }}
              >
                <div style={{ height: '240px', padding: '10px' }}>
                  {['healthy', 'warning', 'critical'].map(status => {
                    const count = dashboardData?.projects?.filter((p: any) => p.project_health_status === status)?.length || 0;
                    const total = dashboardData?.projects?.length || 1;
                    const percentage = Math.round((count / total) * 100);
                    
                    return (
                      <div key={status} style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ 
                            color: status === 'healthy' ? '#52c41a' : status === 'warning' ? '#faad14' : '#ff4d4f',
                            fontWeight: 'bold'
                          }}>
                            {status === 'healthy' ? '🟢 Saludables' : status === 'warning' ? '🟡 En Alerta' : '🔴 Críticos'}
                          </span>
                          <span>{count} ({percentage}%)</span>
                        </div>
                        <div style={{ 
                          background: '#f0f0f0', 
                          borderRadius: '10px', 
                          height: '10px',
                          overflow: 'hidden'
                        }}>
                          <div style={{ 
                            width: `${percentage}%`,
                            height: '100%',
                            background: status === 'healthy' ? '#52c41a' : status === 'warning' ? '#faad14' : '#ff4d4f',
                            borderRadius: '10px'
                          }} />
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Satisfacción Cliente */}
                  <Divider style={{ margin: '16px 0' }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
                      {dashboardData?.overallMetrics?.avg_satisfaction?.toFixed(1) || 'N/A'}/10
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Satisfacción Promedio</div>
                  </div>
                </div>
              </Card>
            </Col>

            {/* Carga de Trabajo del Equipo */}
            <Col xs={24} lg={8}>
              <Card 
                title={<span><TeamOutlined /> Carga del Equipo</span>} 
                size="small"
                style={{ height: '300px' }}
              >
                <div style={{ height: '240px', overflowY: 'auto' }}>
                  {dashboardData?.teamWorkload?.slice(0, 6)?.map((member: any) => (
                    <div key={member.id} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      padding: '8px',
                      background: '#fafafa',
                      borderRadius: '4px',
                      marginBottom: '6px'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', fontSize: '12px' }}>
                          {member.full_name}
                        </div>
                        <div style={{ fontSize: '10px', color: '#666' }}>
                          {member.assigned_projects} proyectos • {Math.round(member.avg_project_completion || 0)}% prog.
                        </div>
                      </div>
                      <div style={{ 
                        padding: '2px 6px',
                        borderRadius: '10px',
                        fontSize: '10px',
                        background: member.remaining_hours > 40 ? '#fff1f0' : member.remaining_hours > 20 ? '#fff7e6' : '#f6ffed',
                        color: member.remaining_hours > 40 ? '#f5222d' : member.remaining_hours > 20 ? '#fa8c16' : '#52c41a'
                      }}>
                        {Math.round(member.remaining_hours || 0)}h
                      </div>
                    </div>
                  )) || (
                    <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
                      Sin datos del equipo
                    </div>
                  )}
                </div>
              </Card>
            </Col>
          </Row>

          {/* Fila 3: Tabla de Proyectos Mejorada y Timeline */}
          <Row gutter={[16, 16]}>
            {/* Tabla de proyectos mejorada */}
            <Col xs={24} lg={16}>
              <Card 
                title={<span><EyeOutlined /> Estado Detallado de Proyectos</span>} 
                extra={
                  <Space>
                    <Tag>Total: {dashboardData?.projects?.length || 0}</Tag>
                    <Button 
                      size="small" 
                      icon={<EyeOutlined />}
                      onClick={() => setActiveTab('gantt')}
                    >
                      Ver Gantt
                    </Button>
                  </Space>
                }
                size="small"
              >
                <Table
                  dataSource={dashboardData?.projects || []}
                  columns={[
                    {
                      title: 'Proyecto',
                      dataIndex: 'name',
                      key: 'name',
                      width: 200,
                      render: (text: string, record: any) => (
                        <div>
                          <div style={{ fontWeight: 'bold', fontSize: '12px' }}>{text}</div>
                          <div style={{ fontSize: '10px', color: '#666' }}>
                            {getHealthIcon(record.project_health_status)} {record.assigned_to_name || 'Sin asignar'}
                          </div>
                        </div>
                      ),
                    },
                    {
                      title: 'Progreso',
                      dataIndex: 'completion_percentage',
                      key: 'progress',
                      width: 120,
                      render: (value: number) => (
                        <Progress 
                          percent={value || 0} 
                          size="small" 
                          strokeColor={value > 80 ? '#52c41a' : value > 50 ? '#faad14' : '#ff4d4f'}
                        />
                      ),
                    },
                    {
                      title: 'Deadline',
                      key: 'deadline',
                      width: 100,
                      render: (record: any) => (
                        <div style={{ fontSize: '11px' }}>
                          <div>{record.end_date ? dayjs(record.end_date).format('DD/MM/YY') : 'N/A'}</div>
                          <div style={{ 
                            color: record.days_to_deadline < 0 ? '#ff4d4f' : record.days_to_deadline < 7 ? '#faad14' : '#52c41a'
                          }}>
                            {record.days_to_deadline !== null 
                              ? `${record.days_to_deadline < 0 ? 'Retrasado' : record.days_to_deadline === 0 ? 'Hoy' : record.days_to_deadline + 'd'}`
                              : 'N/A'
                            }
                          </div>
                        </div>
                      ),
                    },
                    {
                      title: 'Presupuesto',
                      key: 'budget',
                      width: 100,
                      render: (record: any) => (
                        <div style={{ fontSize: '11px' }}>
                          <div>{record.planned_budget ? `$${(record.planned_budget / 1000000).toFixed(1)}M` : 'N/A'}</div>
                          <div style={{ 
                            color: record.cost_variance_percentage > 10 ? '#ff4d4f' : record.cost_variance_percentage > 0 ? '#faad14' : '#52c41a'
                          }}>
                            {record.cost_variance_percentage ? `${record.cost_variance_percentage > 0 ? '+' : ''}${record.cost_variance_percentage.toFixed(1)}%` : 'N/A'}
                          </div>
                        </div>
                      ),
                    },
                    {
                      title: 'Acciones',
                      key: 'actions',
                      width: 80,
                      render: (record: any) => (
                        <Button 
                          type="primary" 
                          size="small" 
                          ghost
                          onClick={() => {
                            setSelectedProjectId(record.id);
                            setActiveTab('gantt');
                          }}
                        >
                          Gantt
                        </Button>
                      ),
                    }
                  ]}
                  rowKey="id"
                  size="small"
                  pagination={{ pageSize: 8, showSizeChanger: false }}
                  scroll={{ y: 300 }}
                />
              </Card>
            </Col>

            {/* Hitos próximos mejorado */}
            <Col xs={24} lg={8}>
              <Card 
                title={<span><CalendarOutlined /> Timeline de Entregas</span>} 
                extra={<Tag color="blue">{dashboardData?.upcomingMilestones?.length || 0} hitos</Tag>}
                size="small"
              >
                <div style={{ height: '385px', overflowY: 'auto' }}>
                  <Timeline size="small">
                    {dashboardData?.upcomingMilestones?.slice(0, 12).map((milestone: any) => (
                      <Timeline.Item
                        key={milestone.id}
                        color={
                          milestone.days_until < 0 ? 'red' : 
                          milestone.days_until < 3 ? 'orange' : 
                          milestone.days_until < 7 ? 'blue' : 'green'
                        }
                        dot={
                          milestone.days_until < 0 ? <WarningOutlined style={{ color: 'red' }} /> :
                          milestone.days_until < 3 ? <ClockCircleOutlined style={{ color: 'orange' }} /> :
                          undefined
                        }
                      >
                        <div>
                          <div style={{ fontWeight: 'bold', fontSize: '12px' }}>
                            {milestone.name}
                          </div>
                          <div style={{ fontSize: '11px', color: '#666', marginBottom: '2px' }}>
                            {milestone.project_name}
                          </div>
                          <div style={{ 
                            fontSize: '10px',
                            color: milestone.days_until < 0 ? '#ff4d4f' : milestone.days_until < 3 ? '#faad14' : '#52c41a'
                          }}>
                            📅 {dayjs(milestone.planned_date).format('DD/MM/YYYY')} 
                            {milestone.days_until !== null && (
                              <span style={{ marginLeft: '8px' }}>
                                ({milestone.days_until < 0 ? `Retrasado ${Math.abs(milestone.days_until)}d` : 
                                  milestone.days_until === 0 ? 'HOY' : `${milestone.days_until}d`})
                              </span>
                            )}
                          </div>
                          {milestone.responsible_name && (
                            <div style={{ fontSize: '10px', color: '#999', marginTop: '2px' }}>
                              👤 {milestone.responsible_name}
                            </div>
                          )}
                        </div>
                      </Timeline.Item>
                    ))}
                  </Timeline>
                </div>
              </Card>
            </Col>
          </Row>
        </TabPane>

        <TabPane tab="Análisis" key="analytics">
          {analytics ? (
            <div>
              {/* Executive Summary Cards */}
              <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
                <Col xs={24} sm={12} md={6}>
                  <Card size="small" className="executive-card">
                    <Statistic
                      title="Proyectos Activos"
                      value={analytics.executiveSummary?.active_projects || 0}
                      suffix={`/ ${analytics.executiveSummary?.total_projects || 0}`}
                      prefix={<ProjectOutlined style={{ color: '#1890ff' }} />}
                      valueStyle={{ color: '#1890ff', fontSize: '20px' }}
                    />
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                      {analytics.executiveSummary?.completed_projects || 0} completados
                    </div>
                  </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Card size="small" className="executive-card">
                    <Statistic
                      title="En Riesgo Crítico"
                      value={analytics.executiveSummary?.critical_projects || 0}
                      prefix={<AlertOutlined style={{ color: '#ff4d4f' }} />}
                      valueStyle={{ color: '#ff4d4f', fontSize: '20px' }}
                    />
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                      {analytics.executiveSummary?.over_budget_projects || 0} sobre presupuesto
                    </div>
                  </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Card size="small" className="executive-card">
                    <Statistic
                      title="Desempeño Global"
                      value={analytics.executiveSummary?.avg_completion || 0}
                      suffix="%"
                      prefix={<RiseOutlined style={{ color: '#52c41a' }} />}
                      valueStyle={{ color: '#52c41a', fontSize: '20px' }}
                    />
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                      {analytics.executiveSummary?.delayed_projects || 0} proyectos retrasados
                    </div>
                  </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Card size="small" className="executive-card">
                    <Statistic
                      title="Satisfacción Cliente"
                      value={analytics.executiveSummary?.avg_satisfaction || 0}
                      suffix="/10"
                      prefix={<TrophyOutlined style={{ color: '#faad14' }} />}
                      valueStyle={{ color: '#faad14', fontSize: '20px' }}
                    />
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                      promedio general
                    </div>
                  </Card>
                </Col>
              </Row>

              {/* Main Analytics Grid */}
              <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
                {/* Budget Performance */}
                <Col xs={24} lg={12}>
                  <Card 
                    title={
                      <span>
                        <DollarOutlined style={{ marginRight: '8px', color: '#52c41a' }} />
                        Desempeño Presupuestario
                      </span>
                    }
                    extra={
                      <Tag color="blue">
                        Varianza: {analytics.executiveSummary?.overall_budget_variance?.toFixed(1) || 0}%
                      </Tag>
                    }
                    size="small"
                  >
                    <div style={{ height: '300px', overflowY: 'auto' }}>
                      {analytics.budgetAnalysis?.slice(0, 8)?.map((project: any, index: number) => (
                        <div 
                          key={project.project_id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px',
                            background: index % 2 === 0 ? '#fafafa' : 'white',
                            borderRadius: '4px',
                            marginBottom: '4px',
                            border: project.budget_status === 'critical' ? '1px solid #ff4d4f' : '1px solid transparent'
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 'bold', fontSize: '12px' }}>
                              {project.project_name}
                            </div>
                            <div style={{ fontSize: '10px', color: '#666' }}>
                              PM: {project.project_manager || 'Sin asignar'}
                            </div>
                            <div style={{ fontSize: '10px', color: '#666' }}>
                              Progreso: {project.completion_percentage || 0}%
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '11px', fontWeight: 'bold' }}>
                              ${(project.planned_budget / 1000000).toFixed(1)}M
                            </div>
                            <Tag 
                              size="small"
                              color={
                                project.budget_status === 'critical' ? 'red' :
                                project.budget_status === 'warning' ? 'orange' :
                                project.budget_status === 'under_budget' ? 'green' : 'blue'
                              }
                            >
                              {project.cost_variance_percentage > 0 ? '+' : ''}{project.cost_variance_percentage?.toFixed(1) || 0}%
                            </Tag>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </Col>

                {/* Schedule Performance */}
                <Col xs={24} lg={12}>
                  <Card 
                    title={
                      <span>
                        <ClockCircleOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                        Desempeño de Cronograma
                      </span>
                    }
                    size="small"
                  >
                    <div style={{ height: '300px', overflowY: 'auto' }}>
                      {analytics.scheduleAnalysis?.slice(0, 8)?.map((project: any, index: number) => (
                        <div 
                          key={project.project_id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px',
                            background: index % 2 === 0 ? '#fafafa' : 'white',
                            borderRadius: '4px',
                            marginBottom: '4px',
                            border: project.schedule_status === 'severely_delayed' ? '1px solid #ff4d4f' : '1px solid transparent'
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 'bold', fontSize: '12px' }}>
                              {project.project_name}
                            </div>
                            <div style={{ fontSize: '10px', color: '#666' }}>
                              {project.planned_end ? `Deadline: ${dayjs(project.planned_end).format('DD/MM/YY')}` : 'Sin deadline'}
                            </div>
                            <div style={{ fontSize: '10px', color: '#666' }}>
                              Progreso: {project.completion_percentage || 0}%
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ 
                              fontSize: '11px', 
                              fontWeight: 'bold',
                              color: project.days_to_deadline < 0 ? '#ff4d4f' : project.days_to_deadline < 7 ? '#faad14' : '#52c41a'
                            }}>
                              {project.days_to_deadline !== null ? 
                                (project.days_to_deadline < 0 ? `${Math.abs(project.days_to_deadline)}d atrás` : `${project.days_to_deadline}d`) : 
                                'N/A'
                              }
                            </div>
                            <Tag 
                              size="small"
                              color={
                                project.schedule_status === 'severely_delayed' ? 'red' :
                                project.schedule_status === 'delayed' ? 'orange' :
                                project.schedule_status === 'ahead_of_schedule' ? 'green' : 'blue'
                              }
                            >
                              {project.schedule_variance_days > 0 ? '+' : ''}{project.schedule_variance_days || 0}d
                            </Tag>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </Col>
              </Row>

              {/* Risk Analysis & Team Performance */}
              <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
                <Col xs={24} lg={8}>
                  <Card 
                    title={
                      <span>
                        <WarningOutlined style={{ marginRight: '8px', color: '#ff4d4f' }} />
                        Análisis de Riesgos
                      </span>
                    }
                    size="small"
                  >
                    <div style={{ height: '300px', overflowY: 'auto' }}>
                      {/* Risk Distribution */}
                      <div style={{ marginBottom: '16px' }}>
                        {analytics.riskDistribution?.map((risk: any) => (
                          <div key={risk.risk_level} style={{ marginBottom: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ 
                                fontSize: '12px',
                                fontWeight: 'bold',
                                color: risk.risk_level === 'critical' ? '#ff4d4f' : 
                                       risk.risk_level === 'high' ? '#fa8c16' : 
                                       risk.risk_level === 'medium' ? '#faad14' : '#52c41a'
                              }}>
                                {risk.risk_level?.toUpperCase()}
                              </span>
                              <span style={{ fontSize: '11px' }}>{risk.project_count} ({risk.percentage}%)</span>
                            </div>
                            <Progress 
                              percent={risk.percentage} 
                              showInfo={false}
                              size="small"
                              strokeColor={
                                risk.risk_level === 'critical' ? '#ff4d4f' :
                                risk.risk_level === 'high' ? '#fa8c16' :
                                risk.risk_level === 'medium' ? '#faad14' : '#52c41a'
                              }
                            />
                            <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>
                              Satisfacción: {risk.avg_satisfaction?.toFixed(1) || 'N/A'}/10
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* High Priority Projects */}
                      <Divider style={{ margin: '12px 0' }}>Proyectos Prioritarios</Divider>
                      {analytics.riskAnalysis?.filter((p: any) => p.priority_level === 'high_priority')?.slice(0, 3)?.map((project: any) => (
                        <Alert
                          key={project.project_id}
                          message={project.project_name}
                          description={`${project.risk_level?.toUpperCase()} - ${project.schedule_variance_days}d retraso`}
                          type="error"
                          size="small"
                          style={{ marginBottom: '8px' }}
                          showIcon
                        />
                      ))}
                    </div>
                  </Card>
                </Col>

                <Col xs={24} lg={8}>
                  <Card 
                    title={
                      <span>
                        <TeamOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                        Performance del Equipo
                      </span>
                    }
                    size="small"
                  >
                    <div style={{ height: '300px', overflowY: 'auto' }}>
                      {analytics.teamAnalysis?.slice(0, 6)?.map((member: any, index: number) => (
                        <div 
                          key={member.full_name}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px',
                            background: index % 2 === 0 ? '#fafafa' : 'white',
                            borderRadius: '6px',
                            marginBottom: '6px',
                            border: '1px solid #f0f0f0'
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 'bold', fontSize: '12px' }}>
                              {member.full_name}
                            </div>
                            <div style={{ fontSize: '10px', color: '#666', marginBottom: '2px' }}>
                              {member.role} • {member.total_projects} proyectos
                            </div>
                            <div style={{ fontSize: '10px', color: '#666' }}>
                              Satisfacción: {member.avg_satisfaction?.toFixed(1) || 'N/A'}/10
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1890ff' }}>
                              {member.avg_completion?.toFixed(0) || 0}%
                            </div>
                            <div style={{ fontSize: '10px', color: '#666' }}>
                              Velocidad: {member.avg_velocity?.toFixed(1) || 'N/A'}
                            </div>
                            <div style={{ fontSize: '9px', marginTop: '2px' }}>
                              <Tag size="small" color={member.avg_budget_variance > 10 ? 'red' : member.avg_budget_variance > 0 ? 'orange' : 'green'}>
                                {member.avg_budget_variance > 0 ? '+' : ''}{member.avg_budget_variance?.toFixed(1) || 0}% budget
                              </Tag>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </Col>

                <Col xs={24} lg={8}>
                  <Card 
                    title={
                      <span>
                        <BarChartOutlined style={{ marginRight: '8px', color: '#52c41a' }} />
                        Calidad & Satisfacción
                      </span>
                    }
                    size="small"
                  >
                    <div style={{ height: '300px', overflowY: 'auto' }}>
                      {/* Quality Overview */}
                      <div style={{ marginBottom: '16px', padding: '8px', background: '#f9f9f9', borderRadius: '4px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                          Resumen de Calidad
                        </div>
                        <div style={{ fontSize: '10px', color: '#666' }}>
                          Bugs totales: {analytics.qualityMetrics?.reduce((acc: number, p: any) => acc + (p.bugs_found || 0), 0) || 0}
                        </div>
                        <div style={{ fontSize: '10px', color: '#666' }}>
                          Resueltos: {analytics.qualityMetrics?.reduce((acc: number, p: any) => acc + (p.bugs_resolved || 0), 0) || 0}
                        </div>
                      </div>

                      {/* Top Projects by Satisfaction */}
                      {analytics.qualityMetrics?.slice(0, 6)?.map((project: any, index: number) => (
                        <div 
                          key={project.project_id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px',
                            background: index % 2 === 0 ? '#fafafa' : 'white',
                            borderRadius: '4px',
                            marginBottom: '4px',
                            border: project.quality_status === 'critical' ? '1px solid #ff4d4f' : '1px solid transparent'
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 'bold', fontSize: '11px' }}>
                              {project.project_name}
                            </div>
                            <div style={{ fontSize: '9px', color: '#666' }}>
                              Bugs: {project.bugs_found || 0} / Resueltos: {project.bugs_resolved || 0}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#faad14' }}>
                              {project.client_satisfaction_score?.toFixed(1) || 'N/A'}/10
                            </div>
                            <Tag 
                              size="small"
                              color={
                                project.quality_status === 'excellent' ? 'green' :
                                project.quality_status === 'good' ? 'blue' :
                                project.quality_status === 'needs_attention' ? 'orange' :
                                project.quality_status === 'critical' ? 'red' : 'default'
                              }
                            >
                              {project.resolution_rate?.toFixed(0) || 0}%
                            </Tag>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </Col>
              </Row>

              {/* Client Satisfaction & Resource Utilization */}
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={12}>
                  <Card 
                    title={
                      <span>
                        <TrophyOutlined style={{ marginRight: '8px', color: '#faad14' }} />
                        Satisfacción por Cliente
                      </span>
                    }
                    size="small"
                  >
                    <Table
                      dataSource={analytics.satisfactionTrends?.slice(0, 8) || []}
                      columns={[
                        { 
                          title: 'Cliente', 
                          dataIndex: 'client_name', 
                          key: 'client_name',
                          width: 120,
                          render: (name: string) => (
                            <div style={{ fontSize: '11px', fontWeight: 'bold' }}>{name}</div>
                          )
                        },
                        { 
                          title: 'Proyectos', 
                          dataIndex: 'total_projects', 
                          key: 'total_projects',
                          width: 80,
                          align: 'center' as const
                        },
                        { 
                          title: 'Satisfacción', 
                          dataIndex: 'avg_satisfaction', 
                          key: 'avg_satisfaction',
                          width: 90,
                          render: (value: number) => (
                            <Tag color={value >= 8 ? 'green' : value >= 6 ? 'blue' : 'orange'}>
                              {value?.toFixed(1) || 'N/A'}/10
                            </Tag>
                          )
                        },
                        { 
                          title: 'A Tiempo', 
                          dataIndex: 'on_time_rate', 
                          key: 'on_time_rate',
                          width: 80,
                          render: (value: number) => `${value?.toFixed(0) || 0}%`
                        },
                        { 
                          title: 'En Presupuesto', 
                          dataIndex: 'on_budget_rate', 
                          key: 'on_budget_rate',
                          width: 100,
                          render: (value: number) => (
                            <Tag color={value >= 80 ? 'green' : value >= 60 ? 'blue' : 'orange'} size="small">
                              {value?.toFixed(0) || 0}%
                            </Tag>
                          )
                        }
                      ]}
                      size="small"
                      pagination={false}
                      scroll={{ y: 280 }}
                    />
                  </Card>
                </Col>

                <Col xs={24} lg={12}>
                  <Card 
                    title={
                      <span>
                        <ThunderboltOutlined style={{ marginRight: '8px', color: '#722ed1' }} />
                        Utilización de Recursos
                      </span>
                    }
                    size="small"
                  >
                    <div style={{ height: '320px', overflowY: 'auto' }}>
                      {analytics.resourceUtilization?.map((resource: any, index: number) => (
                        <div 
                          key={resource.full_name}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px',
                            background: index % 2 === 0 ? '#fafafa' : 'white',
                            borderRadius: '6px',
                            marginBottom: '6px',
                            border: resource.utilization_status === 'overutilized' ? '1px solid #ff4d4f' : '1px solid #f0f0f0'
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 'bold', fontSize: '12px' }}>
                              {resource.full_name}
                            </div>
                            <div style={{ fontSize: '10px', color: '#666', marginBottom: '2px' }}>
                              {resource.role} • {resource.assigned_projects} proyectos
                            </div>
                            <div style={{ fontSize: '10px', color: '#666' }}>
                              {resource.total_planned_hours}h plan / {resource.total_actual_hours}h real
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ 
                              fontSize: '14px', 
                              fontWeight: 'bold', 
                              color: resource.utilization_status === 'overutilized' ? '#ff4d4f' : 
                                     resource.utilization_status === 'underutilized' ? '#faad14' : '#52c41a'
                            }}>
                              {resource.utilization_percentage?.toFixed(0) || 0}%
                            </div>
                            <div style={{ fontSize: '10px', color: '#666' }}>
                              Velocidad: {resource.avg_velocity?.toFixed(1) || 'N/A'}
                            </div>
                            <Tag 
                              size="small"
                              color={
                                resource.utilization_status === 'overutilized' ? 'red' :
                                resource.utilization_status === 'underutilized' ? 'orange' : 'green'
                              }
                            >
                              {resource.utilization_status === 'overutilized' ? 'Sobrecargado' :
                               resource.utilization_status === 'underutilized' ? 'Subutilizado' : 'Óptimo'}
                            </Tag>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </Col>
              </Row>
            </div>
          ) : (
            <Card>
              <div style={{ textAlign: 'center', padding: '60px' }}>
                <BarChartOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }} />
                <Title level={4} type="secondary">Cargando Analytics...</Title>
                <Text type="secondary">Preparando análisis avanzado de PMO</Text>
              </div>
            </Card>
          )}
        </TabPane>

        <TabPane tab="Gantt Chart" key="gantt">
          {!selectedProjectId ? (
            // Vista de selección de proyecto
            <Card title="Seleccionar Proyecto para Vista Gantt">
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Title level={4}>Selecciona un proyecto para abrir la vista Gantt</Title>
                {projects.length === 0 && !loading && (
                  <Alert
                    message="No se encontraron proyectos"
                    description="No hay proyectos disponibles para mostrar el Gantt Chart. Verifica que existan proyectos en el sistema."
                    type="warning"
                    style={{ marginBottom: '20px', textAlign: 'left' }}
                    showIcon
                  />
                )}
                <Select
                  size="large"
                  placeholder={projects.length === 0 ? "Cargando proyectos..." : "Elegir proyecto..."}
                  style={{ width: '300px', marginBottom: '20px' }}
                  value={selectedProjectId}
                  onChange={(value) => {
                    console.log('🎯 Project selected:', value);
                    setSelectedProjectId(value);
                  }}
                  loading={projects.length === 0}
                  notFoundContent={projects.length === 0 ? "Cargando..." : "No hay proyectos"}
                >
                  {projects.map((project: any) => (
                    <Select.Option key={project.id} value={project.id}>
                      {project.name}
                    </Select.Option>
                  ))}
                </Select>
                <br />
                <Text type="secondary">O selecciona un proyecto de la lista:</Text>
                <Table
                  dataSource={dashboardData?.projects || []}
                  columns={[
                    { 
                      title: 'Proyecto', 
                      dataIndex: 'name', 
                      key: 'name',
                      render: (name: string, record: any) => (
                        <Button 
                          type="link" 
                          onClick={() => {
                            console.log('🎯 Project selected from table:', record.id, name);
                            setSelectedProjectId(record.id);
                          }}
                          style={{ padding: 0, height: 'auto', fontWeight: 'bold' }}
                        >
                          {name}
                        </Button>
                      )
                    },
                    { 
                      title: 'Estado', 
                      dataIndex: 'status', 
                      key: 'status',
                      render: (status: string) => <Tag color="blue">{status}</Tag>
                    },
                    { 
                      title: 'Progreso', 
                      dataIndex: 'completion_percentage', 
                      key: 'progress',
                      render: (value: number) => <Progress percent={value || 0} size="small" />
                    },
                    { 
                      title: 'Fechas', 
                      key: 'dates',
                      render: (record: any) => (
                        <Text type="secondary">
                          {record.start_date ? dayjs(record.start_date).format('DD/MM/YY') : 'N/A'} - {' '}
                          {record.end_date ? dayjs(record.end_date).format('DD/MM/YY') : 'N/A'}
                        </Text>
                      )
                    }
                  ]}
                  rowKey="id"
                  size="small"
                  pagination={{ pageSize: 5 }}
                />
              </div>
            </Card>
          ) : (
            // Nueva Vista Gantt Profesional
            <div>
              {ganttLoading ? (
                <Card>
                  <div style={{ textAlign: 'center', padding: '60px' }}>
                    <Title level={4}>Cargando cronograma...</Title>
                    <div>Preparando vista Gantt del proyecto</div>
                  </div>
                </Card>
              ) : (console.log('Render condition check - ganttData:', !!ganttData, 'ganttLoading:', ganttLoading), ganttData) ? (
                <div>
                  {/* Header con controles principales */}
                  <Card size="small" style={{ marginBottom: '10px' }}>
                    <Row justify="space-between" align="middle">
                      <Col>
                        <Space>
                          <Button 
                            onClick={() => setSelectedProjectId(null)}
                          >
                            ← Volver
                          </Button>
                          <Title level={4} style={{ margin: 0 }}>
                            📊 {ganttData.project?.name || 'Proyecto'}
                          </Title>
                          <Tag color="blue">
                            {ganttData.project?.completion_percentage || 0}% completado
                          </Tag>
                        </Space>
                      </Col>
                      <Col>
                        <Space>
                          <Button 
                            type="primary" 
                            icon={<PlusOutlined />}
                            onClick={() => setMilestoneModalVisible(true)}
                          >
                            Nuevo Hito
                          </Button>
                          <Button
                            icon={<PlusOutlined />}
                            onClick={() => setTaskModalVisible(true)}
                          >
                            Nueva Tarea
                          </Button>
                          <Button 
                            icon={<ImportOutlined />}
                            onClick={() => setMermaidDrawerVisible(true)}
                          >
                            Importar Mermaid
                          </Button>
                          <Button>
                            Exportar
                          </Button>
                        </Space>
                      </Col>
                    </Row>
                  </Card>

                  {/* Vista Gantt Principal Alineada */}
                  <Card>
                    {/* Headers alineados */}
                    <div style={{ display: 'flex', marginBottom: '10px' }}>
                      {/* Header Panel Izquierdo */}
                      <div style={{ 
                        width: '350px', 
                        paddingRight: '10px'
                      }}>
                        <div style={{ 
                          background: '#fafafa', 
                          padding: '8px 12px', 
                          borderRadius: '4px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          borderRight: '2px solid #f0f0f0'
                        }}>
                          <strong>ELEMENTOS DEL PROYECTO</strong>
                          <Text type="secondary">
                            {(ganttData.tasks?.length || 0) + (ganttData.milestones?.length || 0)} items
                          </Text>
                        </div>
                      </div>

                      {/* Header Timeline */}
                      <div style={{ flex: 1, paddingLeft: '10px' }}>
                        <div style={{ 
                          background: '#fafafa', 
                          padding: '8px 12px', 
                          borderRadius: '4px',
                          textAlign: 'center'
                        }}>
                          <strong>CRONOGRAMA TEMPORAL</strong>
                        </div>
                      </div>
                    </div>

                    {/* Grilla de meses alineada con timeline */}
                    <div style={{ display: 'flex' }}>
                      <div style={{ width: '350px', paddingRight: '10px' }}>
                        {/* Espacio vacío para alinear con elementos */}
                      </div>
                      <div style={{ flex: 1, paddingLeft: '10px' }}>
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(6, 1fr)', 
                          gap: '1px',
                          background: '#e0e0e0',
                          padding: '1px',
                          borderRadius: '4px',
                          marginBottom: '10px'
                        }}>
                          {Array.from({ length: 6 }, (_, i) => {
                            const month = dayjs().add(i, 'month');
                            return (
                              <div 
                                key={i}
                                style={{ 
                                  background: '#f5f5f5', 
                                  padding: '6px',
                                  textAlign: 'center',
                                  fontSize: '12px',
                                  fontWeight: 'bold'
                                }}
                              >
                                {month.format('MMM YYYY')}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Marcadores temporales */}
                    <div style={{ display: 'flex' }}>
                      <div style={{ width: '350px', paddingRight: '10px' }}>
                        {/* Espacio para alinear */}
                      </div>
                      <div style={{ flex: 1, paddingLeft: '10px' }}>
                        <div style={{ 
                          height: '30px',
                          display: 'flex',
                          borderBottom: '1px solid #e0e0e0',
                          marginBottom: '5px'
                        }}>
                          {Array.from({ length: 180 }, (_, i) => {
                            const date = dayjs().add(i, 'day');
                            const isMonthStart = date.date() === 1;
                            const isWeekStart = date.day() === 1;
                            
                            return (
                              <div 
                                key={i}
                                style={{ 
                                  width: '30px',
                                  borderRight: isMonthStart ? '2px solid #1890ff' : isWeekStart ? '1px solid #d9d9d9' : 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '10px',
                                  color: isMonthStart ? '#1890ff' : '#999',
                                  fontWeight: isMonthStart ? 'bold' : 'normal'
                                }}
                              >
                                {isMonthStart ? date.format('MMM') : isWeekStart ? date.format('D') : ''}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Contenido principal alineado */}
                    <div style={{ 
                      display: 'flex', 
                      height: '500px',
                      border: '1px solid #e0e0e0',
                      borderRadius: '4px'
                    }}>
                      {/* Panel izquierdo con elementos */}
                      <div style={{ 
                        width: '350px', 
                        borderRight: '2px solid #f0f0f0',
                        paddingRight: '10px',
                        overflowY: 'auto'
                      }}>
                        {[
                          ...(ganttData.milestones || []).map(milestone => ({ 
                            ...milestone, 
                            type: 'milestone',
                            sortDate: milestone.planned_date
                          })),
                          ...(ganttData.tasks || []).map(task => ({ 
                            ...task, 
                            type: 'task',
                            sortDate: task.start_date || task.created_at
                          }))
                        ]
                        .sort((a, b) => new Date(a.sortDate || '2099-12-31').getTime() - new Date(b.sortDate || '2099-12-31').getTime())
                        .map((item: any, index: number) => {
                          const responsibilityInfo = getResponsibilityIndicator(item.responsibility || 'internal');
                          
                          return (
                          <div
                            key={`element-${item.type}-${item.id}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '8px',
                              height: '45px', // Altura fija para alineación
                              background: item.type === 'milestone' ? responsibilityInfo.bg : '#f9f9f9',
                              borderRadius: '4px',
                              borderLeft: item.type === 'milestone' ? `4px solid ${responsibilityInfo.color}` : '4px solid #1890ff',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              marginBottom: '2px'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = item.type === 'milestone' ? 
                                (item.responsibility === 'external' ? '#ffccc7' : 
                                 item.responsibility === 'client' ? '#ffeaa7' : 
                                 item.responsibility === 'shared' ? '#efdbff' : '#bae7ff') : '#e6f7ff';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = item.type === 'milestone' ? responsibilityInfo.bg : '#f9f9f9';
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center',
                                marginBottom: '2px'
                              }}>
                                <span style={{ marginRight: '6px' }}>
                                  {item.type === 'milestone' ? responsibilityInfo.icon : '📋'}
                                </span>
                                <strong style={{ 
                                  fontSize: '12px',
                                  color: item.type === 'milestone' ? responsibilityInfo.color : '#1890ff'
                                }}>
                                  {item.name || item.title}
                                </strong>
                                {item.type === 'milestone' && item.responsibility !== 'internal' && (
                                  <Tag 
                                    size="small" 
                                    color={
                                      item.responsibility === 'external' ? 'red' : 
                                      item.responsibility === 'client' ? 'orange' : 'purple'
                                    }
                                    style={{ marginLeft: '8px', fontSize: '10px' }}
                                  >
                                    {responsibilityInfo.label}
                                  </Tag>
                                )}
                              </div>
                              <div style={{ fontSize: '10px', color: '#666' }}>
                                {item.type === 'milestone' 
                                  ? item.actual_date
                                    ? `📅 ${dayjs(item.planned_date).format('DD/MM')} → ${dayjs(item.actual_date).format('DD/MM')}`
                                    : `📅 ${dayjs(item.planned_date).format('DD/MM/YY')}`
                                  : item.start_date && item.due_date
                                    ? `📅 ${dayjs(item.start_date).format('DD/MM')} → ${dayjs(item.due_date).format('DD/MM')}`
                                    : '📅 Sin fechas'
                                }
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Tag 
                                size="small"
                                color={
                                  item.type === 'milestone' 
                                    ? (item.status === 'completed' ? 'green' : 'orange')
                                    : (item.status === 'done' ? 'green' : item.status === 'in_progress' ? 'blue' : 'default')
                                }
                              >
                                {item.status === 'completed' || item.status === 'done' ? '✓' : 
                                 item.status === 'in_progress' ? '⏳' : '◯'}
                              </Tag>
                              <Space size={2}>
                                <Button 
                                  type="text" 
                                  size="small" 
                                  icon={<EditOutlined />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditItem(item);
                                  }}
                                  style={{ 
                                    padding: '2px 4px',
                                    height: '20px',
                                    width: '20px',
                                    fontSize: '10px'
                                  }}
                                />
                                <Button 
                                  type="text" 
                                  size="small" 
                                  icon={<DeleteOutlined />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteItem(item);
                                  }}
                                  style={{ 
                                    padding: '2px 4px',
                                    height: '20px',
                                    width: '20px',
                                    fontSize: '10px',
                                    color: '#ff4d4f'
                                  }}
                                />
                              </Space>
                            </div>
                          </div>
                        );
                        })}
                      </div>

                      {/* Panel derecho con timeline alineado */}
                      <div style={{ 
                        flex: 1, 
                        paddingLeft: '10px',
                        position: 'relative',
                        overflowY: 'auto'
                      }}>
                        {/* Grilla de fondo */}
                        <div style={{ 
                          position: 'absolute',
                          top: 0,
                          left: 10,
                          right: 0,
                          height: '100%',
                          background: 'repeating-linear-gradient(to right, transparent, transparent 30px, #f0f0f0 30px, #f0f0f0 31px)',
                          pointerEvents: 'none'
                        }} />

                        {/* Elementos del timeline alineados */}
                        {[
                          ...(ganttData.milestones || []).map(milestone => ({ 
                            ...milestone, 
                            type: 'milestone',
                            sortDate: milestone.planned_date
                          })),
                          ...(ganttData.tasks || []).map(task => ({ 
                            ...task, 
                            type: 'task',
                            sortDate: task.start_date || task.created_at
                          }))
                        ]
                        .sort((a, b) => new Date(a.sortDate || '2099-12-31').getTime() - new Date(b.sortDate || '2099-12-31').getTime())
                        .map((item: any, index: number) => {
                          const startDate = item.type === 'milestone' 
                            ? dayjs(item.planned_date)
                            : dayjs(item.start_date || item.created_at);
                          const endDate = item.type === 'milestone' 
                            ? (item.actual_date ? dayjs(item.actual_date) : startDate)
                            : dayjs(item.due_date || startDate.add(7, 'day'));
                          
                          const daysSinceToday = startDate.diff(dayjs(), 'day');
                          const durationDays = item.type === 'milestone' 
                            ? (item.actual_date ? Math.max(1, endDate.diff(startDate, 'day')) : 0)
                            : Math.max(1, endDate.diff(startDate, 'day'));
                          
                          const leftPosition = Math.max(0, daysSinceToday * 30);
                          const width = item.type === 'milestone' 
                            ? (item.actual_date ? Math.max(30, durationDays * 30) : 20)
                            : Math.max(30, durationDays * 30);
                          
                          // Solo mostrar elementos dentro del rango visible
                          if (daysSinceToday > 180 || daysSinceToday < -30) return null;
                          
                          return (
                            <div
                              key={`timeline-${item.type}-${item.id}`}
                              style={{
                                position: 'relative',
                                height: '47px', // Misma altura que elementos izquierda (45px + 2px margin)
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                              onClick={() => handleEditItem(item)}
                            >
                              {item.type === 'milestone' ? (
                                item.actual_date ? (
                                  // Hito con duración
                                  <>
                                    <div
                                      style={{
                                        position: 'absolute',
                                        left: `${leftPosition}px`,
                                        top: '15px',
                                        width: `${width}px`,
                                        height: '16px',
                                        background: item.status === 'completed' 
                                          ? 'linear-gradient(90deg, #faad14, #52c41a)' 
                                          : 'linear-gradient(90deg, #faad14, #ffd666)',
                                        borderRadius: '8px',
                                        border: '1px solid rgba(255,255,255,0.8)',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '0 4px',
                                        fontSize: '10px',
                                        color: 'white',
                                        fontWeight: 'bold'
                                      }}
                                      title={`${item.name} - ${startDate.format('DD/MM')} → ${endDate.format('DD/MM')} (${durationDays} días)`}
                                    >
                                      {width > 60 ? `🎯 ${item.name.substring(0, 6)}...` : '🎯'}
                                    </div>
                                    <div
                                      style={{
                                        position: 'absolute',
                                        left: `${leftPosition + width - 10}px`,
                                        top: '11px',
                                        width: '12px',
                                        height: '12px',
                                        background: item.status === 'completed' ? '#52c41a' : '#faad14',
                                        transform: 'rotate(45deg)',
                                        border: '1px solid white',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                                        zIndex: 6
                                      }}
                                    />
                                  </>
                                ) : (
                                  // Hito puntual
                                  <div
                                    style={{
                                      position: 'absolute',
                                      left: `${leftPosition}px`,
                                      top: '13px',
                                      width: '20px',
                                      height: '20px',
                                      background: item.status === 'completed' ? '#52c41a' : '#faad14',
                                      transform: 'rotate(45deg)',
                                      border: '2px solid white',
                                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                      zIndex: 5
                                    }}
                                    title={`${item.name} - ${startDate.format('DD/MM/YYYY')}`}
                                  />
                                )
                              ) : (
                                // Tarea como barra
                                <div
                                  style={{
                                    position: 'absolute',
                                    left: `${leftPosition}px`,
                                    top: '15px',
                                    width: `${width}px`,
                                    height: '16px',
                                    background: item.status === 'done' 
                                      ? 'linear-gradient(90deg, #52c41a, #73d13d)' 
                                      : item.status === 'in_progress' 
                                        ? 'linear-gradient(90deg, #1890ff, #40a9ff)'
                                        : 'linear-gradient(90deg, #d9d9d9, #f0f0f0)',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(255,255,255,0.8)',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '0 4px',
                                    fontSize: '10px',
                                    color: item.status === 'pending' ? '#666' : 'white',
                                    fontWeight: 'bold'
                                  }}
                                  title={`${item.title} - ${startDate.format('DD/MM')} → ${endDate.format('DD/MM')}`}
                                >
                                  {width > 60 ? (item.title?.substring(0, 8) + '...') : ''}
                                </div>
                              )}
                              
                              {/* Línea de hoy solo en el primer elemento */}
                              {index === 0 && (
                                <div
                                  style={{
                                    position: 'absolute',
                                    left: '0px',
                                    top: 0,
                                    bottom: 0,
                                    width: '2px',
                                    background: '#ff4d4f',
                                    zIndex: 10
                                  }}
                                  title="Hoy"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </Card>
                </div>
              ) : (
                <Card>
                  <div style={{ textAlign: 'center', padding: '60px' }}>
                    <Text type="secondary">No se encontraron datos del proyecto seleccionado</Text>
                  </div>
                </Card>
              )}
            </div>
          )}
        </TabPane>

        <TabPane tab="🔗 Dependencias Externas" key="dependencies">
          <Card>
            <Title level={3} style={{ marginBottom: '20px' }}>
              📊 Dashboard de Dependencias Externas
            </Title>
            
            {/* Métricas de dependencias */}
            <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
              <Col xs={24} sm={8}>
                <Card size="small" style={{ background: '#fff1f0', borderColor: '#ffccc7' }}>
                  <Statistic
                    title="Dependencias Externas"
                    value={
                      dashboardData?.projects?.reduce((total: number, project: any) => {
                        return total + (ganttData?.milestones?.filter((m: any) => 
                          m.responsibility === 'external' || m.responsibility === 'client'
                        ).length || 0);
                      }, 0) || 0
                    }
                    prefix="🏪"
                    valueStyle={{ color: '#f5222d' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card size="small" style={{ background: '#fff7e6', borderColor: '#ffd591' }}>
                  <Statistic
                    title="Retrasos por Cliente"
                    value={
                      ganttData?.milestones?.filter((m: any) => 
                        m.responsibility === 'client' && m.estimated_delay_days > 0
                      ).length || 0
                    }
                    prefix="⏰"
                    valueStyle={{ color: '#faad14' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card size="small" style={{ background: '#f6ffed', borderColor: '#b7eb8f' }}>
                  <Statistic
                    title="Impacto Financiero"
                    value={Math.round(
                      (ganttData?.milestones?.reduce((total: number, m: any) => 
                        total + (parseFloat(m.financial_impact) || 0), 0
                      ) || 0) / 1000000
                    )}
                    suffix="M CLP"
                    prefix="💰"
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
            </Row>

            {/* Lista de dependencias críticas */}
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Card 
                  title="🚨 Dependencias Críticas por Cliente/Terceros" 
                  size="small"
                  style={{ marginBottom: '16px' }}
                >
                  {ganttData?.milestones?.filter((m: any) => 
                    m.responsibility !== 'internal'
                  ).length > 0 ? (
                    <div>
                      {ganttData.milestones
                        .filter((m: any) => m.responsibility !== 'internal')
                        .map((milestone: any) => {
                          const responsibilityInfo = getResponsibilityIndicator(milestone.responsibility);
                          const isDelayed = milestone.estimated_delay_days > 0;
                          
                          return (
                            <Card 
                              key={milestone.id}
                              size="small" 
                              style={{ 
                                marginBottom: '12px',
                                border: isDelayed ? '2px solid #ff4d4f' : '1px solid #d9d9d9',
                                background: isDelayed ? '#fff1f0' : responsibilityInfo.bg
                              }}
                            >
                              <Row justify="space-between" align="middle">
                                <Col span={12}>
                                  <Space>
                                    <span style={{ fontSize: '16px' }}>{responsibilityInfo.icon}</span>
                                    <div>
                                      <strong>{milestone.name}</strong>
                                      <div style={{ fontSize: '12px', color: '#666' }}>
                                        📅 {dayjs(milestone.planned_date).format('DD/MM/YYYY')}
                                      </div>
                                    </div>
                                  </Space>
                                </Col>
                                <Col span={6}>
                                  <Tag color={responsibilityInfo.color.replace('#', '')}>
                                    {responsibilityInfo.label}
                                  </Tag>
                                  {isDelayed && (
                                    <Tag color="red" style={{ marginTop: '4px' }}>
                                      +{milestone.estimated_delay_days} días
                                    </Tag>
                                  )}
                                </Col>
                                <Col span={6}>
                                  {milestone.financial_impact > 0 && (
                                    <div style={{ textAlign: 'right' }}>
                                      <strong style={{ color: '#f5222d' }}>
                                        ${(milestone.financial_impact / 1000000).toFixed(1)}M
                                      </strong>
                                      <div style={{ fontSize: '10px', color: '#666' }}>
                                        Impacto CLP
                                      </div>
                                    </div>
                                  )}
                                  {milestone.external_contact && (
                                    <div style={{ fontSize: '10px', color: '#666' }}>
                                      👤 {milestone.external_contact}
                                    </div>
                                  )}
                                </Col>
                              </Row>
                              
                              {milestone.blocking_reason && (
                                <div style={{ marginTop: '8px', padding: '8px', background: '#fafafa', borderRadius: '4px' }}>
                                  <strong style={{ fontSize: '11px' }}>Razón del bloqueo:</strong>
                                  <div style={{ fontSize: '11px', marginTop: '2px' }}>
                                    {milestone.blocking_reason}
                                  </div>
                                </div>
                              )}
                              
                              {milestone.delay_justification && (
                                <div style={{ marginTop: '4px', padding: '8px', background: '#fff7e6', borderRadius: '4px' }}>
                                  <strong style={{ fontSize: '11px' }}>Justificación:</strong>
                                  <div style={{ fontSize: '11px', marginTop: '2px' }}>
                                    {milestone.delay_justification}
                                  </div>
                                </div>
                              )}
                            </Card>
                          );
                        })}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                      <CheckCircleOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
                      <div>¡Excelente! No hay dependencias externas críticas</div>
                      <div style={{ fontSize: '12px', marginTop: '8px' }}>
                        Todos los hitos están bajo control interno
                      </div>
                    </div>
                  )}
                </Card>
              </Col>
            </Row>
          </Card>
        </TabPane>
      </Tabs>

      {/* Modal editar elemento */}
      <Modal
        title={`Editar ${editingItem?.type === 'milestone' ? 'Hito' : 'Tarea'}`}
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingItem(null);
          editForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleSaveEdit}
        >
          {editingItem?.type === 'milestone' ? (
            // Formulario para hitos
            <>
              <Form.Item name="name" label="Nombre del Hito" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="description" label="Descripción">
                <Input.TextArea />
              </Form.Item>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="planned_date" label="Fecha Planificada" rules={[{ required: true }]}>
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="actual_date" label="Fecha de Finalización">
                    <DatePicker style={{ width: '100%' }} placeholder="Fecha real de finalización" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="status" label="Estado">
                <Select>
                  <Select.Option value="pending">Pendiente</Select.Option>
                  <Select.Option value="in_progress">En Progreso</Select.Option>
                  <Select.Option value="completed">Completado</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item name="responsible_user_id" label="Responsable">
                <Select placeholder="Seleccionar responsable">
                  {users.map((user: any) => (
                    <Select.Option key={user.id} value={user.id}>
                      {user.full_name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item name="responsibility" label="Tipo de Responsabilidad">
                <Select>
                  <Select.Option value="internal">
                    <span style={{ color: '#1890ff' }}>🏢 Interno</span> - Tu equipo
                  </Select.Option>
                  <Select.Option value="client">
                    <span style={{ color: '#faad14' }}>👤 Cliente</span> - Responsabilidad del cliente
                  </Select.Option>
                  <Select.Option value="external">
                    <span style={{ color: '#f5222d' }}>🏪 Externo</span> - Proveedores/Terceros
                  </Select.Option>
                  <Select.Option value="shared">
                    <span style={{ color: '#722ed1' }}>🤝 Compartido</span> - Colaboración requerida
                  </Select.Option>
                </Select>
              </Form.Item>

              <Form.Item 
                shouldUpdate={(prevValues, currentValues) => prevValues.responsibility !== currentValues.responsibility}
                style={{ marginBottom: 0 }}
              >
                {({ getFieldValue }) => {
                  const responsibility = getFieldValue('responsibility');
                  return responsibility !== 'internal' ? (
                    <div>
                      <Form.Item name="external_contact" label="Contacto Externo">
                        <Input placeholder="Nombre y contacto del responsable externo" />
                      </Form.Item>

                      <Form.Item name="blocking_reason" label="Razón de Bloqueo/Dependencia">
                        <Input.TextArea 
                          placeholder="Describe por qué este hito depende de factores externos"
                          rows={2}
                        />
                      </Form.Item>

                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item name="estimated_delay_days" label="Días de Retraso Estimados">
                            <Input type="number" min={0} placeholder="0" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="financial_impact" label="Impacto Financiero (CLP)">
                            <Input type="number" min={0} step="1000" placeholder="0" />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Form.Item name="delay_justification" label="Justificación/Evidencias">
                        <Input.TextArea 
                          placeholder="Documentación o evidencias del retraso/dependencia"
                          rows={2}
                        />
                      </Form.Item>
                    </div>
                  ) : null;
                }}
              </Form.Item>
            </>
          ) : (
            // Formulario para tareas
            <>
              <Form.Item name="title" label="Título de la Tarea" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="description" label="Descripción">
                <Input.TextArea />
              </Form.Item>
              <Form.Item name="start_date" label="Fecha de Inicio">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="due_date" label="Fecha de Vencimiento">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="status" label="Estado">
                <Select>
                  <Select.Option value="todo">Por Hacer</Select.Option>
                  <Select.Option value="in_progress">En Progreso</Select.Option>
                  <Select.Option value="review">En Revisión</Select.Option>
                  <Select.Option value="testing">Pruebas</Select.Option>
                  <Select.Option value="done">Completado</Select.Option>
                  <Select.Option value="blocked">Bloqueado</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item name="assignee_id" label="Asignado a">
                <Select placeholder="Seleccionar usuario">
                  {users.map((user: any) => (
                    <Select.Option key={user.id} value={user.id}>
                      {user.full_name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item name="estimated_hours" label="Horas Estimadas">
                <Input type="number" min={0} step={0.5} />
              </Form.Item>
            </>
          )}
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Guardar Cambios
              </Button>
              <Button onClick={() => {
                setEditModalVisible(false);
                setEditingItem(null);
                editForm.resetFields();
              }}>
                Cancelar
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal crear hito */}
      <Modal
        title="Crear Nuevo Hito"
        open={milestoneModalVisible}
        onCancel={() => setMilestoneModalVisible(false)}
        footer={null}
      >
        <Form
          form={milestoneForm}
          layout="vertical"
          onFinish={handleCreateMilestone}
        >
          <Form.Item
            name="project_id"
            label="Proyecto"
            rules={[{ required: true, message: 'Selecciona un proyecto' }]}
          >
            <Select placeholder="Seleccionar proyecto">
              {projects.map((project: any) => (
                <Select.Option key={project.id} value={project.id}>
                  {project.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="name"
            label="Nombre del Hito"
            rules={[{ required: true, message: 'Ingresa el nombre del hito' }]}
          >
            <Input placeholder="Ej: Demo al cliente" />
          </Form.Item>

          <Form.Item name="description" label="Descripción">
            <Input.TextArea placeholder="Descripción detallada del hito" />
          </Form.Item>

          <Form.Item name="milestone_type" label="Tipo" initialValue="delivery">
            <Select>
              <Select.Option value="delivery">Entrega</Select.Option>
              <Select.Option value="demo">Demo</Select.Option>
              <Select.Option value="review">Revisión</Select.Option>
              <Select.Option value="go_live">Go Live</Select.Option>
              <Select.Option value="checkpoint">Checkpoint</Select.Option>
              <Select.Option value="deadline">Deadline</Select.Option>
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="planned_date"
                label="Fecha Planificada"
                rules={[{ required: true, message: 'Selecciona una fecha' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="actual_date" label="Fecha de Finalización">
                <DatePicker style={{ width: '100%' }} placeholder="Opcional - fecha real" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="priority" label="Prioridad" initialValue="medium">
            <Select>
              <Select.Option value="critical">Crítica</Select.Option>
              <Select.Option value="high">Alta</Select.Option>
              <Select.Option value="medium">Media</Select.Option>
              <Select.Option value="low">Baja</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="responsible_user_id" label="Responsable">
            <Select placeholder="Seleccionar responsable">
              {users.map((user: any) => (
                <Select.Option key={user.id} value={user.id}>
                  {user.full_name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="responsibility" label="Tipo de Responsabilidad" initialValue="internal">
            <Select>
              <Select.Option value="internal">
                <span style={{ color: '#1890ff' }}>🏢 Interno</span> - Tu equipo
              </Select.Option>
              <Select.Option value="client">
                <span style={{ color: '#faad14' }}>👤 Cliente</span> - Responsabilidad del cliente
              </Select.Option>
              <Select.Option value="external">
                <span style={{ color: '#f5222d' }}>🏪 Externo</span> - Proveedores/Terceros
              </Select.Option>
              <Select.Option value="shared">
                <span style={{ color: '#722ed1' }}>🤝 Compartido</span> - Colaboración requerida
              </Select.Option>
            </Select>
          </Form.Item>

          <Form.Item 
            shouldUpdate={(prevValues, currentValues) => prevValues.responsibility !== currentValues.responsibility}
            style={{ marginBottom: 0 }}
          >
            {({ getFieldValue }) => {
              const responsibility = getFieldValue('responsibility');
              return responsibility !== 'internal' ? (
                <div>
                  <Form.Item name="external_contact" label="Contacto Externo">
                    <Input placeholder="Nombre y contacto del responsable externo" />
                  </Form.Item>

                  <Form.Item name="blocking_reason" label="Razón de Bloqueo/Dependencia">
                    <Input.TextArea 
                      placeholder="Describe por qué este hito depende de factores externos"
                      rows={2}
                    />
                  </Form.Item>

                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="estimated_delay_days" label="Días de Retraso Estimados">
                        <Input type="number" min={0} placeholder="0" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="financial_impact" label="Impacto Financiero (CLP)">
                        <Input type="number" min={0} step="1000" placeholder="0" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item name="delay_justification" label="Justificación/Evidencias">
                    <Input.TextArea 
                      placeholder="Documentación o evidencias del retraso/dependencia"
                      rows={2}
                    />
                  </Form.Item>
                </div>
              ) : null;
            }}
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Crear Hito
              </Button>
              <Button onClick={() => setMilestoneModalVisible(false)}>
                Cancelar
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal crear tarea */}
      <Modal
        title="Crear Nueva Tarea"
        open={taskModalVisible}
        onCancel={() => setTaskModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={taskForm}
          layout="vertical"
          onFinish={handleCreateTask}
        >
          <Form.Item
            name="title"
            label="Título de la Tarea"
            rules={[{ required: true, message: 'Ingresa el título de la tarea' }]}
          >
            <Input placeholder="Ej: Configurar base de datos" />
          </Form.Item>

          <Form.Item name="description" label="Descripción">
            <Input.TextArea placeholder="Descripción detallada de la tarea" rows={3} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="start_date" label="Fecha de Inicio">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="due_date" label="Fecha de Vencimiento">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="status" label="Estado" initialValue="todo">
                <Select>
                  <Select.Option value="todo">Por Hacer</Select.Option>
                  <Select.Option value="in_progress">En Progreso</Select.Option>
                  <Select.Option value="review">En Revisión</Select.Option>
                  <Select.Option value="testing">Pruebas</Select.Option>
                  <Select.Option value="done">Completado</Select.Option>
                  <Select.Option value="blocked">Bloqueado</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="priority" label="Prioridad" initialValue="medium">
                <Select>
                  <Select.Option value="critical">Crítica</Select.Option>
                  <Select.Option value="high">Alta</Select.Option>
                  <Select.Option value="medium">Media</Select.Option>
                  <Select.Option value="low">Baja</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="assignee_id" label="Asignado a">
                <Select placeholder="Seleccionar usuario">
                  {users.map((user: any) => (
                    <Select.Option key={user.id} value={user.id}>
                      {user.full_name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="estimated_hours" label="Horas Estimadas">
                <Input type="number" min={0} step={0.5} placeholder="Ej: 8" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Crear Tarea
              </Button>
              <Button onClick={() => setTaskModalVisible(false)}>
                Cancelar
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Mermaid Import Drawer */}
      <Drawer
        title="Importar Diagrama Mermaid"
        placement="right"
        width={600}
        onClose={() => setMermaidDrawerVisible(false)}
        open={mermaidDrawerVisible}
        extra={
          <Space>
            <Button onClick={() => setMermaidDrawerVisible(false)}>
              Cancelar
            </Button>
            <Button 
              type="primary" 
              onClick={handleMermaidImport}
            >
              Importar
            </Button>
          </Space>
        }
      >
        <div style={{ marginBottom: '16px' }}>
          <Alert
            message="Importar Diagrama Mermaid"
            description="Pega tu código Mermaid aquí o sube un archivo .mmd para convertirlo automáticamente en tareas y milestones del proyecto."
            type="info"
            showIcon
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <Typography.Title level={5}>
            <FileTextOutlined /> Subir archivo Mermaid
          </Typography.Title>
          <Upload.Dragger
            accept=".mmd,.txt"
            beforeUpload={(file) => {
              const reader = new FileReader();
              reader.onload = (e) => {
                const content = e.target?.result as string;
                setMermaidCode(content);
              };
              reader.readAsText(file);
              return false;
            }}
            showUploadList={false}
          >
            <p className="ant-upload-drag-icon">
              <ImportOutlined />
            </p>
            <p className="ant-upload-text">Haz clic o arrastra archivos .mmd aquí</p>
            <p className="ant-upload-hint">
              Soporta archivos .mmd y .txt con código Mermaid
            </p>
          </Upload.Dragger>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <Typography.Title level={5}>
            <CodeOutlined /> O pega tu código Mermaid
          </Typography.Title>
          <Input.TextArea
            placeholder="gantt
    title Proyecto Ejemplo
    dateFormat  YYYY-MM-DD
    axisFormat  %d/%m

    section Fase 1
    Análisis          :done, des1, 2024-01-01, 2024-01-15
    Diseño           :active, des2, 2024-01-16, 30d
    
    section Fase 2
    Desarrollo       :dev1, after des2, 45d
    Pruebas         :test1, after dev1, 15d"
            rows={12}
            value={mermaidCode}
            onChange={(e) => setMermaidCode(e.target.value)}
            style={{ fontFamily: 'monospace' }}
          />
        </div>

        <div>
          <Typography.Title level={5}>Ejemplo de formato Mermaid:</Typography.Title>
          <Card size="small" style={{ background: '#f8f9fa' }}>
            <pre style={{ margin: 0, fontSize: '12px' }}>
{`gantt
    title Mi Proyecto
    dateFormat YYYY-MM-DD
    axisFormat %d/%m

    section Análisis
    Requisitos       :done, req1, 2024-01-01, 2024-01-10
    Documentación    :active, doc1, 2024-01-11, 15d
    
    section Desarrollo  
    Backend         :dev1, after doc1, 30d
    Frontend        :dev2, after dev1, 25d
    
    section Testing
    Pruebas         :test1, after dev2, 10d
    Deploy          :deploy1, after test1, 3d`}
            </pre>
          </Card>
        </div>
      </Drawer>
    </div>
  );
};

export default PMODashboard;