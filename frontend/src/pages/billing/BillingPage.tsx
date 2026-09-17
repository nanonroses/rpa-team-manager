import React, { useEffect, useState } from 'react';
import {
  Card, Row, Col, Statistic, Table, Tag, Tabs, Button, Space, Select,
  Modal, Form, Input, InputNumber, DatePicker, message, Popconfirm
} from 'antd';
import { PlusOutlined, DownloadOutlined } from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import apiService from '../../services/api';
import { BillingDashboard, PaymentMilestone, Invoice } from '../../types/billing';

const STATUS_COLOR: Record<string, string> = {
  pending: 'default',
  billable: 'blue',
  invoiced: 'gold',
  paid: 'green',
  overdue: 'red'
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  billable: 'Por facturar',
  invoiced: 'Facturado',
  paid: 'Pagado',
  overdue: 'Vencido'
};

const BillingPage: React.FC = () => {
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [projectFilter, setProjectFilter] = useState<number | undefined>(undefined);
  const [dashboard, setDashboard] = useState<BillingDashboard | null>(null);
  const [milestones, setMilestones] = useState<PaymentMilestone[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    apiService.getProjects().then(p => setProjects(p.map((x: any) => ({ id: x.id, name: x.name })))).catch(() => {});
  }, []);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectFilter]);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [dash, ms, inv] = await Promise.all([
        apiService.getBillingDashboard(projectFilter),
        apiService.getPaymentMilestones(projectFilter),
        apiService.getInvoices(projectFilter)
      ]);
      setDashboard(dash);
      setMilestones(ms);
      setInvoices(inv);
    } catch (error) {
      message.error('Error al cargar datos de cobranza');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMilestone = async (values: any) => {
    try {
      await apiService.createPaymentMilestone({
        ...values,
        planned_date: values.planned_date ? values.planned_date.format('YYYY-MM-DD') : undefined
      });
      message.success('Hito de pago creado');
      setCreateModalOpen(false);
      form.resetFields();
      loadAll();
    } catch (error) {
      message.error('Error al crear el hito de pago');
    }
  };

  const handleDeleteMilestone = async (id: number) => {
    try {
      await apiService.deletePaymentMilestone(id);
      message.success('Hito eliminado');
      loadAll();
    } catch (error) {
      message.error('No se pudo eliminar (¿ya no está pendiente?)');
    }
  };

  const handleDownloadStatement = async (projectId: number) => {
    try {
      const blob = await apiService.downloadPaymentStatement(projectId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `estado-pago-${projectId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      message.error('No se pudo generar el PDF');
    }
  };

  const milestoneColumns = [
    { title: 'Proyecto', dataIndex: 'project_name', key: 'project_name' },
    { title: 'Nombre', dataIndex: 'name', key: 'name' },
    { title: 'Monto', key: 'amount', render: (_: any, r: PaymentMilestone) => `${r.amount.toLocaleString('es-CL')} ${r.currency}` },
    { title: 'Fecha planificada', dataIndex: 'planned_date', key: 'planned_date' },
    {
      title: 'Estado', dataIndex: 'status', key: 'status',
      render: (status: string) => <Tag color={STATUS_COLOR[status]}>{STATUS_LABEL[status] || status}</Tag>
    },
    {
      title: 'Acciones', key: 'actions',
      render: (_: any, r: PaymentMilestone) => r.status === 'pending' ? (
        <Popconfirm title="¿Eliminar este hito?" onConfirm={() => handleDeleteMilestone(r.id)}>
          <Button danger size="small">Eliminar</Button>
        </Popconfirm>
      ) : null
    }
  ];

  const dashboardRowColumns = [
    { title: 'Proyecto', dataIndex: 'project_name', key: 'project_name' },
    { title: 'Hito', dataIndex: 'name', key: 'name' },
    { title: 'Monto (CLP)', dataIndex: 'amount_clp', key: 'amount_clp', render: (v: number) => `$${v.toLocaleString('es-CL')}` },
    { title: 'Fecha', dataIndex: 'planned_date', key: 'planned_date' }
  ];

  const invoiceColumns = [
    { title: 'N° Factura', dataIndex: 'invoice_number', key: 'invoice_number' },
    { title: 'Proyecto', dataIndex: 'project_name', key: 'project_name' },
    { title: 'Emisión', dataIndex: 'issue_date', key: 'issue_date' },
    { title: 'Vencimiento', dataIndex: 'due_date', key: 'due_date' },
    { title: 'Monto', key: 'amount', render: (_: any, r: Invoice) => `${r.amount.toLocaleString('es-CL')} ${r.currency}` },
    {
      title: 'Estado', dataIndex: 'status', key: 'status',
      render: (status: string) => <Tag color={STATUS_COLOR[status] || 'default'}>{status}</Tag>
    },
    {
      title: 'Acciones', key: 'actions',
      render: (_: any, r: Invoice) => (
        <Button icon={<DownloadOutlined />} size="small" onClick={() => handleDownloadStatement(r.project_id)}>
          Estado de pago
        </Button>
      )
    }
  ];

  return (
    <div className="page-container">
      <Card
        title="Cobranza"
        extra={
          <Space>
            <Select
              allowClear
              placeholder="Todos los proyectos"
              style={{ width: 240 }}
              value={projectFilter}
              onChange={setProjectFilter}
              options={projects.map(p => ({ value: p.id, label: p.name }))}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
              Nuevo hito de pago
            </Button>
          </Space>
        }
      >
        <Tabs
          defaultActiveKey="dashboard"
          items={[
            {
              key: 'dashboard',
              label: 'Dashboard',
              children: (
                <>
                  <Row gutter={16} style={{ marginBottom: 24 }}>
                    <Col span={5}><Card><Statistic title="Por facturar" value={dashboard?.summary.total_billable_clp || 0} prefix="$" /></Card></Col>
                    <Col span={5}><Card><Statistic title="Facturado (no pagado)" value={dashboard?.summary.total_invoiced_clp || 0} prefix="$" /></Card></Col>
                    <Col span={5}><Card><Statistic title="Cobrado" value={dashboard?.summary.total_paid_clp || 0} prefix="$" valueStyle={{ color: '#3f8600' }} /></Card></Col>
                    <Col span={5}><Card><Statistic title="Vencido" value={dashboard?.summary.total_overdue_clp || 0} prefix="$" valueStyle={{ color: '#cf1322' }} /></Card></Col>
                    <Col span={4}><Card><Statistic title="Pendiente" value={dashboard?.summary.total_pending_clp || 0} prefix="$" /></Card></Col>
                  </Row>

                  <Card title="Flujo de caja proyectado (CLP)" style={{ marginBottom: 24 }} size="small">
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={dashboard?.cashflow_projection || []}>
                        <XAxis dataKey="month" />
                        <YAxis />
                        <RechartsTooltip formatter={(v: number) => `$${v.toLocaleString('es-CL')}`} />
                        <Bar dataKey="expected_amount_clp" fill="#1890ff" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>

                  <Card title="Listo para facturar hoy" size="small" style={{ marginBottom: 24 }}>
                    <Table dataSource={dashboard?.ready_to_invoice || []} columns={dashboardRowColumns} rowKey="id" loading={loading} pagination={false} />
                  </Card>

                  <Card title="Vencido" size="small">
                    <Table dataSource={dashboard?.overdue || []} columns={dashboardRowColumns} rowKey="id" loading={loading} pagination={false} />
                  </Card>
                </>
              )
            },
            {
              key: 'milestones',
              label: 'Hitos de pago',
              children: <Table dataSource={milestones} columns={milestoneColumns} rowKey="id" loading={loading} />
            },
            {
              key: 'invoices',
              label: 'Facturas',
              children: <Table dataSource={invoices} columns={invoiceColumns} rowKey="id" loading={loading} />
            }
          ]}
        />
      </Card>

      <Modal
        title="Nuevo hito de pago"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => form.submit()}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreateMilestone}>
          <Form.Item name="project_id" label="Proyecto" rules={[{ required: true }]}>
            <Select options={projects.map(p => ({ value: p.id, label: p.name }))} />
          </Form.Item>
          <Form.Item name="name" label="Nombre" rules={[{ required: true }]}>
            <Input placeholder="Ej: Anticipo 30%" />
          </Form.Item>
          <Form.Item name="amount" label="Monto" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={1} />
          </Form.Item>
          <Form.Item name="currency" label="Moneda" initialValue="CLP" rules={[{ required: true }]}>
            <Select options={[{ value: 'CLP', label: 'CLP' }, { value: 'USD', label: 'USD' }, { value: 'UF', label: 'UF' }]} />
          </Form.Item>
          <Form.Item name="trigger_type" label="Disparador" initialValue="date" rules={[{ required: true }]}>
            <Select options={[
              { value: 'date', label: 'Fecha' },
              { value: 'progress_pct', label: '% de avance' },
              { value: 'deliverable_approved', label: 'Entregable aprobado' }
            ]} />
          </Form.Item>
          <Form.Item name="planned_date" label="Fecha planificada">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BillingPage;
