import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Checkbox, Form, Input, Modal, Space, Table, Tabs, Tag, Typography, App } from 'antd';
import { ApartmentOutlined, PlusOutlined, UserAddOutlined } from '@ant-design/icons';
import { apiService } from '@/services/api';
import { EmptyState, ErrorState, LoadingState } from '@/components/common';

const { Title, Text } = Typography;
type Row = Record<string, any>;

export const ClientsPage: React.FC = () => {
  const { message, modal } = App.useApp();
  const [clients, setClients] = useState<Row[]>([]);
  const [salesReps, setSalesReps] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [clientModal, setClientModal] = useState(false);
  const [contactClient, setContactClient] = useState<Row | null>(null);
  const [salesModal, setSalesModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [clientResponse, salesResponse] = await Promise.all([
        apiService.get<any>('/clients'), apiService.get<any>('/sales-reps')
      ]);
      setClients(clientResponse?.data || []);
      setSalesReps(salesResponse?.data || []);
    } catch (error: any) {
      setLoadError(error?.response?.data?.error || 'No se pudieron cargar los clientes y comerciales.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const submitClient = async (values: Row) => {
    try {
      await apiService.post('/clients', values);
      message.success('Cliente registrado'); setClientModal(false); await load(); return true;
    } catch (error: any) { message.error(error?.response?.data?.error || 'No se pudo guardar el cliente'); return false; }
  };

  const submitContact = async (values: Row) => {
    if (!contactClient) return;
    try {
      await apiService.post(`/clients/${contactClient.id}/contacts`, values);
      message.success('Contacto agregado'); setContactClient(null); await load();
    } catch (error: any) { message.error(error?.response?.data?.error || 'No se pudo guardar el contacto'); }
  };

  const submitSalesRep = async (values: Row) => {
    try {
      await apiService.post('/sales-reps', values);
      message.success('Comercial registrado'); setSalesModal(false); await load();
    } catch (error: any) { message.error(error?.response?.data?.error || 'No se pudo guardar el comercial'); }
  };

  const deactivate = (kind: 'client' | 'sales', row: Row) => modal.confirm({
    title: kind === 'client' ? 'Desactivar cliente' : 'Desactivar comercial',
    content: 'El registro se conservará en los proyectos e historial existentes.',
    okText: 'Desactivar', cancelText: 'Cancelar',
    onOk: async () => {
      try {
        await apiService.request({ url: kind === 'client' ? `/clients/${row.id}` : `/sales-reps/${row.id}`, method: 'PATCH', data: { is_active: false } });
        message.success('Registro desactivado'); await load();
      } catch (error: any) { message.error(error?.response?.data?.error || 'No se pudo desactivar'); }
    }
  });

  const clientColumns: any[] = [
    { title: 'Cliente', dataIndex: 'name', render: (v: string, row: Row) => <div><Text strong>{v}</Text><br /><Text type="secondary">{row.tax_id || 'Sin RUT'}</Text></div> },
    { title: 'Contactos', dataIndex: 'contacts', render: (rows: Row[]) => rows?.length ? <Space direction="vertical" size={0}>{rows.map((contact) => <Text key={contact.id}>{contact.name}{contact.is_primary ? <Tag color="green" style={{ marginLeft: 6 }}>Principal</Tag> : ''}</Text>)}</Space> : <Text type="secondary">Sin contactos</Text> },
    { title: 'Correo', dataIndex: 'email', render: (v: string) => v || '—' },
    { title: 'Teléfono', dataIndex: 'phone', render: (v: string) => v || '—' },
    { title: 'Acciones', key: 'actions', render: (_: unknown, row: Row) => <Space><Button size="small" icon={<UserAddOutlined />} onClick={() => setContactClient(row)}>Agregar contacto</Button><Button size="small" danger type="text" onClick={() => deactivate('client', row)}>Desactivar</Button></Space> }
  ];

  const salesColumns: any[] = [
    { title: 'Comercial', dataIndex: 'name', render: (v: string) => <Text strong>{v}</Text> },
    { title: 'Correo', dataIndex: 'email', render: (v: string) => v || '—' },
    { title: 'Acciones', key: 'actions', render: (_: unknown, row: Row) => <Button size="small" danger type="text" onClick={() => deactivate('sales', row)}>Desactivar</Button> }
  ];

  if (loadError) {
    return <main className="clients-page"><ErrorState title="No se pudieron cargar los datos comerciales" description={loadError} onRetry={() => void load()} /></main>;
  }

  return <main className="clients-page">
    <div className="clients-page-heading"><div><Text className="section-kicker">CICLO COMERCIAL</Text><Title level={2}>Clientes y comerciales</Title><Text type="secondary">Mantén contactos y responsables comerciales disponibles para cada oportunidad.</Text></div><Button type="primary" icon={<PlusOutlined />} onClick={() => setClientModal(true)}>Nuevo cliente</Button></div>
    <Tabs items={[
      { key: 'clients', label: <span><ApartmentOutlined /> Clientes</span>, children: <Card>{loading && clients.length === 0 ? <LoadingState tip="Cargando clientes…" minHeight={130} /> : clients.length ? <Table rowKey="id" loading={loading} columns={clientColumns} dataSource={clients} pagination={{ pageSize: 10 }} /> : <EmptyState description="Todavía no hay clientes registrados" action={<Button type="primary" onClick={() => setClientModal(true)}>Crear primer cliente</Button>} />}</Card> },
      { key: 'sales', label: 'Comerciales', children: <Card title="Responsables de oportunidades" extra={<Button icon={<PlusOutlined />} onClick={() => setSalesModal(true)}>Agregar comercial</Button>}>{loading && salesReps.length === 0 ? <LoadingState tip="Cargando comerciales…" minHeight={130} /> : salesReps.length ? <Table rowKey="id" loading={loading} columns={salesColumns} dataSource={salesReps} pagination={{ pageSize: 10 }} /> : <EmptyState description="Registra a las personas comerciales que generan oportunidades" action={<Button onClick={() => setSalesModal(true)}>Agregar comercial</Button>} />}</Card> }
    ]} />
    <Modal title="Nuevo cliente" open={clientModal} footer={null} onCancel={() => setClientModal(false)} destroyOnClose>
      <Form layout="vertical" onFinish={submitClient}>
        <Form.Item label="Razón social o nombre" name="name" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item label="RUT" name="tax_id"><Input /></Form.Item>
        <Form.Item label="Correo general" name="email"><Input type="email" /></Form.Item>
        <Form.Item label="Teléfono" name="phone"><Input /></Form.Item>
        <Form.Item label="Dirección" name="address"><Input /></Form.Item>
        <Title level={5}>Contacto principal (opcional)</Title>
        <Form.Item label="Nombre" name={['contact', 'name']}><Input /></Form.Item>
        <Form.Item label="Cargo" name={['contact', 'position']}><Input /></Form.Item>
        <Form.Item label="Correo" name={['contact', 'email']}><Input type="email" /></Form.Item>
        <Form.Item label="Teléfono" name={['contact', 'phone']}><Input /></Form.Item>
        <Button type="primary" htmlType="submit" block>Guardar cliente</Button>
      </Form>
    </Modal>
    <Modal title={`Agregar contacto · ${contactClient?.name || ''}`} open={Boolean(contactClient)} footer={null} onCancel={() => setContactClient(null)} destroyOnClose>
      <Form layout="vertical" onFinish={submitContact}>
        <Form.Item label="Nombre" name="name" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item label="Cargo" name="position"><Input /></Form.Item>
        <Form.Item label="Correo" name="email"><Input type="email" /></Form.Item>
        <Form.Item label="Teléfono" name="phone"><Input /></Form.Item>
        <Form.Item name="is_primary" valuePropName="checked"><Checkbox>Marcar como contacto principal</Checkbox></Form.Item>
        <Button type="primary" htmlType="submit" block>Guardar contacto</Button>
      </Form>
    </Modal>
    <Modal title="Agregar comercial" open={salesModal} footer={null} onCancel={() => setSalesModal(false)} destroyOnClose>
      <Form layout="vertical" onFinish={submitSalesRep}>
        <Form.Item label="Nombre" name="name" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item label="Correo" name="email"><Input type="email" /></Form.Item>
        <Button type="primary" htmlType="submit" block>Guardar comercial</Button>
      </Form>
    </Modal>
  </main>;
};
