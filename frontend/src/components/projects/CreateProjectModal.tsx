import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, DatePicker, InputNumber, message } from 'antd';
import { Project, ProjectStatus, Priority } from '@/types/project';
import { useProjectStore } from '@/store/projectStore';
import { useAuthStore } from '@/store/authStore';
import { apiService } from '@/services/api';
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
  const [teamMembers, setTeamMembers] = useState<{ label: string; value: number }[]>([]);
  const { createProject, updateProject } = useProjectStore();
  const { user } = useAuthStore();

  const isEdit = !!editProject;

  // Load team members when modal opens
  useEffect(() => {
    if (visible) {
      loadTeamMembers();
    }
  }, [visible]);

  // Separate effect for form population to ensure it runs after team members are loaded
  useEffect(() => {
    if (visible && teamMembers.length > 0) {
      if (editProject) {
        // Debug: Check what data we're getting
        console.log('Edit project data:', editProject);
        console.log('Sale price:', editProject.sale_price);
        console.log('Hours budgeted:', editProject.hours_budgeted);
        
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
          assigned_to: editProject.assigned_to,
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
          status: 'planning',
          priority: 'medium'
        });
      }
    }
  }, [visible, editProject, teamMembers, form]);

  const loadTeamMembers = async () => {
    try {
      const users = await apiService.getUsers();
      const memberOptions = users.map(user => ({
        label: user.full_name,
        value: user.id
      }));
      setTeamMembers(memberOptions);
    } catch (error) {
      console.error('Failed to load team members:', error);
      message.error('Failed to load team members');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);
      
      console.log('Submit called with values:', values);
      console.log('isEdit:', isEdit, 'editProject:', editProject);

      const projectData = {
        name: values.name,
        description: values.description,
        status: values.status,
        priority: values.priority,
        budget: values.budget,
        start_date: values.dates?.[0]?.format('YYYY-MM-DD'),
        end_date: values.dates?.[1]?.format('YYYY-MM-DD'),
        assigned_to: values.assigned_to,
        // Financial data
        sale_price: values.sale_price,
        hours_budgeted: values.hours_budgeted
      };
      
      console.log('Sending project data:', projectData);

      let result: Project;

      if (isEdit && editProject) {
        result = await updateProject(editProject.id, projectData);
        message.success('Project updated successfully');
      } else {
        result = await createProject(projectData);
        message.success('Project created successfully');
      }

      form.resetFields();
      onSuccess?.(result);
      onCancel();
    } catch (error: any) {
      message.error(error.message || `Failed to ${isEdit ? 'update' : 'create'} project`);
    } finally {
      setLoading(false);
    }
  };

  const statusOptions = [
    { label: 'Planning', value: 'planning' },
    { label: 'Active', value: 'active' },
    { label: 'On Hold', value: 'on_hold' },
    { label: 'Completed', value: 'completed' },
    { label: 'Cancelled', value: 'cancelled' }
  ];

  const priorityOptions = [
    { label: 'Critical', value: 'critical' },
    { label: 'High', value: 'high' },
    { label: 'Medium', value: 'medium' },
    { label: 'Low', value: 'low' }
  ];


  return (
    <Modal
      title={isEdit ? 'Edit Project' : 'Create New Project'}
      open={visible}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      width={600}
      destroyOnClose
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
          status: 'planning',
          priority: 'medium'
        }}
      >
        <Form.Item
          name="name"
          label="Project Name"
          rules={[
            { required: true, message: 'Please enter project name' },
            { min: 3, message: 'Project name must be at least 3 characters' },
            { max: 100, message: 'Project name must be less than 100 characters' }
          ]}
        >
          <Input placeholder="Enter project name" />
        </Form.Item>

        <Form.Item
          name="description"
          label="Description"
          rules={[
            { max: 500, message: 'Description must be less than 500 characters' }
          ]}
        >
          <TextArea 
            rows={3} 
            placeholder="Enter project description"
            showCount
            maxLength={500}
          />
        </Form.Item>

        <Form.Item
          name="status"
          label="Status"
          rules={[{ required: true, message: 'Please select project status' }]}
        >
          <Select options={statusOptions} placeholder="Select status" />
        </Form.Item>

        <Form.Item
          name="priority"
          label="Priority"
          rules={[{ required: true, message: 'Please select project priority' }]}
        >
          <Select options={priorityOptions} placeholder="Select priority" />
        </Form.Item>

        <Form.Item
          name="budget"
          label="Budget ($)"
          rules={[
            { type: 'number', min: 0, message: 'Budget must be a positive number' }
          ]}
        >
          <InputNumber
            style={{ width: '100%' }}
            placeholder="Enter budget amount"
            formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={value => value!.replace(/\$\s?|(,*)/g, '')}
            precision={2}
          />
        </Form.Item>

        <Form.Item
          name="dates"
          label="Project Timeline"
          rules={[
            {
              validator: (_, value) => {
                if (value && value[0] && value[1] && value[0].isAfter(value[1])) {
                  return Promise.reject('Start date must be before end date');
                }
                return Promise.resolve();
              }
            }
          ]}
        >
          <RangePicker
            style={{ width: '100%' }}
            placeholder={['Start Date', 'End Date']}
            format="YYYY-MM-DD"
          />
        </Form.Item>

        <Form.Item
          name="assigned_to"
          label="Assigned To"
        >
          <Select 
            options={teamMembers} 
            placeholder="Select team member"
            allowClear
          />
        </Form.Item>

        {user?.role === 'team_lead' && (
          <>
            <Form.Item
              name="sale_price"
              label="Sale Price ($)"
              rules={[
                { type: 'number', min: 0, message: 'Sale price must be a positive number' }
              ]}
            >
              <InputNumber
                style={{ width: '100%' }}
                placeholder="Enter sale price"
                formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={value => value!.replace(/\$\s?|(,*)/g, '')}
                precision={2}
              />
            </Form.Item>

            <Form.Item
              name="hours_budgeted"
              label="Budgeted Hours"
              rules={[
                { type: 'number', min: 0, message: 'Hours must be a positive number' }
              ]}
            >
              <InputNumber
                style={{ width: '100%' }}
                placeholder="Enter estimated hours"
                min={0}
                precision={1}
              />
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
  );
};