import React, { useEffect, useState } from 'react';
import { Modal, Steps, Form, Input, Select, DatePicker, InputNumber, Alert, Upload, Button, message, Space, Table, Statistic } from 'antd';
import { UploadOutlined, PlusOutlined } from '@ant-design/icons';
import { Project } from '@/types/project';
import { apiService } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { useProjectStore } from '@/store/projectStore';
import { buildUserAssignments } from './projectAssignments';

const { TextArea } = Input;
const { RangePicker } = DatePicker;

export interface QuoteStepData {
  pricing_model: 'fixed' | 'hourly' | 'mixed';
  amount?: number;
  currency: 'CLP' | 'UF' | 'USD';
  hours?: number;
  hourly_rate?: number;
  estimated_cost?: number;
  notes?: string;
  file_id?: number;
}

interface MilestoneRow {
  key: number;
  name: string;
  amount: number;
  currency: 'CLP' | 'UF' | 'USD';
  planned_date: string;
}

interface CreateProjectWizardProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess?: (project: Project) => void;
}

export const CreateProjectWizard: React.FC<CreateProjectWizardProps> = ({ visible, onCancel, onSuccess }) => {
  const { user } = useAuthStore();
  const { createProject } = useProjectStore();
  const isOperations = user?.role === 'rpa_operations';
  const stepKeys = isOperations ? ['basics', 'quote', 'team', 'milestones'] : ['basics', 'quote', 'team', 'summary', 'milestones'];
  const stepTitles: Record<string, string> = { basics: 'Datos básicos', quote: 'Cotización', team: 'Equipo', summary: 'Resumen financiero', milestones: 'Hitos de pago' };

  const [currentKey, setCurrentKey] = useState('basics');
  const [basicForm] = Form.useForm();
  const [quoteForm] = Form.useForm();
  const [teamForm] = Form.useForm();
  const [milestoneForm] = Form.useForm();
  const [clients, setClients] = useState<any[]>([]);
  const [salesReps, setSalesReps] = useState<any[]>([]);
  const [businessAreas, setBusinessAreas] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<{ label: string; value: number; role?: string }[]>([]);
  const [quoteData, setQuoteData] = useState<QuoteStepData | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdProject, setCreatedProject] = useState<Project | null>(null);
  const [costEstimate, setCostEstimate] = useState<any>(null);
  const [milestoneRows, setMilestoneRows] = useState<MilestoneRow[]>([]);

  useEffect(() => {
    if (!visible) return;
    setCurrentKey('basics');
    basicForm.resetFields();
    quoteForm.resetFields();
    teamForm.resetFields();
    setQuoteData(null);
    setCreatedProject(null);
    setCostEstimate(null);
    setMilestoneRows([]);
    void loadDirectories();
    void loadTeamMembers();
  }, [visible]);

  const loadDirectories = async () => {
    try {
      const [clientResponse, salesResponse, areaResponse] = await Promise.all([
        apiService.request<any>({ url: '/clients' }),
        apiService.request<any>({ url: '/sales-reps' }),
        apiService.request<any>({ url: '/business-areas' })
      ]);
      setClients(clientResponse?.data || []);
      setSalesReps(salesResponse?.data || []);
      setBusinessAreas(areaResponse?.data || []);
    } catch (error) {
      console.warn('No se pudieron cargar clientes, comerciales o areas:', error);
    }
  };

  const loadTeamMembers = async () => {
    try {
      const users = await apiService.getUsers();
      setTeamMembers(users.map((u: any) => ({ label: u.full_name, value: u.id, role: u.role })));
    } catch (error) {
      console.error('No se pudieron cargar los usuarios:', error);
    }
  };

  const goNextFromBasics = async () => {
    await basicForm.validateFields();
    setCurrentKey('quote');
  };

  const goNextFromQuote = async () => {
    const values = await quoteForm.validateFields();
    setQuoteData((prev) => ({ ...(prev || { pricing_model: 'fixed', currency: 'CLP' }), ...values }));
    setCurrentKey('team');
  };

  const readWithAi = async (file: File) => {
    setAiLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiService.request<any>({ url: '/projects/upload-quote', method: 'POST', data: formData, headers: { 'Content-Type': 'multipart/form-data' } });
      const extracted = response?.quote_data || {};
      quoteForm.setFieldsValue({ amount: extracted.expected_revenue ?? undefined, estimated_cost: extracted.budgeted_cost ?? undefined, currency: 'CLP', pricing_model: 'fixed' });
      setQuoteData((prev) => ({ ...(prev || { pricing_model: 'fixed', currency: 'CLP' }), file_id: response?.file_id }));
      message.success('Datos de la cotización precargados. Revísalos antes de continuar.');
    } catch (error) {
      message.error('No se pudo leer el archivo con IA. Completa los datos manualmente.');
    } finally {
      setAiLoading(false);
    }
    return false;
  };

  const finalizeCreation = async () => {
    setCreating(true);
    try {
      const basics = basicForm.getFieldsValue();
      const team = isOperations ? {} : teamForm.getFieldsValue();

      const projectData = {
        name: basics.name,
        description: basics.description,
        status: 'on_hold' as const,
        priority: basics.priority,
        budget: basics.budget,
        start_date: basics.dates?.[0]?.format('YYYY-MM-DD'),
        end_date: basics.dates?.[1]?.format('YYYY-MM-DD'),
        client_id: basics.client_id,
        client_contact_id: basics.client_contact_id,
        sales_rep_id: basics.sales_rep_id,
        area_id: basics.area_id,
        opportunity_source: basics.opportunity_source || 'direct',
        assigned_to: isOperations ? undefined : team.assigned_users?.[0]
      };
      const project = await createProject(projectData);
      setCreatedProject(project);
      message.success('Proyecto creado. Puedes seguir completando los datos comerciales o cerrar esta ventana.');

      if (quoteData?.amount !== undefined) {
        try {
          await apiService.post(`/commercial/projects/${project.id}/quotes`, quoteData);
        } catch (error) {
          message.warning('Proyecto creado, pero no se pudo registrar la cotización. Puedes intentarlo desde la ficha del proyecto.');
        }
      }

      if (!isOperations && team.assigned_users?.length) {
        try {
          const userAssignments = buildUserAssignments(team.assigned_users, team.default_allocation, team.budgeted_hours_per_person, basics.dates?.[0]?.format('YYYY-MM-DD'), basics.dates?.[1]?.format('YYYY-MM-DD'));
          await apiService.post(`/projects/${project.id}/assignments`, { user_assignments: userAssignments });
        } catch (error) {
          message.warning('Proyecto creado, pero no se pudieron guardar las asignaciones del equipo.');
        }
      }

      if (!isOperations) {
        const totalHours = quoteData?.hours || (team.budgeted_hours_per_person && team.assigned_users?.length ? team.budgeted_hours_per_person * team.assigned_users.length : 0);
        if (totalHours > 0) {
          try {
            const estimate = await apiService.request<any>({ url: `/commercial/projects/${project.id}/quote-cost-estimate`, method: 'GET', params: { hours: totalHours, currency: quoteData?.currency || 'CLP' } });
            setCostEstimate(estimate);
          } catch (error) {
            setCostEstimate(null);
            message.warning('Proyecto creado, pero no se pudo estimar el costo del equipo. Puedes revisarlo después desde la ficha del proyecto.');
          }
        }
        setCurrentKey('summary');
      } else {
        setCurrentKey('milestones');
      }
    } catch (error: any) {
      message.error(error?.message || 'No se pudo crear el proyecto');
    } finally {
      setCreating(false);
    }
  };

  const addMilestoneRow = async () => {
    const values = await milestoneForm.validateFields();
    setMilestoneRows((rows) => [...rows, { ...values, key: Date.now(), planned_date: values.planned_date.format('YYYY-MM-DD') }]);
    milestoneForm.resetFields();
  };

  const finish = async () => {
    if (createdProject && milestoneRows.length) {
      for (const row of milestoneRows) {
        try {
          await apiService.post('/billing/payment-milestones', { project_id: createdProject.id, name: row.name, amount: row.amount, currency: row.currency, trigger_type: 'date', planned_date: row.planned_date });
        } catch (error) {
          message.warning(`No se pudo guardar el hito "${row.name}"`);
        }
      }
    }
    if (createdProject) onSuccess?.(createdProject);
    onCancel();
  };

  const handleCancel = () => {
    if (createdProject) onSuccess?.(createdProject);
    onCancel();
  };

  return (
    <Modal title="Nuevo proyecto" open={visible} onCancel={handleCancel} footer={null} width={720} destroyOnHidden>
      <Steps current={stepKeys.indexOf(currentKey)} items={stepKeys.map((key) => ({ title: stepTitles[key] }))} style={{ marginBottom: 24 }} />

      <Form form={basicForm} layout="vertical" style={{ display: currentKey === 'basics' ? 'block' : 'none' }} initialValues={{ opportunity_source: 'direct', priority: 'medium' }}>
        <Form.Item name="opportunity_source" label="Origen de la oportunidad"><Select options={[{ value: 'direct', label: 'Contacto directo con el equipo' }, { value: 'sales', label: 'Traída por un comercial' }]} /></Form.Item>
        <Form.Item name="client_id" label="Cliente"><Select allowClear showSearch optionFilterProp="label" placeholder="Selecciona el cliente" options={clients.map((client) => ({ value: client.id, label: client.name }))} /></Form.Item>
        <Form.Item noStyle shouldUpdate={(previous, current) => previous.client_id !== current.client_id}>
          {({ getFieldValue }) => {
            const client = clients.find((c) => c.id === getFieldValue('client_id'));
            return <Form.Item name="client_contact_id" label="Contacto del cliente"><Select allowClear showSearch optionFilterProp="label" placeholder="Contacto principal u otro contacto" options={(client?.contacts || []).map((contact: any) => ({ value: contact.id, label: `${contact.name}${contact.is_primary ? ' · Principal' : ''}` }))} /></Form.Item>;
          }}
        </Form.Item>
        <Form.Item name="sales_rep_id" label="Comercial responsable"><Select allowClear showSearch optionFilterProp="label" placeholder="Origen directo o comercial" options={salesReps.map((rep) => ({ value: rep.id, label: rep.name }))} /></Form.Item>
        <Form.Item name="area_id" label="Área de negocio"><Select allowClear showSearch optionFilterProp="label" placeholder="Selecciona el área" options={businessAreas.map((area) => ({ value: area.id, label: area.name }))} /></Form.Item>
        <Form.Item name="name" label="Nombre del proyecto" rules={[{ required: true, message: 'Ingresa el nombre del proyecto' }, { min: 3, message: 'El nombre debe tener al menos 3 caracteres' }]}>
          <Input placeholder="Ingresa el nombre del proyecto" />
        </Form.Item>
        <Form.Item name="description" label="Descripción" rules={[{ max: 500 }]}><TextArea rows={3} showCount maxLength={500} /></Form.Item>
        <Form.Item name="priority" label="Prioridad" rules={[{ required: true }]}>
          <Select options={[{ label: 'Crítica', value: 'critical' }, { label: 'Alta', value: 'high' }, { label: 'Media', value: 'medium' }, { label: 'Baja', value: 'low' }]} />
        </Form.Item>
        <Form.Item name="budget" label="Presupuesto inicial (CLP)" rules={[{ type: 'number', min: 0 }]}><InputNumber style={{ width: '100%' }} precision={2} /></Form.Item>
        <Form.Item name="dates" label="Fechas del proyecto"><RangePicker style={{ width: '100%' }} format="YYYY-MM-DD" /></Form.Item>
        <div style={{ textAlign: 'right' }}><Button type="primary" onClick={goNextFromBasics}>Siguiente</Button></div>
      </Form>

      <Form form={quoteForm} layout="vertical" style={{ display: currentKey === 'quote' ? 'block' : 'none' }} initialValues={{ pricing_model: 'fixed', currency: 'CLP' }}>
        <Alert type="info" showIcon message="La oportunidad se crea en cotización. Esta versión fija el precio y las horas del proyecto una vez que la jefatura la valide." style={{ marginBottom: 16 }} />
        <Upload beforeUpload={readWithAi} showUploadList={false} accept=".pdf,.docx">
          <Button icon={<UploadOutlined />} loading={aiLoading}>Leer cotización con IA</Button>
        </Upload>
        <Form.Item name="pricing_model" label="Modelo de precio" style={{ marginTop: 16 }}>
          <Select options={[{ value: 'fixed', label: 'Precio cerrado' }, { value: 'hourly', label: 'Por horas' }, { value: 'mixed', label: 'Mixto' }]} />
        </Form.Item>
        <Form.Item name="amount" label="Monto de la cotización" rules={[{ required: true, message: 'Ingresa el monto' }]}><InputNumber style={{ width: '100%' }} min={0} precision={2} /></Form.Item>
        <Form.Item name="currency" label="Moneda"><Select options={[{ value: 'CLP', label: 'CLP' }, { value: 'UF', label: 'UF' }, { value: 'USD', label: 'USD' }]} /></Form.Item>
        <Form.Item noStyle shouldUpdate={(previous, current) => previous.pricing_model !== current.pricing_model}>
          {({ getFieldValue }) => getFieldValue('pricing_model') !== 'fixed' && <>
            <Form.Item name="hours" label="Horas cotizadas" rules={[{ required: true, message: 'Ingresa las horas' }]}><InputNumber style={{ width: '100%' }} min={0} precision={1} /></Form.Item>
            <Form.Item name="hourly_rate" label="Tarifa por hora"><InputNumber style={{ width: '100%' }} min={0} precision={2} /></Form.Item>
          </>}
        </Form.Item>
        <Form.Item name="estimated_cost" label="Costo interno estimado (opcional)"><InputNumber style={{ width: '100%' }} min={0} precision={2} /></Form.Item>
        <Form.Item name="notes" label="Notas"><TextArea rows={2} /></Form.Item>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={() => setCurrentKey('basics')}>Atrás</Button>
          <Button type="primary" onClick={goNextFromQuote}>Siguiente</Button>
        </div>
      </Form>

      <div style={{ display: currentKey === 'team' ? 'block' : 'none' }}>
        {isOperations ? (
          <Alert type="info" showIcon message="Quedarás asignado a este proyecto como responsable de operaciones." style={{ marginBottom: 24 }} />
        ) : (
          <>
            <Alert
              type="info"
              showIcon
              message="Al continuar se creará el proyecto con su tablero Kanban y sus fases del ciclo de vida."
              style={{ marginBottom: 16 }}
            />
            <Form form={teamForm} layout="vertical">
              <Form.Item name="assigned_users" label="Equipo asignado">
                <Select mode="multiple" allowClear maxTagCount="responsive" optionFilterProp="label" placeholder="Selecciona personas del equipo" options={teamMembers.map((member) => ({ ...member, label: `${member.label} (${member.role})` }))} />
              </Form.Item>
              <Form.Item name="default_allocation" label="Dedicación por persona (%)"><InputNumber min={1} max={100} style={{ width: '100%' }} /></Form.Item>
              <Form.Item name="budgeted_hours_per_person" label="Horas presupuestadas por persona"><InputNumber min={0} precision={1} style={{ width: '100%' }} /></Form.Item>
            </Form>
          </>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
          <Button onClick={() => setCurrentKey('quote')}>Atrás</Button>
          <Button type="primary" loading={creating} onClick={finalizeCreation}>
            {createdProject ? 'Siguiente' : 'Crear proyecto y continuar'}
          </Button>
        </div>
      </div>

      {!isOperations && (
        <div style={{ display: currentKey === 'summary' ? 'block' : 'none' }}>
          {costEstimate ? (
            <Space size="large" style={{ marginBottom: 24 }}>
              <Statistic title="Costo estimado del equipo" value={costEstimate.estimated_cost} precision={0} suffix={costEstimate.currency} />
              <Statistic title="Venta cotizada" value={quoteData?.amount || 0} precision={0} suffix={quoteData?.currency} />
            </Space>
          ) : (
            <Alert type="info" showIcon message="Aún no hay horas de equipo suficientes para estimar el costo. Puedes revisarlo después desde la ficha del proyecto." style={{ marginBottom: 24 }} />
          )}
          <div style={{ textAlign: 'right' }}><Button type="primary" onClick={() => setCurrentKey('milestones')}>Siguiente</Button></div>
        </div>
      )}

      <div style={{ display: currentKey === 'milestones' ? 'block' : 'none' }}>
        {isOperations ? (
          <Alert type="info" showIcon message="Solo el líder de equipo puede cargar hitos de pago. Se pueden completar después desde la ficha del proyecto." />
        ) : (
          <>
            <Form form={milestoneForm} layout="inline" style={{ marginBottom: 16 }}>
              <Form.Item name="name" rules={[{ required: true, message: 'Nombre' }]}><Input placeholder="Nombre del hito" /></Form.Item>
              <Form.Item name="amount" rules={[{ required: true, message: 'Monto' }]}><InputNumber placeholder="Monto" min={0} /></Form.Item>
              <Form.Item name="currency" initialValue="CLP"><Select style={{ width: 90 }} options={[{ value: 'CLP', label: 'CLP' }, { value: 'UF', label: 'UF' }, { value: 'USD', label: 'USD' }]} /></Form.Item>
              <Form.Item name="planned_date" rules={[{ required: true, message: 'Fecha' }]}><DatePicker placeholder="Fecha prevista" /></Form.Item>
              <Form.Item><Button icon={<PlusOutlined />} onClick={addMilestoneRow}>Agregar hito</Button></Form.Item>
            </Form>
            <Table size="small" pagination={false} dataSource={milestoneRows} rowKey="key" columns={[{ title: 'Hito', dataIndex: 'name' }, { title: 'Monto', dataIndex: 'amount' }, { title: 'Moneda', dataIndex: 'currency' }, { title: 'Fecha', dataIndex: 'planned_date' }]} />
          </>
        )}
        <div style={{ textAlign: 'right', marginTop: 16 }}><Button type="primary" onClick={finish}>Finalizar</Button></div>
      </div>
    </Modal>
  );
};
