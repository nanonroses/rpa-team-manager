import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Checkbox, DatePicker, Descriptions, Empty, Form, Input, InputNumber, Modal, Select, Space, Statistic, Switch, Table, Tabs, Tag, Typography, App } from 'antd';
import { CalendarOutlined, CheckCircleOutlined, DollarOutlined, FileTextOutlined, PlusOutlined, TeamOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { apiService } from '@/services/api';
import { User } from '@/types/auth';
import { Project } from '@/types/project';
import { FileManager } from '@/components/files';

const { Text, Title } = Typography;
interface Props { project: Project; user?: User; onRefresh?: () => void; initialTab?: string; }
type Row = Record<string, any>;
const rowsFrom = (response: any): Row[] => {
  const payload = response?.data ?? response;
  if (Array.isArray(payload)) return payload;
  return Array.isArray(payload?.data) ? payload.data : [];
};

export const ProjectCommercialSection: React.FC<Props> = ({ project, user, onRefresh, initialTab = 'commercial' }) => {
  const { message, modal } = App.useApp();
  const [quoteForm] = Form.useForm();
  const [meetings, setMeetings] = useState<Row[]>([]);
  const [quotes, setQuotes] = useState<Row[]>([]);
  const [documents, setDocuments] = useState<Row[]>([]);
  const [capacity, setCapacity] = useState<Row[]>([]);
  const [paymentMilestones, setPaymentMilestones] = useState<Row[]>([]);
  const [invoices, setInvoices] = useState<Row[]>([]);
  const [scopeChanges, setScopeChanges] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [documentType, setDocumentType] = useState<string | null>(null);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [scopeQuoteId, setScopeQuoteId] = useState<number | null>(null);
  const isLead = user?.role === 'team_lead';
  const canManage = isLead || user?.role === 'rpa_operations';
  const hasClientAcceptanceEvidence = documents.some((row) => row.document_type === 'client_approval');
  const base = `/commercial/projects/${project.id}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        apiService.request({ url: `${base}/meetings` }),
        isLead ? apiService.request({ url: `${base}/quotes` }) : Promise.resolve({ data: { data: [] } }),
        apiService.request({ url: `${base}/documents` }),
        isLead ? apiService.request({ url: `${base}/capacity` }) : Promise.resolve({ data: { data: [] } }),
        isLead ? apiService.request({ url: `/billing/payment-milestones?project_id=${project.id}` }) : Promise.resolve({ data: [] }),
        isLead ? apiService.request({ url: `/billing/invoices?project_id=${project.id}` }) : Promise.resolve({ data: [] }),
        apiService.request({ url: `/lifecycle/projects/${project.id}/scope-changes` })
      ]);
      if (results[0].status === 'fulfilled') setMeetings(rowsFrom(results[0].value));
      if (results[1].status === 'fulfilled') setQuotes(rowsFrom(results[1].value));
      else message.error('No se pudieron cargar las versiones de cotización. Verifica que tengas permiso financiero.');
      if (results[2].status === 'fulfilled') setDocuments(rowsFrom(results[2].value));
      if (results[3].status === 'fulfilled') setCapacity(rowsFrom(results[3].value));
      if (results[4].status === 'fulfilled') setPaymentMilestones(rowsFrom(results[4].value));
      if (results[5].status === 'fulfilled') setInvoices(rowsFrom(results[5].value));
      else message.error('No se pudieron cargar facturas y pagos. Verifica que tengas permiso financiero.');
      if (results[6].status === 'fulfilled') setScopeChanges(rowsFrom(results[6].value));
    } catch {
      message.error('No se pudo cargar el seguimiento comercial');
    } finally { setLoading(false); }
  }, [base, isLead, message, project.id]);

  useEffect(() => { void load(); }, [load]);

  const save = async (url: string, data: Row, success: string, method: 'post' | 'patch' = 'post') => {
    try {
      if (method === 'patch') await apiService.request({ url, method: 'PATCH', data });
      else await apiService.post(url, data);
      message.success(success);
      await load();
      onRefresh?.();
      return true;
    } catch (error: any) {
      message.error(error?.response?.data?.error || 'No se pudo guardar el registro');
      return false;
    }
  };

  const requestLost = () => modal.confirm({
    title: 'Cerrar oportunidad como perdida',
    content: <Input.TextArea id="loss-reason" placeholder="Motivo del cierre" rows={3} />,
    okText: 'Cerrar oportunidad', cancelText: 'Cancelar',
    onOk: async () => {
      const reason = (document.getElementById('loss-reason') as HTMLTextAreaElement | null)?.value.trim();
      if (!reason) { message.error('Registra el motivo del cierre'); throw new Error('reason required'); }
      await save(`${base}/lost`, { reason }, 'Oportunidad cerrada');
    }
  });

  const requestRejectQuote = (quoteId: number) => modal.confirm({
    title: 'Rechazar versión de cotización',
    content: <Input.TextArea id="reject-reason" placeholder="Motivo del rechazo" rows={3} />,
    okText: 'Rechazar versión', cancelText: 'Cancelar',
    onOk: async () => {
      const reason = (document.getElementById('reject-reason') as HTMLTextAreaElement | null)?.value.trim();
      if (!reason) { message.error('Registra el motivo del rechazo'); throw new Error('reason required'); }
      await save(`/commercial/quotes/${quoteId}/reject`, { reason }, 'Cotización rechazada');
    }
  });

  const logMeeting = async (values: Row) => {
    const done = await save(`${base}/meetings`, { ...values, meeting_date: values.meeting_date.toISOString(), has_pdd: Boolean(values.has_pdd), has_technical_commercial_proposal: Boolean(values.has_technical_commercial_proposal) }, 'Reunión registrada');
    if (done) setMeetingOpen(false);
  };

  const createQuote = async (values: Row) => {
    const done = await save(`${base}/quotes`, values, 'Nueva versión de cotización registrada');
    if (done) setQuoteOpen(false);
  };

  const estimateQuoteCost = async () => {
    try {
      const { hours, currency } = await quoteForm.validateFields(['hours', 'currency']);
      const response = await apiService.request({ url: `${base}/quote-cost-estimate?hours=${encodeURIComponent(hours)}&currency=${encodeURIComponent(currency)}` });
      const estimate = response?.data?.estimated_cost ?? response?.estimated_cost;
      if (!Number.isFinite(Number(estimate))) throw new Error('No se recibió una estimación válida');
      quoteForm.setFieldValue('estimated_cost', estimate);
      message.success('Costo estimado según el costo horario del equipo');
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.response?.data?.error || error?.message || 'No se pudo estimar el costo');
    }
  };

  const recordDocument = async (values: Row) => {
    const done = await save(`${base}/documents`, { ...values, document_type: documentType, document_date: values.document_date?.format('YYYY-MM-DD') }, 'Documento registrado');
    if (done) setDocumentType(null);
  };

  const quoteColumns: any[] = [
    { title: 'Versión', dataIndex: 'version', render: (v: number) => `v${v}` },
    { title: 'Tipo', dataIndex: 'pricing_model', render: (v: string) => ({ fixed: 'Precio fijo', hourly: 'Por horas', mixed: 'Mixta' }[v] || v) },
    ...(isLead ? [{ title: 'Monto', dataIndex: 'amount', render: (v: number, row: Row) => `${row.currency} ${Number(v).toLocaleString('es-CL')}` }, { title: 'Margen', dataIndex: 'margin_percent', render: (v: number | null) => v == null ? 'Por definir' : `${Number(v).toFixed(1)}%` }] : []),
    { title: 'Archivo', dataIndex: 'file_id', render: (v: number | null) => v ? <a href={`/api/files/${v}/download`} target="_blank" rel="noreferrer">Descargar</a> : 'Sin archivo' },
    { title: 'Estado', dataIndex: 'status', render: (v: string) => <Tag color={v === 'approved' ? 'green' : v === 'replaced' ? 'default' : 'blue'}>{({ sent: 'Enviada', approved: 'Validada por jefatura', replaced: 'Reemplazada', rejected: 'Rechazada', draft: 'Borrador' } as Row)[v] || v}</Tag> },
    { title: 'Registrada', dataIndex: 'created_at', render: (v: string) => v ? dayjs(v).format('DD MMM YYYY') : '—' },
    ...(isLead ? [{ title: 'Acción', key: 'action', render: (_: unknown, row: Row) => row.status === 'sent' ? <Space>
      <Button size="small" onClick={() => row.scope_change_id ? setScopeQuoteId(row.id) : void save(`/commercial/quotes/${row.id}/approve`, {}, 'Cotización validada por jefatura')}>Validar versión</Button>
      <Button size="small" danger onClick={() => requestRejectQuote(row.id)}>Rechazar</Button>
    </Space> : null }] : [])
  ];

  const commercialContent = <div className="commercial-workspace">
    <div className="commercial-summary-line">
      <div><Text className="section-kicker">ETAPA COMERCIAL</Text><Title level={4}>{project.commercial_stage === 'approved' ? 'Aprobado por cliente' : project.commercial_stage === 'lost' ? 'Oportunidad perdida' : 'En cotización'}</Title></div>
      <Space wrap>
        {canManage && project.commercial_stage === 'quoting' && <Button icon={<CalendarOutlined />} onClick={() => setMeetingOpen(true)}>Registrar reunión</Button>}
        {isLead && project.commercial_stage !== 'lost' && <Button icon={<FileTextOutlined />} onClick={() => setQuoteOpen(true)}>Nueva cotización</Button>}
        {isLead && project.commercial_stage === 'quoting' && <Button type="primary" onClick={() => setApprovalOpen(true)}>Registrar aprobación cliente</Button>}
        {isLead && project.commercial_stage === 'quoting' && <Button danger type="text" onClick={requestLost}>Marcar perdida</Button>}
      </Space>
    </div>
    {project.commercial_stage === 'quoting' && meetings.length >= 2 && !meetings.some((m) => m.has_pdd || m.has_technical_commercial_proposal) && <Alert showIcon type={meetings.length >= 3 ? 'error' : 'warning'} message={meetings.length >= 3 ? 'Escalación: aún falta el PDD o la propuesta técnico comercial' : 'Después de dos reuniones falta registrar el PDD o la propuesta'} description="Registra el motivo y el próximo compromiso en la reunión siguiente." />}
    <div className="commercial-columns">
      <Card title="Reuniones y compromisos" extra={canManage && project.commercial_stage === 'quoting' ? <Button type="text" icon={<PlusOutlined />} onClick={() => setMeetingOpen(true)}>Agregar</Button> : null}>
        {meetings.length ? <Table size="small" rowKey="id" pagination={false} loading={loading} dataSource={meetings} columns={[
          { title: '#', render: (_: unknown, _row: Row, index: number) => index + 1 },
          { title: 'Fecha', dataIndex: 'meeting_date', render: (v: string) => dayjs(v).format('DD MMM YYYY') },
          { title: 'Resultado', dataIndex: 'summary' },
          { title: 'Siguiente compromiso', dataIndex: 'next_commitment', render: (v: string) => v || 'Pendiente' },
          { title: 'Entregable', render: (_: unknown, r: Row) => r.has_pdd ? 'PDD' : r.has_technical_commercial_proposal ? 'Propuesta' : '—' }
        ]} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Registra la primera reunión para iniciar la trazabilidad" />}
      </Card>
      <Card title="Versiones de cotización" extra={isLead && project.commercial_stage !== 'lost' ? <Button type="text" icon={<PlusOutlined />} onClick={() => setQuoteOpen(true)}>Nueva versión</Button> : null}>
        {quotes.length ? <Table size="small" rowKey="id" pagination={false} loading={loading} dataSource={quotes} columns={quoteColumns} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Aún no hay una cotización registrada" />}
        {isLead && quotes.find((q) => q.status === 'approved') && <div className="commercial-margin-note"><DollarOutlined /> La validación interna de la versión no sustituye la aprobación del cliente. Esta versión fija precio y horas del proyecto.</div>}
      </Card>
    </div>
  </div>;

  const deliveryContent = <div className="commercial-workspace">
      <Card title="Requisitos contractuales" extra={<Text type="secondary">Configurables por proyecto</Text>}>
      <Descriptions column={{ xs: 1, md: 2 }}>
        <Descriptions.Item label="Orden de compra antes de ejecutar"><Switch disabled={!canManage} checked={Boolean(project.require_purchase_order)} onChange={(value) => void save(`${base}/requirements`, { require_purchase_order: value }, 'Requisito actualizado', 'patch')} /></Descriptions.Item>
        <Descriptions.Item label="HES antes de facturar"><Switch disabled={!canManage} checked={Boolean(project.require_service_acceptance)} onChange={(value) => void save(`${base}/requirements`, { require_service_acceptance: value }, 'Requisito actualizado', 'patch')} /></Descriptions.Item>
      </Descriptions>
      <Space wrap>
        {isLead && <Button onClick={() => setDocumentType('pdd')}>Registrar PDD</Button>}
        {isLead && <Button onClick={() => setDocumentType('technical_commercial_proposal')}>Registrar propuesta</Button>}
        {isLead && <Button onClick={() => setDocumentType('purchase_order')}>Registrar OC</Button>}
        {isLead && <Button onClick={() => setDocumentType('service_acceptance')}>Registrar HES</Button>}
        {isLead && <Button onClick={() => setDocumentType('client_approval')}>Registrar evidencia cliente</Button>}
      </Space>
      <Table size="small" rowKey="id" pagination={false} loading={loading} dataSource={documents} columns={[
        { title: 'Documento', dataIndex: 'document_type', render: (v: string) => ({ purchase_order: 'Orden de compra', service_acceptance: 'HES / aceptación de servicio', client_approval: 'Aprobación cliente', pdd: 'PDD', technical_commercial_proposal: 'Propuesta técnico comercial' } as Row)[v] || v },
        { title: 'Referencia', dataIndex: 'reference_number', render: (v: string) => v || '—' },
        { title: 'Archivo', dataIndex: 'original_filename', render: (v: string) => v || 'Sin archivo adjunto' },
        { title: 'Fecha', dataIndex: 'document_date', render: (v: string) => v ? dayjs(v).format('DD MMM YYYY') : '—' },
        { title: 'Notas', dataIndex: 'notes', render: (v: string) => v || '—' }
      ]} />
    </Card>
    <div className="commercial-columns">
      <Card title="Cierre de entrega" extra={project.delivery_accepted_at ? <Tag color="green">Aceptada</Tag> : <Tag>Abierta</Tag>}>
        <Text type="secondary">Registra el OK del cliente y la evidencia antes de dar por terminada la entrega.</Text>
        {!project.delivery_accepted_at && isLead && (hasClientAcceptanceEvidence
          ? <Button style={{ marginTop: 14 }} icon={<CheckCircleOutlined />} onClick={() => void save(`${base}/delivery-acceptance`, {}, 'Entrega aceptada')}>Cerrar entrega con evidencia registrada</Button>
          : <Button style={{ marginTop: 14 }} onClick={() => setDocumentType('client_approval')}>Registrar OK del cliente</Button>)}
        {project.delivery_accepted_at && <p>Entrega aceptada el {dayjs(project.delivery_accepted_at).format('DD MMM YYYY')}</p>}
      </Card>
      <Card title="Cierre financiero" extra={project.financial_closed_at ? <Tag color="green">Cerrado</Tag> : <Tag color="gold">Pendiente</Tag>}>
        <Text type="secondary">Pendiente hasta que la entrega esté aceptada, cada hito esté pagado y no existan facturas con saldo ni documentos obligatorios pendientes.</Text>
        {isLead && project.delivery_accepted_at && !project.financial_closed_at && <Button style={{ marginTop: 14 }} type="primary" onClick={() => modal.confirm({ title: '¿Cerrar las finanzas del proyecto?', content: 'Esta acción registra el cierre financiero y completa el proyecto.', okText: 'Confirmar cierre', cancelText: 'Cancelar', onOk: async () => { await save(`${base}/financial-close`, {}, 'Cierre financiero completado'); } })}>Cerrar finanzas</Button>}
        {project.financial_closed_at && <p>Cierre financiero el {dayjs(project.financial_closed_at).format('DD MMM YYYY')}</p>}
      </Card>
    </div>
  </div>;

  const billingContent = <div className="commercial-workspace">
    <div className="commercial-kpis">
      <Statistic title="Hitos cobrables" value={paymentMilestones.filter((m) => m.status === 'billable').length} />
      <Statistic title="Facturas emitidas" value={invoices.length} />
      <Statistic title="Facturas vencidas" value={invoices.filter((i) => i.status === 'overdue').length} />
      <Statistic title="Hitos pagados" value={paymentMilestones.filter((m) => m.status === 'paid').length} />
    </div>
    <div className="commercial-columns">
      <Card title="Hitos de pago">
        {paymentMilestones.length ? <Table size="small" rowKey="id" pagination={false} dataSource={paymentMilestones} columns={[
          { title: 'Hito', dataIndex: 'name' }, { title: 'Fecha prevista', dataIndex: 'planned_date', render: (v: string) => v ? dayjs(v).format('DD MMM YYYY') : 'Por definir' },
          { title: 'Estado', dataIndex: 'status', render: (v: string) => <Tag color={v === 'paid' ? 'green' : v === 'overdue' ? 'red' : 'blue'}>{v}</Tag> },
          ...(isLead ? [{ title: 'Monto', dataIndex: 'amount', render: (v: number, r: Row) => `${r.currency} ${Number(v).toLocaleString('es-CL')}` }] : [])
        ]} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No hay hitos de pago registrados" />}
      </Card>
      <Card title="Facturas y pagos">
        {invoices.length ? <Table size="small" rowKey="id" pagination={false} dataSource={invoices} columns={[
          { title: 'Factura', dataIndex: 'invoice_number' }, { title: 'Vencimiento', dataIndex: 'due_date', render: (v: string) => dayjs(v).format('DD MMM YYYY') },
          { title: 'Estado', dataIndex: 'status', render: (v: string) => <Tag color={v === 'paid' ? 'green' : v === 'overdue' ? 'red' : 'gold'}>{v}</Tag> },
          ...(isLead ? [{ title: 'Pagos', dataIndex: 'payments', render: (v: Row[]) => v?.length || 0 }] : [])
        ]} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Todavía no hay facturas asociadas" />}
      </Card>
    </div>
  </div>;

  const capacityContent = <div className="commercial-workspace">
    <div className="commercial-kpis"><Statistic title="Personas asignadas" value={capacity.length} prefix={<TeamOutlined />} /><Statistic title="FTE planificado" value={capacity.reduce((sum, row) => sum + Number(row.planned_fte || 0), 0)} precision={2} /></div>
    <Card title="Dedicación y horas presupuestadas">
      <Table size="small" rowKey="user_id" loading={loading} pagination={false} dataSource={capacity} columns={[
        { title: 'Persona', dataIndex: 'full_name' }, { title: 'Rol', dataIndex: 'role' },
        { title: 'Asignación', dataIndex: 'allocation_percentage', render: (v: number) => `${Number(v || 0)}%` },
        { title: 'FTE', dataIndex: 'planned_fte', render: (v: number) => Number(v || 0).toFixed(2) },
        { title: 'Horas presupuestadas', dataIndex: 'budgeted_hours', render: (v: number) => v == null ? 'Por definir' : `${Number(v).toLocaleString('es-CL')} h` },
        { title: 'Horas aprobadas', dataIndex: 'actual_hours', render: (v: number) => `${Number(v || 0).toLocaleString('es-CL')} h` },
        { title: 'Periodo', render: (_: unknown, row: Row) => `${row.start_date || 'Sin inicio'} — ${row.end_date || 'Sin término'}` }
      ]} />
      <Text type="secondary">El FTE representa la dedicación asignada. La planificación de ausencias no está incluida en esta versión.</Text>
    </Card>
  </div>;

  return <>
    <Tabs className="commercial-inner-tabs" defaultActiveKey={initialTab === 'billing' ? 'billing' : 'commercial'} items={[
      { key: 'commercial', label: 'Oportunidad y cotización', children: commercialContent },
      { key: 'delivery', label: 'Contratos y cierre', children: deliveryContent },
      { key: 'capacity', label: 'Equipo y capacidad', children: capacityContent },
      { key: 'billing', label: 'Cobranza', children: billingContent }
    ]} />
    <Modal title="Registrar reunión" open={meetingOpen} footer={null} onCancel={() => setMeetingOpen(false)} destroyOnClose>
      <Form layout="vertical" onFinish={logMeeting} initialValues={{ meeting_date: dayjs() }}>
        <Form.Item label="Fecha" name="meeting_date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} showTime /></Form.Item>
        <Form.Item label="Resultado y necesidades identificadas" name="summary" rules={[{ required: true, message: 'Describe el resultado' }]}><Input.TextArea rows={3} /></Form.Item>
        <Form.Item label="Motivo del seguimiento (desde la segunda reunión)" name="escalation_reason"><Input.TextArea rows={2} placeholder="Información pendiente, decisión o causa de demora" /></Form.Item>
        <Form.Item label="Próximo compromiso (desde la segunda reunión)" name="next_commitment"><Input.TextArea rows={2} placeholder="Responsable y fecha comprometida" /></Form.Item>
        <Form.Item name="has_pdd" valuePropName="checked"><Checkbox>Se obtuvo PDD</Checkbox></Form.Item>
        <Form.Item name="has_technical_commercial_proposal" valuePropName="checked"><Checkbox>Se obtuvo propuesta técnico comercial</Checkbox></Form.Item>
        <Form.Item label="Referencia del PDD o propuesta" name="evidence_reference"><Input placeholder="Archivo, acta o referencia" /></Form.Item>
        <Button type="primary" htmlType="submit" block>Guardar reunión</Button>
      </Form>
    </Modal>
    <Modal title="Nueva versión de cotización" open={quoteOpen} footer={null} onCancel={() => setQuoteOpen(false)} destroyOnClose>
      <Form form={quoteForm} layout="vertical" onFinish={createQuote} initialValues={{ pricing_model: 'fixed', currency: project.currency || 'CLP' }}>
        <Form.Item label="Modelo de precio" name="pricing_model"><Select options={[{ value: 'fixed', label: 'Precio fijo' }, { value: 'hourly', label: 'Por horas' }, { value: 'mixed', label: 'Mixta' }]} /></Form.Item>
        <Space style={{ width: '100%' }} align="start">
          <Form.Item label="Precio de venta" name="amount" rules={[{ required: true }]}><InputNumber min={0} style={{ width: 190 }} /></Form.Item>
          <Form.Item label="Moneda" name="currency"><Select style={{ width: 100 }} options={['CLP', 'UF', 'USD'].map((value) => ({ value }))} /></Form.Item>
        </Space>
        <Space style={{ width: '100%' }} align="start">
        <Form.Item label="Horas estimadas" name="hours"><InputNumber min={0} style={{ width: 190 }} /></Form.Item>
        <Form.Item label="Costo estimado" name="estimated_cost"><InputNumber min={0} style={{ width: 190 }} /></Form.Item>
        </Space>
        {isLead && <Button style={{ marginBottom: 16 }} onClick={() => void estimateQuoteCost()}>Estimar costo según equipo y horas</Button>}
        <Form.Item label="Cambio de alcance asociado" name="scope_change_id"><Select allowClear placeholder="Solo si esta versión cotiza un cambio" options={scopeChanges.filter((change) => change.requires_re_quote && !change.quote_approved && change.status === 'pending').map((change) => ({ value: change.id, label: change.description }))} /></Form.Item>
        <Form.Item label="Notas de versión" name="notes"><Input.TextArea rows={3} /></Form.Item>
        <FileManager entity_type="project" entity_id={project.id} title="Adjuntar propuesta" association_type={`quote_v${quotes.length + 1}`} showUploadTab multiple={false} maxFiles={1} />
        <Button type="primary" htmlType="submit" block>Guardar versión</Button>
      </Form>
    </Modal>
    <Modal title="Registrar evidencia de aprobación del cliente" open={approvalOpen} footer={null} onCancel={() => setApprovalOpen(false)} destroyOnClose>
      <Form layout="vertical" onFinish={async (values) => { const done = await save(`${base}/client-approval`, values, 'Aprobación del cliente registrada'); if (done) setApprovalOpen(false); }}>
        <Form.Item label="Referencia de aprobación" name="approval_reference" rules={[{ required: true, message: 'Ingresa un correo, acta o referencia' }]}><Input placeholder="Correo del cliente, acta o número de aprobación" /></Form.Item>
        <Form.Item label="Notas" name="approval_notes"><Input.TextArea rows={3} /></Form.Item>
        <Button type="primary" htmlType="submit" block>Confirmar aprobación</Button>
      </Form>
    </Modal>
    <Modal title="Aprobación del cliente para el cambio de alcance" open={scopeQuoteId !== null} footer={null} onCancel={() => setScopeQuoteId(null)} destroyOnClose>
      <Form layout="vertical" onFinish={async (values) => { const done = await save(`/commercial/quotes/${scopeQuoteId}/approve`, values, 'Cotización del cambio aprobada'); if (done) setScopeQuoteId(null); }}>
        <Form.Item label="Referencia de aprobación del cliente" name="approval_reference" rules={[{ required: true }]}><Input placeholder="Correo, acta o aprobación registrada" /></Form.Item>
        <Form.Item label="Notas" name="approval_notes"><Input.TextArea rows={3} /></Form.Item>
        <Button type="primary" htmlType="submit" block>Confirmar y aprobar versión</Button>
      </Form>
    </Modal>
    <Modal title="Registrar documento" open={Boolean(documentType)} footer={null} onCancel={() => setDocumentType(null)} destroyOnClose>
      <Form layout="vertical" onFinish={recordDocument}>
        <Form.Item label="Tipo" required><Input disabled value={({ purchase_order: 'Orden de compra', service_acceptance: 'HES / aceptación de servicio', client_approval: 'Aprobación cliente', pdd: 'PDD', technical_commercial_proposal: 'Propuesta técnico comercial' } as Row)[documentType || ''] || documentType || ''} /></Form.Item>
        <Form.Item label="Número o referencia" name="reference_number"><Input placeholder="Número OC/HES o referencia del correo" /></Form.Item>
        <Form.Item label="Fecha del documento" name="document_date"><DatePicker style={{ width: '100%' }} /></Form.Item>
        <Form.Item label="Evidencia / notas" name="notes" rules={[{ required: true, message: 'Describe la evidencia registrada' }]}><Input.TextArea rows={3} /></Form.Item>
        <FileManager entity_type="project" entity_id={project.id} title="Adjuntar evidencia" association_type={documentType || 'commercial_evidence'} showUploadTab multiple={false} maxFiles={1} />
        <Button type="primary" htmlType="submit" block>Guardar documento</Button>
      </Form>
    </Modal>
  </>;
};
