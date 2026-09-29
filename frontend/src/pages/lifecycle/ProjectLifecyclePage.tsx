import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Button,
  Table,
  Tag,
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Select,
  message,
  Space,
  Typography,
  Statistic,
  Progress,
  Alert,
  Tooltip,
} from 'antd';
import {
  PlayCircleOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  WarningOutlined,
  RiseOutlined,
  FallOutlined,
  ProjectOutlined
} from '@ant-design/icons';
import { apiService } from '@/services/api';
import { EmptyState, LoadingState } from '@/components/common';
import { useAuthStore } from '@/store/authStore';
import dayjs from 'dayjs';
import { displayLabel } from '@/utils/displayLabels';
import type { PhaseStatus, Responsibility, ProjectPhase, ROIAnalysis } from '@/types/lifecycle';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface ProjectLifecyclePageProps {
  projectId?: number;
}

export const ProjectLifecyclePage: React.FC<ProjectLifecyclePageProps> = ({ projectId: projectIdProp }) => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const resolvedProjectId = projectIdProp ?? (projectId ? parseInt(projectId, 10) : undefined);
  const [loading, setLoading] = useState(true);
  const [phases, setPhases] = useState<ProjectPhase[]>([]);
  const [roiAnalysis, setRoiAnalysis] = useState<ROIAnalysis | null>(null);
  const [activityModalVisible, setActivityModalVisible] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<ProjectPhase | null>(null);
  const [activityForm] = Form.useForm();

  const loadLifecycleData = useCallback(async () => {
    try {
      setLoading(true);
      const phasesData = await apiService.getProjectPhases(resolvedProjectId!);
      setPhases(phasesData);

      // El endpoint de ROI es solo team_lead (403 para el resto).
      if (phasesData.length > 0 && user?.role === 'team_lead') {
        const roiData = await apiService.getProjectROIAnalysis(resolvedProjectId!);
        setRoiAnalysis(roiData);
      }
    } catch (error: any) {
      console.error('Error loading lifecycle data:', error);
      if (error?.message?.includes('No phases found') || error?.message?.includes('No hay fases registradas')) {
        // Phases not initialized yet - this is OK
        setPhases([]);
      } else {
        message.error("No se pudo cargar el ciclo de vida");
      }
    } finally {
      setLoading(false);
    }
  }, [resolvedProjectId, user?.role]);

  useEffect(() => {
    if (resolvedProjectId) void loadLifecycleData();
  }, [resolvedProjectId, loadLifecycleData]);

  const handleInitializePhases = async () => {
    try {
      await apiService.initializeProjectPhases(resolvedProjectId!);
      message.success("Fases del proyecto inicializadas");
      loadLifecycleData();
    } catch (error) {
      console.error('Error initializing phases:', error);
      message.error("No se pudieron inicializar las fases");
    }
  };


  const handleStartPhase = async (phase: ProjectPhase) => {
    try {
      await apiService.updateProjectPhase(phase.id, {
        status: 'in_progress',
        actual_start_date: dayjs().format('YYYY-MM-DD')
      });
      message.success(`Fase iniciada: ${phase.name}`);
      loadLifecycleData();
    } catch (error) {
      message.error("No se pudo iniciar la fase");
    }
  };

  const handleCompletePhase = async (phase: ProjectPhase) => {
    try {
      await apiService.updateProjectPhase(phase.id, {
        status: 'completed',
        actual_end_date: dayjs().format('YYYY-MM-DD')
      });
      message.success(`Fase completada: ${phase.name}`);
      loadLifecycleData();
    } catch (error) {
      message.error("No se pudo completar la fase");
    }
  };

  const handleAddActivity = (phase: ProjectPhase) => {
    setSelectedPhase(phase);
    setActivityModalVisible(true);
    activityForm.resetFields();
  };

  const handleActivitySubmit = async (values: any) => {
    try {
      await apiService.createPhaseActivity(selectedPhase!.id, {
        activity_type: 'development',
        description: values.activity_description,
        duration_minutes: values.hours_worked * 60,
        is_productive: values.is_productive,
        is_billable: selectedPhase!.is_billable,
        is_internal: true,
        responsibility: 'internal',
        notes: values.notes,
        start_datetime: values.work_date.format('YYYY-MM-DD HH:mm:ss')
      });
      message.success("Actividad registrada");
      setActivityModalVisible(false);
      loadLifecycleData();
    } catch (error) {
      message.error("No se pudo registrar la actividad");
    }
  };

  const getPhaseStatusColor = (status: PhaseStatus) => {
    const colors: Record<PhaseStatus, string> = {
      pending: 'default',
      in_progress: 'processing',
      completed: 'success',
      blocked: 'error',
      skipped: 'default'
    };
    return colors[status];
  };

  const getPhaseStatusIcon = (status: PhaseStatus) => {
    const icons: Record<PhaseStatus, React.ReactNode> = {
      pending: <ClockCircleOutlined />,
      in_progress: <PlayCircleOutlined spin />,
      completed: <CheckCircleOutlined />,
      blocked: <ExclamationCircleOutlined />,
      skipped: <WarningOutlined />
    };
    return icons[status];
  };

  const phaseColumns = [
    {
      title: "Fase",
      dataIndex: 'name',
      key: 'name',
      width: '25%',
      render: (text: string, record: ProjectPhase) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text}</Text>
          {!record.is_billable && <Tag color="orange">No facturable</Tag>}
        </Space>
      )
    },
    {
      title: "Estado",
      dataIndex: 'status',
      key: 'status',
      width: '12%',
      render: (status: PhaseStatus) => (
        <Tag icon={getPhaseStatusIcon(status)} color={getPhaseStatusColor(status)}>
          {displayLabel(status)}
        </Tag>
      )
    },
    {
      title: "Duración",
      key: 'duration',
      width: '15%',
      render: (_: any, record: ProjectPhase) => (
        <Space direction="vertical" size={0}>
          {record.actual_start_date && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Inicio: {dayjs(record.actual_start_date).format('MMM DD, YYYY')}
            </Text>
          )}
          {record.actual_end_date && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Término: {dayjs(record.actual_end_date).format('MMM DD, YYYY')}
            </Text>
          )}
          {!record.actual_start_date && !record.actual_end_date && (
            <Text type="secondary">Sin iniciar</Text>
          )}
        </Space>
      )
    },
    {
      title: "Horas",
      key: 'hours',
      width: '12%',
      render: (_: any, record: ProjectPhase) => (
        <Space direction="vertical" size={0}>
          <Text>{record.actual_hours.toFixed(1)}h</Text>
          {record.estimated_hours && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Estimadas: {record.estimated_hours}h
            </Text>
          )}
        </Space>
      )
    },
    {
      title: "Responsabilidad",
      dataIndex: 'responsibility',
      key: 'responsibility',
      width: '12%',
      render: (resp: Responsibility) => (
        <Tag color={resp === 'internal' ? 'blue' : resp === 'client' ? 'purple' : 'orange'}>
          {displayLabel(resp)}
        </Tag>
      )
    },
    {
      title: "Acciones",
      key: 'actions',
      width: '24%',
      render: (_: any, record: ProjectPhase) => (
        <Space size="small" wrap>
          {record.status === 'pending' && (
            <Button
              size="small"
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={() => handleStartPhase(record)}
            >
              Iniciar
            </Button>
          )}
          {record.status === 'in_progress' && (
            <>
              <Button
                size="small"
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => handleCompletePhase(record)}
              >
                Completar
              </Button>
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={() => handleAddActivity(record)}
              >
                
                Registrar horas
              </Button>
            </>
          )}
          {record.status === 'completed' && (
            <Button
              size="small"
              icon={<PlusOutlined />}
              onClick={() => handleAddActivity(record)}
            >
              Agregar horas
            </Button>
          )}
          <Tooltip title={`Ver tareas en el tablero Kanban`}>
            <Button
              size="small"
              icon={<ProjectOutlined />}
              onClick={() => navigate(`/tasks?project=${resolvedProjectId}`)}
            >
              Tareas
            </Button>
          </Tooltip>
        </Space>
      )
    }
  ];

  if (loading) {
    return <LoadingState tip="Cargando ciclo de vida…" minHeight={220} />;
  }

  if (phases.length === 0) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <EmptyState
            description={
              <Space direction="vertical" size="large">
                <div>
                  <Title level={4}>Ciclo de vida sin inicializar</Title>
                  <Text type="secondary">
                    Inicializa el ciclo de vida para seguir las fases del proyecto, desde la preventa hasta la implementación.
                  </Text>
                </div>
                <Alert
                  type="info"
                  message="¿Qué ocurre al inicializar?"
                  description="Se crearán 29 fases predefinidas para descubrimiento, propuesta, negociación, desarrollo, pruebas e implementación. Podrás registrar tiempo y comparar el ROI real con el aparente."
                  showIcon
                />
              </Space>
            }
            action={<Button
              type="primary"
              size="large"
              icon={<PlayCircleOutlined />}
              onClick={handleInitializePhases}
            >
              Inicializar ciclo de vida (29 fases)
            </Button>}
          />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <Title level={3}>Ciclo de vida del proyecto</Title>

      {/* ROI Analysis Cards */}
      {roiAnalysis && (
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="ROI aparente"
                value={roiAnalysis.apparent_roi}
                suffix="%"
                prefix={roiAnalysis.apparent_roi > 0 ? <RiseOutlined /> : <FallOutlined />}
                valueStyle={{
                  color: roiAnalysis.apparent_roi > 20 ? 'var(--color-success)' : 'var(--color-error)'
                }}
              />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                
                Solo horas facturables ({roiAnalysis.billable_hours}h)
              </Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="ROI real"
                value={roiAnalysis.real_roi}
                suffix="%"
                prefix={roiAnalysis.real_roi > 0 ? <RiseOutlined /> : <FallOutlined />}
                valueStyle={{
                  color: roiAnalysis.real_roi > 20 ? 'var(--color-success)' : 'var(--color-error)'
                }}
              />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                
                Todas las horas ({roiAnalysis.total_hours_real}h)
              </Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Horas no facturables"
                value={roiAnalysis.non_billable_hours}
                suffix="h"
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: 'var(--color-warning)' }}
              />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {roiAnalysis.non_billable_percentage}% del tiempo total
              </Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Horas totales del proyecto"
                value={roiAnalysis.total_hours_real}
                suffix="h"
                prefix={<ClockCircleOutlined />}
              />
              <Progress
                percent={roiAnalysis.non_billable_percentage}
                showInfo={false}
                strokeColor="var(--color-warning)"
                size="small"
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Phases Table */}
      <Card
        title="Fases del proyecto"
        style={{ marginBottom: '24px' }}
        extra={
          resolvedProjectId && (
            <Button
              icon={<ProjectOutlined />}
              onClick={() => navigate(`/tasks?project=${resolvedProjectId}`)}
            >
              Abrir tablero Kanban del proyecto
            </Button>
          )
        }
      >
        <Table
          dataSource={phases}
          columns={phaseColumns}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Card>

      {/* Activity Logging Modal */}
      <Modal
        title={`Registrar actividad · ${selectedPhase?.name}`}
        open={activityModalVisible}
        onCancel={() => setActivityModalVisible(false)}
        onOk={() => activityForm.submit()}
        okText="Registrar actividad"
        width={600}
      >
        <Form
          form={activityForm}
          layout="vertical"
          onFinish={handleActivitySubmit}
          initialValues={{
            work_date: dayjs(),
            is_productive: true
          }}
        >
          <Form.Item
            label="Descripción de la actividad"
            name="activity_description"
            rules={[{ required: true, message: 'Describe la actividad' }]}
          >
            <TextArea rows={3} aria-label="Descripción del trabajo realizado" placeholder="¿En qué trabajaste?" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Horas trabajadas"
                name="hours_worked"
                rules={[{ required: true, message: 'Ingresa las horas' }]}
              >
                <InputNumber
                  min={0.1}
                  max={24}
                  step={0.5}
                  style={{ width: '100%' }}
                  aria-label="Horas trabajadas"
                  placeholder="Ej.: 2,5"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Fecha de trabajo"
                name="work_date"
                rules={[{ required: true, message: 'Selecciona una fecha' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="¿Fue tiempo productivo?"
            name="is_productive"
            rules={[{ required: true }]}
          >
            <Select>
              <Option value={true}>Sí, trabajo productivo</Option>
              <Option value={false}>No, espera o bloqueo</Option>
            </Select>
          </Form.Item>

          <Form.Item label="Notas adicionales" name="notes">
            <TextArea rows={2} aria-label="Contexto adicional" placeholder="Contexto adicional..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
