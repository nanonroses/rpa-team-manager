import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, InputNumber, message, Row, Col, Card, Typography } from 'antd';
import { Idea, IdeaCategory, IdeaStatus, CreateIdeaRequest } from '@/types/idea';
import { useIdeaStore } from '@/store/ideaStore';

const { TextArea } = Input;
const { Option } = Select;
const { Title, Text } = Typography;

interface CreateIdeaModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess?: (idea: Idea) => void;
  editIdea?: Idea | null;
}

export const CreateIdeaModal: React.FC<CreateIdeaModalProps> = ({
  visible,
  onCancel,
  onSuccess,
  editIdea
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { createIdea, updateIdea } = useIdeaStore();

  const isEdit = !!editIdea;

  useEffect(() => {
    if (visible) {
      if (editIdea) {
        form.setFieldsValue({
          title: editIdea.title,
          description: editIdea.description,
          category: editIdea.category,
          impact_score: editIdea.impact_score,
          effort_score: editIdea.effort_score,
          status: editIdea.status
        });
      } else {
        form.resetFields();
        form.setFieldsValue({
          category: 'general',
          impact_score: 3,
          effort_score: 3,
          status: 'draft'
        });
      }
    }
  }, [visible, editIdea, form]);

  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);

      const ideaData: CreateIdeaRequest = {
        title: values.title,
        description: values.description,
        category: values.category,
        impact_score: values.impact_score,
        effort_score: values.effort_score,
        status: values.status
      };

      let result: Idea;

      if (isEdit && editIdea) {
        result = await updateIdea(editIdea.id, ideaData);
        message.success('Idea updated successfully');
      } else {
        result = await createIdea(ideaData);
        message.success('Idea created successfully');
      }

      form.resetFields();
      onSuccess?.(result);
      onCancel();
    } catch (error: any) {
      message.error(error.message || `Failed to ${isEdit ? 'update' : 'create'} idea`);
    } finally {
      setLoading(false);
    }
  };

  const categoryOptions = [
    { label: 'Automation', value: 'automation' },
    { label: 'Process Improvement', value: 'process_improvement' },
    { label: 'Tool Enhancement', value: 'tool_enhancement' },
    { label: 'Cost Reduction', value: 'cost_reduction' },
    { label: 'Productivity', value: 'productivity' },
    { label: 'General', value: 'general' }
  ];

  const statusOptions = [
    { label: 'Draft', value: 'draft' },
    { label: 'Under Review', value: 'under_review' },
    { label: 'Approved', value: 'approved' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Done', value: 'done' },
    { label: 'Rejected', value: 'rejected' }
  ];

  const impactLabels = {
    1: 'Very Low',
    2: 'Low', 
    3: 'Medium',
    4: 'High',
    5: 'Very High'
  };

  const effortLabels = {
    1: 'Very Easy',
    2: 'Easy',
    3: 'Medium',
    4: 'Hard',
    5: 'Very Hard'
  };

  return (
    <Modal
      title={isEdit ? 'Edit Idea' : 'Create New Idea'}
      open={visible}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      width={700}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        preserve={false}
        initialValues={{
          category: 'general',
          impact_score: 3,
          effort_score: 3,
          status: 'draft'
        }}
      >
        <Form.Item
          name="title"
          label="Idea Title"
          rules={[
            { required: true, message: 'Please enter idea title' },
            { min: 3, message: 'Title must be at least 3 characters' },
            { max: 200, message: 'Title must be less than 200 characters' }
          ]}
        >
          <Input placeholder="Enter a descriptive title for your idea" />
        </Form.Item>

        <Form.Item
          name="description"
          label="Description"
          rules={[
            { required: true, message: 'Please enter idea description' },
            { min: 10, message: 'Description must be at least 10 characters' },
            { max: 2000, message: 'Description must be less than 2000 characters' }
          ]}
        >
          <TextArea 
            rows={4} 
            placeholder="Describe your idea in detail. What problem does it solve? How would it work?"
            showCount
            maxLength={2000}
          />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="category"
              label="Category"
              rules={[{ required: true, message: 'Please select a category' }]}
            >
              <Select placeholder="Select category">
                {categoryOptions.map(option => (
                  <Option key={option.value} value={option.value}>
                    {option.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="status"
              label="Status"
              rules={[{ required: true, message: 'Please select status' }]}
            >
              <Select placeholder="Select status">
                {statusOptions.map(option => (
                  <Option key={option.value} value={option.value}>
                    {option.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        {/* Priority Matrix Section */}
        <Card 
          title="Priority Matrix Assessment" 
          style={{ marginBottom: 16 }}
          size="small"
        >
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            Help prioritize this idea by rating its impact and implementation effort.
          </Text>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="impact_score"
                label="Impact Score"
                rules={[{ required: true, message: 'Please rate the impact' }]}
              >
                <Select placeholder="Rate potential impact">
                  {Object.entries(impactLabels).map(([value, label]) => (
                    <Option key={value} value={parseInt(value)}>
                      {value} - {label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                How much positive impact would this idea have on the business/team?
              </Text>
            </Col>
            <Col span={12}>
              <Form.Item
                name="effort_score"
                label="Effort Score"
                rules={[{ required: true, message: 'Please rate the effort' }]}
              >
                <Select placeholder="Rate implementation effort">
                  {Object.entries(effortLabels).map(([value, label]) => (
                    <Option key={value} value={parseInt(value)}>
                      {value} - {label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                How difficult/time-consuming would this be to implement?
              </Text>
            </Col>
          </Row>

          <Form.Item dependencies={['impact_score', 'effort_score']}>
            {({ getFieldValue }) => {
              const impact = getFieldValue('impact_score') || 3;
              const effort = getFieldValue('effort_score') || 3;
              const priority = (impact / effort).toFixed(2);
              
              let priorityLevel = 'Medium';
              let priorityColor = '#faad14';
              
              if (parseFloat(priority) >= 2) {
                priorityLevel = 'High';
                priorityColor = '#f5222d';
              } else if (parseFloat(priority) >= 1.5) {
                priorityLevel = 'Medium';
                priorityColor = '#faad14';
              } else {
                priorityLevel = 'Low';
                priorityColor = '#52c41a';
              }

              return (
                <div style={{ 
                  padding: '12px', 
                  backgroundColor: '#fafafa', 
                  borderRadius: '6px',
                  textAlign: 'center' 
                }}>
                  <Text strong>Calculated Priority Score: </Text>
                  <Text style={{ color: priorityColor, fontSize: '16px', fontWeight: 'bold' }}>
                    {priority} ({priorityLevel})
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    Impact ({impact}) ÷ Effort ({effort}) = {priority}
                  </Text>
                </div>
              );
            }}
          </Form.Item>
        </Card>
      </Form>
    </Modal>
  );
};

export default CreateIdeaModal;