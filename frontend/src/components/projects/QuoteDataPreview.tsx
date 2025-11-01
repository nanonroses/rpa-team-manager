import React, { useState, useEffect } from 'react';
import {
  Form,
  Input,
  DatePicker,
  InputNumber,
  Select,
  Button,
  Card,
  Row,
  Col,
  Space,
  Typography,
  Divider,
  Table,
  Alert,
  Popconfirm
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  SaveOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Title, Text } = Typography;

interface Task {
  title: string;
  description?: string;
  estimated_hours?: number;
  priority?: 'low' | 'medium' | 'high';
}

interface Milestone {
  name: string;
  description?: string;
  target_date?: string;
}

interface QuoteData {
  project_name: string;
  description: string;
  client_name: string;
  estimated_start_date?: string;
  estimated_end_date?: string;
  budgeted_cost?: number;
  expected_revenue?: number;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  tasks: Task[];
  milestones: Milestone[];
}

interface QuoteDataPreviewProps {
  quoteData: QuoteData;
  onSubmit: (data: QuoteData) => void;
  onCancel: () => void;
  loading?: boolean;
  error?: string | null;
}

export const QuoteDataPreview: React.FC<QuoteDataPreviewProps> = ({
  quoteData,
  onSubmit,
  onCancel,
  loading = false,
  error = null
}) => {
  const [form] = Form.useForm();
  const [tasks, setTasks] = useState<Task[]>(quoteData.tasks || []);
  const [milestones, setMilestones] = useState<Milestone[]>(quoteData.milestones || []);
  const [editingTaskIndex, setEditingTaskIndex] = useState<number | null>(null);
  const [editingMilestoneIndex, setEditingMilestoneIndex] = useState<number | null>(null);

  useEffect(() => {
    // Initialize form with quote data
    form.setFieldsValue({
      project_name: quoteData.project_name,
      description: quoteData.description,
      client_name: quoteData.client_name,
      estimated_start_date: quoteData.estimated_start_date ? dayjs(quoteData.estimated_start_date) : null,
      estimated_end_date: quoteData.estimated_end_date ? dayjs(quoteData.estimated_end_date) : null,
      budgeted_cost: quoteData.budgeted_cost,
      expected_revenue: quoteData.expected_revenue,
      priority: quoteData.priority || 'medium'
    });
  }, [quoteData, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      const submissionData: QuoteData = {
        project_name: values.project_name,
        description: values.description,
        client_name: values.client_name,
        estimated_start_date: values.estimated_start_date?.format('YYYY-MM-DD'),
        estimated_end_date: values.estimated_end_date?.format('YYYY-MM-DD'),
        budgeted_cost: values.budgeted_cost,
        expected_revenue: values.expected_revenue,
        priority: values.priority,
        tasks: tasks,
        milestones: milestones
      };

      onSubmit(submissionData);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const addTask = () => {
    setTasks([
      ...tasks,
      {
        title: 'Nueva Tarea',
        description: '',
        estimated_hours: 0,
        priority: 'medium'
      }
    ]);
  };

  const updateTask = (index: number, updatedTask: Task) => {
    const newTasks = [...tasks];
    newTasks[index] = updatedTask;
    setTasks(newTasks);
    setEditingTaskIndex(null);
  };

  const deleteTask = (index: number) => {
    setTasks(tasks.filter((_, i) => i !== index));
  };

  const addMilestone = () => {
    setMilestones([
      ...milestones,
      {
        name: 'Nuevo Hito',
        description: '',
        target_date: undefined
      }
    ]);
  };

  const updateMilestone = (index: number, updatedMilestone: Milestone) => {
    const newMilestones = [...milestones];
    newMilestones[index] = updatedMilestone;
    setMilestones(newMilestones);
    setEditingMilestoneIndex(null);
  };

  const deleteMilestone = (index: number) => {
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  const taskColumns = [
    {
      title: 'Título',
      dataIndex: 'title',
      key: 'title',
      width: '30%'
    },
    {
      title: 'Descripción',
      dataIndex: 'description',
      key: 'description',
      width: '35%',
      render: (text: string) => text || '-'
    },
    {
      title: 'Horas Est.',
      dataIndex: 'estimated_hours',
      key: 'estimated_hours',
      width: '15%',
      render: (hours: number) => hours || '-'
    },
    {
      title: 'Prioridad',
      dataIndex: 'priority',
      key: 'priority',
      width: '15%',
      render: (priority: string) => {
        const colors: { [key: string]: string } = {
          low: 'green',
          medium: 'blue',
          high: 'orange'
        };
        return (
          <Text style={{ color: colors[priority] || 'blue' }}>
            {priority === 'low' ? 'Baja' : priority === 'medium' ? 'Media' : 'Alta'}
          </Text>
        );
      }
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: '5%',
      render: (_: any, record: Task, index: number) => (
        <Space size="small">
          <Popconfirm
            title="¿Eliminar esta tarea?"
            onConfirm={() => deleteTask(index)}
            okText="Sí"
            cancelText="No"
          >
            <Button type="text" danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </Space>
      )
    }
  ];

  const milestoneColumns = [
    {
      title: 'Nombre',
      dataIndex: 'name',
      key: 'name',
      width: '30%'
    },
    {
      title: 'Descripción',
      dataIndex: 'description',
      key: 'description',
      width: '45%',
      render: (text: string) => text || '-'
    },
    {
      title: 'Fecha Objetivo',
      dataIndex: 'target_date',
      key: 'target_date',
      width: '20%',
      render: (date: string) => (date ? dayjs(date).format('DD/MM/YYYY') : '-')
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: '5%',
      render: (_: any, record: Milestone, index: number) => (
        <Space size="small">
          <Popconfirm
            title="¿Eliminar este hito?"
            onConfirm={() => deleteMilestone(index)}
            okText="Sí"
            cancelText="No"
          >
            <Button type="text" danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '8px' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {error && (
          <Alert message="Error" description={error} type="error" closable />
        )}

        <Alert
          message="Revisa y edita los datos extraídos"
          description="Los datos fueron extraídos automáticamente del documento. Verifica que sean correctos antes de crear el proyecto."
          type="info"
          showIcon
        />

        <Card title="Información General" size="small">
          <Form form={form} layout="vertical">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Nombre del Proyecto"
                  name="project_name"
                  rules={[{ required: true, message: 'Requerido' }]}
                >
                  <Input placeholder="Nombre del proyecto" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="Cliente"
                  name="client_name"
                  rules={[{ required: true, message: 'Requerido' }]}
                >
                  <Input placeholder="Nombre del cliente" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              label="Descripción"
              name="description"
              rules={[{ required: true, message: 'Requerido' }]}
            >
              <TextArea rows={3} placeholder="Descripción del proyecto" />
            </Form.Item>

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="Fecha Inicio Estimada" name="estimated_start_date">
                  <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Fecha Fin Estimada" name="estimated_end_date">
                  <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Prioridad" name="priority">
                  <Select>
                    <Select.Option value="low">Baja</Select.Option>
                    <Select.Option value="medium">Media</Select.Option>
                    <Select.Option value="high">Alta</Select.Option>
                    <Select.Option value="critical">Crítica</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="Costo Presupuestado (USD)" name="budgeted_cost">
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={(value) => value!.replace(/\$\s?|(,*)/g, '')}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Ingreso Esperado (USD)" name="expected_revenue">
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={(value) => value!.replace(/\$\s?|(,*)/g, '')}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Card>

        <Card
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Tareas ({tasks.length})</span>
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={addTask}>
                Agregar Tarea
              </Button>
            </div>
          }
          size="small"
        >
          <Table
            dataSource={tasks}
            columns={taskColumns}
            rowKey={(_, index) => `task-${index}`}
            pagination={false}
            size="small"
            locale={{ emptyText: 'No hay tareas. Haz clic en "Agregar Tarea" para crear una.' }}
          />
        </Card>

        <Card
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Hitos ({milestones.length})</span>
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={addMilestone}>
                Agregar Hito
              </Button>
            </div>
          }
          size="small"
        >
          <Table
            dataSource={milestones}
            columns={milestoneColumns}
            rowKey={(_, index) => `milestone-${index}`}
            pagination={false}
            size="small"
            locale={{ emptyText: 'No hay hitos. Haz clic en "Agregar Hito" para crear uno.' }}
          />
        </Card>

        <Divider />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <Button onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button type="primary" onClick={handleSubmit} loading={loading} icon={<SaveOutlined />}>
            Crear Proyecto
          </Button>
        </div>
      </Space>
    </div>
  );
};
