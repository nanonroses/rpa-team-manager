import React, { useEffect, useState } from 'react';
import { Modal, Steps, Form, Input, Select, DatePicker, InputNumber, Alert, Upload, Button, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { Project } from '@/types/project';
import { apiService } from '@/services/api';

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

interface CreateProjectWizardProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess?: (project: Project) => void;
}

export const CreateProjectWizard: React.FC<CreateProjectWizardProps> = ({ visible, onCancel, onSuccess: _onSuccess }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [basicForm] = Form.useForm();
  const [quoteForm] = Form.useForm();
  const [clients, setClients] = useState<any[]>([]);
  const [salesReps, setSalesReps] = useState<any[]>([]);
  const [businessAreas, setBusinessAreas] = useState<any[]>([]);
  const [quoteData, setQuoteData] = useState<QuoteStepData | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setCurrentStep(0);
    basicForm.resetFields();
    quoteForm.resetFields();
    setQuoteData(null);
    void loadDirectories();
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

  const goNextFromBasics = async () => {
    await basicForm.validateFields();
    setCurrentStep(1);
  };

  const goNextFromQuote = async () => {
    const values = await quoteForm.validateFields();
    setQuoteData({ ...(quoteData || {}), ...values, file_id: quoteData?.file_id });
    setCurrentStep(2);
  };

  const readWithAi = async (file: File) => {
    setAiLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiService.request<any>({ url: '/projects/upload-quote', method: 'POST', data: formData, headers: { 'Content-Type': 'multipart/form-data' } });
      const extracted = response?.quote_data || {};
      quoteForm.setFieldsValue({
        amount: extracted.expected_revenue ?? undefined,
        estimated_cost: extracted.budgeted_cost ?? undefined,
        currency: 'CLP',
        pricing_model: 'fixed'
      });
      setQuoteData((prev) => ({ ...(prev || { pricing_model: 'fixed', currency: 'CLP' }), file_id: response?.file_id }));
      message.success('Datos de la cotización precargados. Revísalos antes de continuar.');
    } catch (error) {
      message.error('No se pudo leer el archivo con IA. Completa los datos manualmente.');
    } finally {
      setAiLoading(false);
    }
    return false;
  };

  return (
    <Modal title="Nuevo proyecto" open={visible} onCancel={onCancel} footer={null} width={720} destroyOnHidden>
      <Steps
        current={currentStep}
        items={[
          { title: 'Datos básicos' },
          { title: 'Cotización' },
          { title: 'Equipo' },
          { title: 'Resumen financiero' },
          { title: 'Hitos de pago' }
        ]}
        style={{ marginBottom: 24 }}
      />

      <Form form={basicForm} layout="vertical" style={{ display: currentStep === 0 ? 'block' : 'none' }} initialValues={{ opportunity_source: 'direct', priority: 'medium' }}>
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

      <Form form={quoteForm} layout="vertical" style={{ display: currentStep === 1 ? 'block' : 'none' }} initialValues={{ pricing_model: 'fixed', currency: 'CLP' }}>
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
          <Button onClick={() => setCurrentStep(0)}>Atrás</Button>
          <Button type="primary" onClick={goNextFromQuote}>Siguiente</Button>
        </div>
      </Form>
    </Modal>
  );
};
