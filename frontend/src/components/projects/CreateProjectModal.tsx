import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, DatePicker, InputNumber, Alert, message } from 'antd';
import { Project } from '@/types/project';
import { useProjectStore } from '@/store/projectStore';
import { useAuthStore } from '@/store/authStore';
import { apiService } from '@/services/api';
import { buildUserAssignments } from './projectAssignments';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { RangePicker } = DatePicker;

interface CreateProjectModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess?: (project: Project) => void;
  editProject?: Project | null;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  visible,
  onCancel,
  onSuccess,
  editProject
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<{ label: string; value: number; role?: string }[]>([]);
  const [projectAssignments, setProjectAssignments] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [salesReps, setSalesReps] = useState<any[]>([]);
  const [businessAreas, setBusinessAreas] = useState<any[]>([]);
  const { createProject, updateProject } = useProjectStore();
  const { user } = useAuthStore();

  const isEdit = !!editProject;

  // Helper function to get team member role
  const getTeamMemberRole = (userId: number) => {
    const member = teamMembers.find(m => m.value === userId);
    return member?.role || "Sin información";
  };

  // Load team members when modal opens
  useEffect(() => {
    if (visible) {
      loadTeamMembers();
      void loadCommercialDirectories();
      if (isEdit && editProject) {
        loadProjectAssignments();
      }
    }
  }, [visible, isEdit, editProject]);

  // Separate effect for form population to ensure it runs after team members and assignments are loaded
  useEffect(() => {
    if (visible && teamMembers.length > 0) {
      if (editProject) {
        console.log('Edit project data:', editProject);
        console.log('Project assignments:', projectAssignments);
        
        // Get assigned users from project assignments
        const assignedUsers = projectAssignments.map(a => a.user_id);
        const defaultAllocation = projectAssignments.length > 0 
          ? projectAssignments[0].allocation_percentage 
          : 100;
        
        // Populate form with existing project data
        const formData = {
          name: editProject.name,
          description: editProject.description,
          status: editProject.status,
          priority: editProject.priority,
          budget: editProject.budget,
          dates: editProject.start_date && editProject.end_date ? [
            dayjs(editProject.start_date),
            dayjs(editProject.end_date)
          ] : undefined,
          assigned_users: assignedUsers,
          default_allocation: defaultAllocation,
          // Handle null/undefined values for InputNumber components
          sale_price: editProject.sale_price || undefined,
          hours_budgeted: editProject.hours_budgeted || undefined
        };
        
        console.log('Setting form fields with:', formData);
        form.setFieldsValue(formData);
      } else {
        // Reset form for new project
        form.resetFields();
        form.setFieldsValue({
          status: 'on_hold',
          priority: 'medium',
          default_allocation: 100
        });
      }
    }
  }, [visible, editProject, teamMembers, projectAssignments, form]);

  const loadCommercialDirectories = async () => {
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
      const memberOptions = users.map(user => ({
        label: user.full_name,
        value: user.id,
        role: user.role
      }));
      setTeamMembers(memberOptions);
    } catch (error) {
      console.error('Failed to load team members:', error);
      message.error("No se pudo cargar el equipo");
    }
  };

  const loadProjectAssignments = async () => {
    if (!editProject?.id) return;
    
    try {
      const assignments = await apiService.get(`/projects/${editProject.id}/assignments`);
      setProjectAssignments(assignments);
    } catch (error) {
      console.error('Failed to load project assignments:', error);
      // If assignments don't exist yet, create from legacy assigned_to field
      if (editProject.assigned_to) {
        setProjectAssignments([{
          user_id: editProject.assigned_to,
          allocation_percentage: 100,
          role: 'primary'
        }]);
      }
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);
      
      console.log('Submit called with values:', values);
      console.log('isEdit:', isEdit, 'editProject:', editProject);

      const isOperations = user?.role === 'rpa_operations';

      const projectData = {
        name: values.name,
        description: values.description,
        status: isEdit ? values.status : 'on_hold',
        priority: values.priority,
        budget: values.budget,
        start_date: values.dates?.[0]?.format('YYYY-MM-DD'),
        end_date: values.dates?.[1]?.format('YYYY-MM-DD'),
        assigned_to: isOperations ? null : (values.assigned_users?.[0] || null),
        // Financial data
        sale_price: values.sale_price,
        hours_budgeted: values.hours_budgeted,
        client_id: values.client_id,
        client_contact_id: values.client_contact_id,
        sales_rep_id: values.sales_rep_id,
        area_id: values.area_id,
        opportunity_source: values.opportunity_source || 'direct'
      };
      
      console.log('Sending project data:', projectData);

      let result: Project;

      if (isEdit && editProject) {
        result = await updateProject(editProject.id, projectData);
        message.success("Proyecto actualizado");
      } else {
        result = await createProject(projectData);
        message.success("Proyecto creado");
      }

      // Handle multiple user assignments (el servidor auto-asigna a rpa_operations, no hace falta mandar nada)
      if (!isOperations && values.assigned_users && values.assigned_users.length > 0) {
        const userAssignments = buildUserAssignments(
          values.assigned_users,
          values.default_allocation,
          values.budgeted_hours_per_person,
          values.dates?.[0]?.format('YYYY-MM-DD'),
          values.dates?.[1]?.format('YYYY-MM-DD')
        );

        try {
          await apiService.post(`/projects/${result.id}/assignments`, {
            user_assignments: userAssignments
          });
          console.log('User assignments updated successfully');
        } catch (assignmentError) {
          console.error('Failed to update assignments:', assignmentError);
          message.warning("Proyecto guardado, pero no se pudieron actualizar las asignaciones");
        }
      }

      form.resetFields();
      onSuccess?.(result);
      onCancel();
    } catch (error: any) {
      message.error(error.message || `No se pudo ${isEdit ? 'actualizar' : 'crear'} el proyecto`);
    } finally {
      setLoading(false);
    }
  };

  const statusOptions = [
    { label: "Activo", value: 'active' },
    { label: "En pausa", value: 'on_hold' },
    { label: "Completada", value: 'completed' },
    { label: "Cancelado", value: 'cancelled' }
  ];

  const priorityOptions = [
    { label: 'Crítica', value: 'critical' },
    { label: 'Alta', value: 'high' },
    { label: 'Media', value: 'medium' },
    { label: 'Baja', value: 'low' }
  ];


  return (
    <Modal
      title={isEdit ? 'Editar proyecto' : 'Crear nuevo proyecto'}
      open={visible}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      width={600}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        preserve={false}
        initialValues={editProject ? {
          name: editProject.name,
          description: editProject.description,
          status: editProject.status,
          priority: editProject.priority,
          budget: editProject.budget,
          dates: editProject.start_date && editProject.end_date ? [
            dayjs(editProject.start_date),
            dayjs(editProject.end_date)
          ] : undefined,
          assigned_to: editProject.assigned_to,
          // Handle null/undefined values for InputNumber components
          sale_price: editProject.sale_price || undefined,
          hours_budgeted: editProject.hours_budgeted || undefined
        } : {
          status: 'on_hold',
          priority: 'medium'
        }}
      >
        {!isEdit && <>
          <Form.Item name="opportunity_source" label="Origen de la oportunidad" initialValue="direct"><Select options={[{ value: 'direct', label: 'Contacto directo con el equipo' }, { value: 'sales', label: 'Traída por un comercial' }]} /></Form.Item>
          <Form.Item name="client_id" label="Cliente"><Select allowClear showSearch optionFilterProp="label" placeholder="Selecciona el cliente" options={clients.map((client) => ({ value: client.id, label: client.name }))} /></Form.Item>
          <Form.Item noStyle shouldUpdate={(previous, current) => previous.client_id !== current.client_id}>
            {({ getFieldValue }) => {
              const selectedClient = clients.find((client) => client.id === getFieldValue('client_id'));
              return <Form.Item name="client_contact_id" label="Contacto del cliente"><Select allowClear showSearch optionFilterProp="label" placeholder="Contacto principal u otro contacto" options={(selectedClient?.contacts || []).map((contact: any) => ({ value: contact.id, label: `${contact.name}${contact.is_primary ? ' · Principal' : ''}` }))} /></Form.Item>;
            }}
          </Form.Item>
          <Form.Item name="sales_rep_id" label="Comercial responsable"><Select allowClear showSearch optionFilterProp="label" placeholder="Origen directo o comercial" options={salesReps.map((rep) => ({ value: rep.id, label: rep.name }))} /></Form.Item>
          <Form.Item name="area_id" label="Área de negocio"><Select allowClear showSearch optionFilterProp="label" placeholder="Selecciona el área" options={businessAreas.map((area) => ({ value: area.id, label: area.name }))} /></Form.Item>
        </>}
        <Form.Item
          name="name"
          label="Nombre del proyecto"
          rules={[
            { required: true, message: 'Ingresa el nombre del proyecto' },
            { min: 3, message: 'El nombre debe tener al menos 3 caracteres' },
            { max: 100, message: 'El nombre debe tener menos de 100 caracteres' }
          ]}
        >
          <Input placeholder="Ingresa el nombre del proyecto" />
        </Form.Item>

        <Form.Item
          name="description"
          label="Descripción"
          rules={[
            { max: 500, message: 'La descripción debe tener menos de 500 caracteres' }
          ]}
        >
          <TextArea 
            rows={3} 
            placeholder="Ingresa una descripción del proyecto"
            showCount
            maxLength={500}
          />
        </Form.Item>

        {isEdit && <Form.Item
          name="status"
          label="Estado"
          rules={[{ required: true, message: "Selecciona el estado del proyecto" }]}
        >
          <Select options={statusOptions} placeholder="Selecciona un estado" />
        </Form.Item>}

        <Form.Item
          name="priority"
          label="Prioridad"
          rules={[{ required: true, message: 'Selecciona la prioridad del proyecto' }]}
        >
          <Select options={priorityOptions} placeholder="Selecciona una prioridad" />
        </Form.Item>

        <Form.Item
          name="budget"
          label="Presupuesto inicial (CLP)"
          rules={[
            { type: 'number', min: 0, message: 'El presupuesto debe ser igual o mayor que cero' }
          ]}
        >
          <InputNumber
            style={{ width: '100%' }}
            placeholder="Ingresa el presupuesto en pesos chilenos"
            formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={value => value!.replace(/\$\s?|(,*)/g, '')}
            precision={2}
          />
        </Form.Item>

        <Form.Item
          name="dates"
          label="Fechas del proyecto"
          rules={[
            {
              validator: (_, value) => {
                if (value && value[0] && value[1] && value[0].isAfter(value[1])) {
                  return Promise.reject("La fecha de inicio debe ser anterior a la de término");
                }
                return Promise.resolve();
              }
            }
          ]}
        >
          <RangePicker
            style={{ width: '100%' }}
            placeholder={["Fecha de inicio", "Fecha de término"]}
            format="YYYY-MM-DD"
          />
        </Form.Item>

        {user?.role === 'rpa_operations' ? (
          <Alert type="info" message="Quedarás asignado a este proyecto" showIcon style={{ marginBottom: 24 }} />
        ) : (
          <>
            <Form.Item
              name="assigned_users"
              label="Personas asignadas"
              rules={[]}
            >
              <Select
                mode="multiple"
                options={teamMembers.map(member => ({
                  ...member,
                  label: `${member.label} (${getTeamMemberRole(member.value)})`
                }))}
                placeholder="Selecciona personas del equipo"
                allowClear
                maxTagCount="responsive"
                optionFilterProp="label"
              />
            </Form.Item>

            <Form.Item
              name="default_allocation"
              label="Dedicación por persona (%)"
              tooltip="Porcentaje del tiempo de trabajo comprometido para este proyecto"
            >
              <InputNumber
                min={1}
                max={100}
                placeholder="100"
                formatter={(value) => `${value}%`}
                parser={(value) => parseInt(value!.replace('%', '')) as 1 | 100}
                style={{ width: '100%' }}
              />
            </Form.Item>

            <Form.Item name="budgeted_hours_per_person" label="Horas presupuestadas por persona" tooltip="Puedes asignar el equipo después de aprobar la oportunidad.">
              <InputNumber min={0} precision={1} style={{ width: '100%' }} placeholder="Por definir" />
            </Form.Item>
          </>
        )}

        {user?.role === 'team_lead' && editProject?.project_type === 'internal' && (
          <>
            <Form.Item
              name="sale_price"
              label="Sale Price ($)"
              rules={[
                { type: 'number', min: 0, message: "El precio de venta debe ser un número positivo" }
              ]}
            >
              <InputNumber
                style={{ width: '100%' }}
                placeholder="Ingresa el precio de venta"
                formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={value => value!.replace(/\$\s?|(,*)/g, '')}
                precision={2}
              />
            </Form.Item>

            <Form.Item
              name="hours_budgeted"
              label="Horas presupuestadas"
              rules={[
                { type: 'number', min: 0, message: "Las horas deben ser un número positivo" }
              ]}
            >
              <InputNumber
                style={{ width: '100%' }}
                placeholder="Ingresa las horas estimadas"
                min={0}
                precision={1}
              />
            </Form.Item>
          </>
        )}
        {user?.role === 'team_lead' && !isEdit && <Alert type="info" showIcon message="La oportunidad se crea en cotización. Precio y costo se registran como una versión desde la ficha comercial." style={{ marginTop: 8 }} />}
      </Form>
    </Modal>
  );
};
