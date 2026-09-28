import React, { useState } from 'react';
import { Alert, App, Button, Card, Form, Input, InputNumber, Modal, Select, Space, Statistic, Table, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { apiService } from '@/services/api';
import { Invoice, PaymentMilestone } from '@/types/billing';

interface Props {
  projectId: number;
  canManage: boolean;
  milestones: PaymentMilestone[];
  invoices: Invoice[];
  loading: boolean;
  onRefresh: () => Promise<void>;
}
const currencies = ['CLP', 'USD', 'UF'].map(value => ({ value, label: value }));
const labels: Record<string, string> = { pending: 'Pendiente', billable: 'Por facturar', invoiced: 'Facturado', paid: 'Pagado', overdue: 'Vencido', issued: 'Emitida', partially_paid: 'Pago parcial', cancelled: 'Anulada', draft: 'Borrador' };
const money = (value: number, currency: string) => `${Number(value).toLocaleString('es-CL')} ${currency}`;
const balance = (invoice: Invoice) => Math.max(0, Number(invoice.amount) - Number(invoice.totals?.paid_amount ?? invoice.payments?.reduce((sum, payment) => sum + Number(payment.amount), 0) ?? 0));

export const ProjectBillingWorkspace: React.FC<Props> = ({ projectId, canManage, milestones, invoices, loading, onRefresh }) => {
  const { message, modal } = App.useApp();
  const [form] = Form.useForm();
  const [mode, setMode] = useState<'milestone' | 'invoice' | 'payment' | null>(null);
  const [editing, setEditing] = useState<PaymentMilestone | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [selected, setSelected] = useState<React.Key[]>([]);
  const [sources, setSources] = useState<{ id: number; name: string }[]>([]);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState(false);
  const [saving, setSaving] = useState(false);
  const trigger = Form.useWatch('trigger_type', form) || 'date';
  const chosen = milestones.filter(row => selected.includes(row.id) && row.status === 'billable');
  const sameCurrency = new Set(chosen.map(row => row.currency)).size <= 1;

  const openMilestone = async (row: PaymentMilestone | null = null) => {
    setEditing(row); form.resetFields();
    form.setFieldsValue(row ? { ...row, description: row.description || '', planned_date: row.planned_date || undefined } : { currency: 'CLP', trigger_type: 'date' });
    setMode('milestone'); setSourceLoading(true); setSourceError(false);
    try { const data = await apiService.getProjectGantt(projectId); setSources(data.milestones || []); }
    catch { setSources([]); setSourceError(true); }
    finally { setSourceLoading(false); }
  };
  const openInvoice = () => {
    form.resetFields(); form.setFieldsValue({ issue_date: dayjs().format('YYYY-MM-DD') }); setMode('invoice');
  };
  const openPayment = (row: Invoice) => {
    setInvoice(row); form.resetFields(); form.setFieldsValue({ amount: balance(row), payment_date: dayjs().format('YYYY-MM-DD') }); setMode('payment');
  };
  const save = async () => {
    if (saving || !canManage) return;
    try {
      const values = await form.validateFields(); setSaving(true);
      if (mode === 'milestone') {
        const common = { name: values.name, description: values.description || '', amount: values.amount, currency: values.currency, planned_date: values.planned_date || null,
          ...(trigger === 'progress_pct' ? { trigger_value: values.trigger_value } : {}) };
        if (editing) await apiService.updatePaymentMilestone(editing.id, common);
        else await apiService.createPaymentMilestone({ ...common, project_id: projectId, trigger_type: trigger,
          ...(trigger !== 'date' ? { project_milestone_id: values.project_milestone_id } : {}) });
      } else if (mode === 'invoice') {
        if (!chosen.length || !sameCurrency || chosen.length !== selected.length) { message.error('Selecciona hitos cobrables de una misma moneda'); return; }
        await apiService.createInvoice({ ...values, project_id: projectId, payment_milestone_ids: chosen.map(row => row.id) });
        setSelected([]);
      } else if (mode === 'payment' && invoice) {
        await apiService.recordPayment(invoice.id, { ...values, currency: invoice.currency });
      }
      message.success(mode === 'milestone' ? 'Hito guardado' : mode === 'invoice' ? 'Factura registrada' : 'Pago registrado');
      setMode(null); await onRefresh();
    } catch (error: any) {
      if (!error.errorFields) message.error(error?.response?.data?.error || 'No se pudo guardar. Revisa los datos e intenta nuevamente.');
    } finally { setSaving(false); }
  };
  const remove = (row: PaymentMilestone) => modal.confirm({ title: `¿Eliminar el hito “${row.name}”?`, okText: 'Eliminar', cancelText: 'Cancelar', okButtonProps: { danger: true }, onOk: async () => {
    try { await apiService.deletePaymentMilestone(row.id); await onRefresh(); }
    catch (error: any) { message.error(error?.response?.data?.error || 'No se pudo eliminar el hito'); throw error; }
  } });

  if (!canManage) return <Alert type="info" message="La gestión de cobranza está disponible para jefatura." />;
  return <div className="commercial-workspace">
    <div className="commercial-kpis">
      <Statistic title="Hitos cobrables" value={milestones.filter(row => row.status === 'billable').length} />
      <Statistic title="Facturas emitidas" value={invoices.filter(row => !['draft', 'cancelled'].includes(row.status)).length} />
      <Statistic title="Facturas vencidas" value={invoices.filter(row => row.status === 'overdue').length} />
      <Statistic title="Hitos pagados" value={milestones.filter(row => row.status === 'paid').length} />
    </div>
    <Card title="Hitos de pago">
      <Space wrap style={{ marginBottom: 16 }}>
        <Button type="primary" disabled={loading} onClick={() => void openMilestone()}>Agregar hito de pago</Button>
        <Button disabled={loading || !chosen.length || !sameCurrency || chosen.length !== selected.length} onClick={openInvoice}>Facturar seleccionados ({chosen.length})</Button>
      </Space>
      {!sameCurrency && <Alert type="warning" message="Cada factura debe contener hitos de una misma moneda." />}
      <Table<PaymentMilestone> size="small" rowKey="id" loading={loading} dataSource={milestones} pagination={false}
        locale={{ emptyText: 'Agrega el primer hito para planificar la cobranza del proyecto.' }}
        rowSelection={{ selectedRowKeys: selected, onChange: setSelected, getCheckboxProps: row => ({ disabled: row.status !== 'billable' }) }} columns={[
          { title: 'Hito', dataIndex: 'name' }, { title: 'Fecha prevista', dataIndex: 'planned_date', render: value => value ? dayjs(value).format('DD MMM YYYY') : 'Por definir' },
          { title: 'Monto', render: (_, row) => money(row.amount, row.currency) },
          { title: 'Estado', dataIndex: 'status', render: value => <Tag>{labels[value] || value}</Tag> },
          { title: 'Acciones', render: (_, row) => row.status === 'pending' ? <Space wrap><Button size="small" onClick={() => void openMilestone(row)}>Editar</Button><Button size="small" danger onClick={() => remove(row)}>Eliminar</Button></Space> : '—' }
        ]} />
      <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>Los hitos quedan cobrables cuando cumplen su fecha, avance o aprobación. Puedes editar o eliminar los que aún están pendientes.</Typography.Paragraph>
    </Card>
    <Card title="Facturas y pagos">
      <Table<Invoice> size="small" rowKey="id" loading={loading} dataSource={invoices} pagination={false}
        locale={{ emptyText: 'Selecciona hitos cobrables y pulsa “Facturar seleccionados” para registrar una factura.' }}
        expandable={{ expandedRowRender: row => <Table size="small" rowKey="id" pagination={false} dataSource={row.payments || []} locale={{ emptyText: 'Sin pagos registrados' }} columns={[
          { title: 'Fecha de pago', dataIndex: 'payment_date' }, { title: 'Monto', render: (_, payment) => money(payment.amount, payment.currency) }, { title: 'Medio', dataIndex: 'method' }, { title: 'Referencia', dataIndex: 'reference' }
        ]} /> }} columns={[
          { title: 'Factura', dataIndex: 'invoice_number' }, { title: 'Vencimiento', dataIndex: 'due_date', render: value => dayjs(value).format('DD MMM YYYY') },
          { title: 'Total', render: (_, row) => money(row.amount, row.currency) }, { title: 'Saldo', render: (_, row) => money(balance(row), row.currency) },
          { title: 'Estado', dataIndex: 'status', render: value => <Tag>{labels[value] || value}</Tag> },
          { title: 'Acción', render: (_, row) => ['issued', 'partially_paid', 'overdue'].includes(row.status) && balance(row) > 0 ? <Button size="small" onClick={() => openPayment(row)}>Registrar pago</Button> : '—' }
        ]} />
    </Card>
    <Modal open={mode !== null} title={mode === 'milestone' ? editing ? 'Editar hito de pago' : 'Agregar hito de pago' : mode === 'invoice' ? 'Registrar factura' : `Registrar pago · ${invoice?.invoice_number || ''}`}
      onCancel={() => { if (!saving) setMode(null); }} onOk={() => void save()} okText="Guardar" cancelText="Cancelar" confirmLoading={saving}>
      <Form form={form} layout="vertical" disabled={saving}>
        {mode === 'milestone' && <>
          <Form.Item name="name" label="Nombre del hito" rules={[{ required: true, whitespace: true, message: 'Ingresa el nombre' }]}><Input maxLength={200} placeholder="Ej.: Anticipo 30%" /></Form.Item>
          <Form.Item name="description" label="Descripción"><Input.TextArea maxLength={1000} /></Form.Item>
          <Form.Item name="amount" label="Monto" rules={[{ required: true }, { type: 'number', min: 0.0001 }]}><InputNumber min={0.0001} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="currency" label="Moneda" rules={[{ required: true }]}><Select options={currencies} /></Form.Item>
          <Form.Item name="trigger_type" label="Condición de cobro"><Select disabled={Boolean(editing)} options={[{ value: 'date', label: 'Fecha' }, { value: 'progress_pct', label: 'Avance de un hito del proyecto' }, { value: 'deliverable_approved', label: 'Entregable aprobado' }]} /></Form.Item>
          {trigger !== 'date' && <>
            {sourceError && <Alert type="error" message="No se pudieron cargar los hitos del proyecto. Vuelve a abrir el formulario." />}
            <Form.Item name="project_milestone_id" label="Hito del proyecto" rules={[{ required: true, message: 'Selecciona un hito del proyecto' }]}><Select loading={sourceLoading} disabled={Boolean(editing)} options={sources.map(row => ({ value: row.id, label: row.name }))} notFoundContent="Primero crea un hito en Hitos y PMO" /></Form.Item>
          </>}
          {trigger === 'progress_pct' && <Form.Item name="trigger_value" label="Avance requerido (%)" rules={[{ required: true }]}><InputNumber min={0} max={100} /></Form.Item>}
          <Form.Item name="planned_date" label="Fecha prevista" rules={[{ required: trigger === 'date', message: 'Selecciona una fecha' }]}><Input type="date" /></Form.Item>
        </>}
        {mode === 'invoice' && <>
          <Alert type="info" style={{ marginBottom: 16 }} message={`Total a facturar: ${money(chosen.reduce((sum, row) => sum + Number(row.amount), 0), chosen[0]?.currency || '')}`} />
          <Form.Item name="invoice_number" label="Número de factura" rules={[{ required: true, whitespace: true }]}><Input maxLength={50} /></Form.Item>
          <Form.Item name="issue_date" label="Fecha de emisión" rules={[{ required: true }]}><Input type="date" /></Form.Item>
          <Form.Item name="due_date" label="Fecha de vencimiento" dependencies={['issue_date']} rules={[{ required: true }, { validator: async (_, value) => { if (value && value < form.getFieldValue('issue_date')) throw new Error('El vencimiento debe ser igual o posterior a la emisión'); } }]}><Input type="date" /></Form.Item>
          <Form.Item name="notes" label="Notas"><Input.TextArea maxLength={2000} /></Form.Item>
        </>}
        {mode === 'payment' && invoice && <>
          <Alert type="info" style={{ marginBottom: 16 }} message={`Saldo pendiente: ${money(balance(invoice), invoice.currency)}`} />
          <Form.Item name="amount" label={`Monto recibido (${invoice.currency})`} rules={[{ required: true }, { type: 'number', min: 0.0001, max: balance(invoice), message: 'Ingresa un monto positivo que no supere el saldo' }]}><InputNumber min={0.0001} max={balance(invoice)} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="payment_date" label="Fecha del pago" rules={[{ required: true }]}><Input type="date" /></Form.Item>
          <Form.Item name="method" label="Medio de pago"><Input maxLength={50} placeholder="Transferencia" /></Form.Item>
          <Form.Item name="reference" label="Referencia del comprobante"><Input maxLength={100} /></Form.Item>
        </>}
      </Form>
    </Modal>
  </div>;
};
