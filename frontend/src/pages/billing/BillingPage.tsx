import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, Row, Col, Statistic, Table, Tag, Tabs, Button, Space, Select,
  Modal, Form, Input, InputNumber, DatePicker, message, Popconfirm
} from 'antd';
import { PlusOutlined, DownloadOutlined, DollarOutlined } from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import apiService from '../../services/api';
import { useAuthStore } from '@/store/authStore';
import { BillingDashboard, BillingDashboardRow, PaymentMilestone, Invoice } from '../../types/billing';

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

const CURRENCY_OPTIONS = [
  { value: 'CLP', label: 'CLP' },
  { value: 'USD', label: 'USD' },
  { value: 'UF', label: 'UF' }
];

const BillingPage: React.FC = () => {
  const { user } = useAuthStore();
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [projectFilter, setProjectFilter] = useState<number | undefined>(undefined);
  const [dashboard, setDashboard] = useState<BillingDashboard | null>(null);
  const [milestones, setMilestones] = useState<PaymentMilestone[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  // Nuevo hito de pago
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [projectMilestones, setProjectMilestones] = useState<{ id: number; name: string }[]>([]);
  const watchedProjectId = Form.useWatch('project_id', form);
  const watchedTriggerType = Form.useWatch('trigger_type', form);

  // Facturación de hitos seleccionados
  const [selectedMilestoneIds, setSelectedMilestoneIds] = useState<React.Key[]>([]);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceForm] = Form.useForm();

  // Registro de pago sobre una factura
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);
  const [paymentForm] = Form.useForm();

  useEffect(() => {
    apiService.getProjects().then(p => setProjects(p.map((x: any) => ({ id: x.id, name: x.name })))).catch(() => {});
  }, []);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectFilter]);

  // Carga los hitos del proyecto (Gantt) para poblar el selector de "hito de proyecto"
  // cuando el disparador del hito de pago requiere uno (progress_pct / deliverable_approved).
  useEffect(() => {
    if (createModalOpen && watchedProjectId) {
      apiService.getProjectGantt(watchedProjectId)
        .then(res => setProjectMilestones((res.milestones || []).map((m: any) => ({ id: m.id, name: m.name }))))
        .catch(() => setProjectMilestones([]));
    } else {
      setProjectMilestones([]);
    }
  }, [watchedProjectId, createModalOpen]);

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
      const payload: any = {
        project_id: values.project_id,
        name: values.name,
        description: values.description,
        amount: values.amount,
        currency: values.currency,
        trigger_type: values.trigger_type
      };

      if (values.trigger_type === 'date') {
        payload.planned_date = values.planned_date ? values.planned_date.format('YYYY-MM-DD') : undefined;
      } else {
        payload.project_milestone_id = values.project_milestone_id;
        if (values.trigger_type === 'progress_pct') {
          payload.trigger_value = values.trigger_value;
        }
        if (values.planned_date) {
          payload.planned_date = values.planned_date.format('YYYY-MM-DD');
        }
      }

      await apiService.createPaymentMilestone(payload);
      message.success('Hito de pago creado');
      setCreateModalOpen(false);
      form.resetFields();
      loadAll();
    } catch (error: any) {
      message.error(error.response?.data?.error || error.message || 'Error al crear el hito de pago');
    }
  };

  const handleDeleteMilestone = async (id: number) => {
    try {
      await apiService.deletePaymentMilestone(id);
      message.success('Hito eliminado');
      loadAll();
    } catch (error: any) {
      message.error(error.response?.data?.error || error.message || 'No se pudo eliminar (¿ya no está pendiente?)');
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

  const selectedMilestones = useMemo(
    () => milestones.filter(m => selectedMilestoneIds.includes(m.id)),
    [milestones, selectedMilestoneIds]
  );

  const handleOpenInvoiceModal = () => {
    invoiceForm.resetFields();
    setInvoiceModalOpen(true);
  };

  const handleCreateInvoice = async (values: any) => {
    try {
      const projectId = selectedMilestones[0]?.project_id;
      await apiService.createInvoice({
        project_id: projectId,
        invoice_number: values.invoice_number,
        issue_date: values.issue_date.format('YYYY-MM-DD'),
        due_date: values.due_date.format('YYYY-MM-DD'),
        payment_milestone_ids: selectedMilestoneIds
      });
      message.success('Factura creada');
      setInvoiceModalOpen(false);
      invoiceForm.resetFields();
      setSelectedMilestoneIds([]);
      loadAll();
    } catch (error: any) {
      message.error(error.response?.data?.error || error.message || 'Error al crear la factura');
    }
  };

  const handleOpenPaymentModal = (invoice: Invoice) => {
    setSelectedInvoiceForPayment(invoice);
    paymentForm.resetFields();
    paymentForm.setFieldsValue({ currency: invoice.currency });
    setPaymentModalOpen(true);
  };

  const handleRecordPayment = async (values: any) => {
    if (!selectedInvoiceForPayment) return;
    try {
      await apiService.recordPayment(selectedInvoiceForPayment.id, {
        amount: values.amount,
        currency: values.currency,
        payment_date: values.payment_date.format('YYYY-MM-DD'),
        method: values.method || undefined,
        reference: values.reference || undefined
      });
      message.success('Pago registrado');
      setPaymentModalOpen(false);
      paymentForm.resetFields();
      setSelectedInvoiceForPayment(null);
      loadAll();
    } catch (error: any) {
      message.error(error.response?.data?.error || error.message || 'Error al registrar el pago');
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
    {
      title: 'Monto (CLP)', dataIndex: 'amount_clp', key: 'amount_clp',
      render: (v: number, r: BillingDashboardRow) => (
        <Space>
          {`$${v.toLocaleString('es-CL')}`}
          {r.rate_missing && <Tag color="orange">Sin tipo de cambio</Tag>}
        </Space>
      )
    },
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
        <Space>
          <Button icon={<DownloadOutlined />} size="small" onClick={() => handleDownloadStatement(r.project_id)}>
            Estado de pago
          </Button>
          {user?.role === 'team_lead' && r.status !== 'paid' && r.status !== 'cancelled' && (
            <Button icon={<DollarOutlined />} size="small" type="primary" onClick={() => handleOpenPaymentModal(r)}>
              Registrar pago
            </Button>
          )}
        </Space>
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
              children: (
                <>
                  <Space style={{ marginBottom: 12 }}>
                    <Button
                      type="primary"
                      disabled={selectedMilestoneIds.length === 0}
                      onClick={handleOpenInvoiceModal}
                    >
                      Facturar seleccionados ({selectedMilestoneIds.length})
                    </Button>
                  </Space>
                  <Table
                    dataSource={milestones}
                    columns={milestoneColumns}
                    rowKey="id"
                    loading={loading}
                    rowSelection={{
                      selectedRowKeys: selectedMilestoneIds,
                      onChange: (keys) => setSelectedMilestoneIds(keys),
                      getCheckboxProps: (record: PaymentMilestone) => ({ disabled: record.status !== 'billable' })
                    }}
                  />
                </>
              )
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
        destroyOnHidden
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
            <Select options={CURRENCY_OPTIONS} />
          </Form.Item>
          <Form.Item name="trigger_type" label="Disparador" initialValue="date" rules={[{ required: true }]}>
            <Select options={[
              { value: 'date', label: 'Fecha' },
              { value: 'progress_pct', label: '% de avance' },
              { value: 'deliverable_approved', label: 'Entregable aprobado' }
            ]} />
          </Form.Item>

          {watchedTriggerType !== 'date' && (
            <Form.Item
              name="project_milestone_id"
              label="Hito de proyecto"
              rules={[{ required: true, message: 'Selecciona el hito de proyecto asociado' }]}
            >
              <Select
                placeholder={watchedProjectId ? 'Selecciona un hito del proyecto' : 'Selecciona primero un proyecto'}
                options={projectMilestones.map(m => ({ value: m.id, label: m.name }))}
              />
            </Form.Item>
          )}

          {watchedTriggerType === 'progress_pct' && (
            <Form.Item
              name="trigger_value"
              label="% de avance requerido"
              rules={[{ required: true, message: 'Ingresa el % de avance requerido' }]}
            >
              <InputNumber style={{ width: '100%' }} min={0} max={100} />
            </Form.Item>
          )}

          <Form.Item
            name="planned_date"
            label="Fecha planificada"
            rules={[{ required: watchedTriggerType === 'date', message: 'La fecha planificada es requerida' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Facturar hitos seleccionados"
        open={invoiceModalOpen}
        onCancel={() => setInvoiceModalOpen(false)}
        onOk={() => invoiceForm.submit()}
        destroyOnHidden
      >
        <p>
          Se facturarán {selectedMilestones.length} hito(s) de "{selectedMilestones[0]?.project_name || '—'}" por un total de{' '}
          {selectedMilestones.reduce((s, m) => s + m.amount, 0).toLocaleString('es-CL')} {selectedMilestones[0]?.currency}.
        </p>
        <Form form={invoiceForm} layout="vertical" onFinish={handleCreateInvoice}>
          <Form.Item name="invoice_number" label="N° de factura" rules={[{ required: true }]}>
            <Input placeholder="Ej: F-0001" />
          </Form.Item>
          <Form.Item name="issue_date" label="Fecha de emisión" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="due_date" label="Fecha de vencimiento" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Registrar pago${selectedInvoiceForPayment ? ` - Factura ${selectedInvoiceForPayment.invoice_number}` : ''}`}
        open={paymentModalOpen}
        onCancel={() => setPaymentModalOpen(false)}
        onOk={() => paymentForm.submit()}
        destroyOnHidden
      >
        <Form form={paymentForm} layout="vertical" onFinish={handleRecordPayment}>
          <Form.Item name="amount" label="Monto" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={1} />
          </Form.Item>
          <Form.Item name="currency" label="Moneda" rules={[{ required: true }]}>
            <Select options={CURRENCY_OPTIONS} />
          </Form.Item>
          <Form.Item name="payment_date" label="Fecha de pago" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="method" label="Método">
            <Input placeholder="Ej: Transferencia" />
          </Form.Item>
          <Form.Item name="reference" label="Referencia">
            <Input placeholder="N° de operación" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BillingPage;
