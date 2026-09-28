import React, { useEffect, useState } from 'react';
import { Alert, App, Button, Card, Form, Input, InputNumber, Modal, Select, Space } from 'antd';
import { apiService } from '@/services/api';

interface Props {
  projectId: number;
  responsibleId?: number;
  onClose: () => void;
  onSaved: () => void;
}

export const ProjectTeamEditor: React.FC<Props> = ({ projectId, responsibleId, onClose, onSaved }) => {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [users, setUsers] = useState<Awaited<ReturnType<typeof apiService.getUsers>>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const assignments = Form.useWatch('user_assignments', form) || [];

  useEffect(() => {
    let active = true;
    Promise.all([apiService.getUsers(), apiService.request({ url: `/projects/${projectId}/assignments` })])
      .then(([people, response]) => {
        if (!active) return;
        const existing = Array.isArray(response) ? response : response?.data || [];
        const rows = existing.length ? existing : responsibleId ? [{ user_id: responsibleId, role: 'lead', allocation_percentage: 100 }] : [];
        setUsers(people.filter(person => person.is_active !== false && Number(person.is_active) !== 0));
        form.setFieldsValue({ user_assignments: rows, responsible_user_id: responsibleId ?? rows.find((row: any) => row.role === 'lead')?.user_id });
      }).catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectId, responsibleId, form]);

  const save = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await apiService.post(`/projects/${projectId}/assignments`, values);
      message.success('Equipo y responsable actualizados');
      onSaved();
    } catch (error: any) {
      if (!error.errorFields) message.error(error?.response?.data?.error || 'No se pudo guardar el equipo');
    } finally { setSaving(false); }
  };

  return <Modal open title="Editar equipo de ejecución" width={720} onCancel={onClose}
    okText="Guardar equipo" cancelText="Cancelar" onOk={() => void save()} confirmLoading={saving}
    okButtonProps={{ disabled: loading || failed }}>
    {failed ? <Alert type="error" message="No se pudo cargar el equipo. Cierra esta ventana y vuelve a intentarlo." /> :
    <Form form={form} layout="vertical" disabled={loading || saving}>
      <Alert type="info" showIcon style={{ marginBottom: 16 }} message="El responsable de ejecución aparecerá en el resumen del proyecto y puede ser distinto de quien realizó la cotización." />
      <Form.List name="user_assignments" rules={[{ validator: async (_, rows) => {
        if (!rows?.length) throw new Error('Agrega al menos una persona al equipo');
        if (new Set(rows.map((row: any) => row.user_id)).size !== rows.length) throw new Error('No repitas personas en el equipo');
      } }]}>
        {(fields, { add, remove }, { errors }) => <>
          {fields.map(field => <Card key={field.key} size="small" style={{ marginBottom: 12 }} extra={<Button danger type="text" onClick={() => remove(field.name)}>Quitar persona</Button>}>
            <Form.Item name={[field.name, 'user_id']} label="Persona" rules={[{ required: true, message: 'Selecciona una persona' }]}>
              <Select showSearch optionFilterProp="label" options={users.map(person => ({ value: person.id, label: person.full_name }))} />
            </Form.Item>
            <Form.Item name={[field.name, 'role']} label="Rol" rules={[{ required: true }]}><Select options={[
              { value: 'lead', label: 'Líder de ejecución' }, { value: 'contributor', label: 'Desarrollo' },
              { value: 'reviewer', label: 'Revisión' }, { value: 'observer', label: 'Observación' }
            ]} /></Form.Item>
            <Space wrap align="start">
              <Form.Item name={[field.name, 'allocation_percentage']} label="Dedicación (%)" rules={[{ required: true }]}><InputNumber min={0} max={100} precision={0} /></Form.Item>
              <Form.Item name={[field.name, 'budgeted_hours']} label="Horas presupuestadas"><InputNumber min={0} /></Form.Item>
              <Form.Item name={[field.name, 'start_date']} label="Inicio" normalize={value => value || null}><Input type="date" /></Form.Item>
              <Form.Item name={[field.name, 'end_date']} label="Término" normalize={value => value || null}><Input type="date" /></Form.Item>
            </Space>
          </Card>)}
          <Form.ErrorList errors={errors} />
          <Button onClick={() => add({ role: 'contributor', allocation_percentage: 100 })} style={{ marginBottom: 16 }}>Agregar persona</Button>
        </>}
      </Form.List>
      <Form.Item name="responsible_user_id" label="Responsable de ejecución" dependencies={['user_assignments']} rules={[
        { required: true, message: 'Selecciona al responsable del proyecto' },
        { validator: async (_, value) => { if (value && !form.getFieldValue('user_assignments')?.some((row: any) => row.user_id === value)) throw new Error('El responsable debe pertenecer al equipo'); } }
      ]}><Select options={users.filter(person => assignments.some((row: any) => row?.user_id === person.id)).map(person => ({ value: person.id, label: person.full_name }))} /></Form.Item>
    </Form>}
  </Modal>;
};
