import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, message, Row, Col, Card, Typography } from 'antd';
import { Idea, CreateIdeaRequest } from '@/types/idea';
import { useIdeaStore } from '@/store/ideaStore';

const { TextArea } = Input;
const { Option } = Select;
const { Text } = Typography;

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
        message.success("Idea actualizada");
      } else {
        result = await createIdea(ideaData);
        message.success("Idea creada");
      }

      form.resetFields();
      onSuccess?.(result);
      onCancel();
    } catch (error: any) {
      message.error(error.message || `No se pudo ${isEdit ? 'actualizar' : 'crear'} la idea`);
    } finally {
      setLoading(false);
    }
  };

  const categoryOptions = [
    { label: "Automatización", value: 'automation' },
    { label: "Mejora de procesos", value: 'process_improvement' },
    { label: "Mejora de herramientas", value: 'tool_enhancement' },
    { label: "Reducción de costos", value: 'cost_reduction' },
    { label: "Productividad", value: 'productivity' },
    { label: 'General', value: 'general' }
  ];

  const statusOptions = [
    { label: "Borrador", value: 'draft' },
    { label: "En revisión", value: 'under_review' },
    { label: "Aprobado", value: 'approved' },
    { label: "En curso", value: 'in_progress' },
    { label: "Completado", value: 'done' },
    { label: "Rechazado", value: 'rejected' }
  ];

  const impactLabels = {
    1: "Muy bajo",
    2: "Bajo", 
    3: "Medio",
    4: "Alto",
    5: "Muy alto"
  };

  const effortLabels = {
    1: "Muy fácil",
    2: "Fácil",
    3: "Medio",
    4: "Difícil",
    5: "Muy difícil"
  };

  return (
    <Modal
      title={isEdit ? "Editar idea" : "Crear idea"}
      open={visible}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      okText={isEdit ? 'Guardar cambios' : 'Crear idea'}
      cancelText="Cancelar"
      width={700}
      destroyOnHidden
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
          label="Título de la idea"
          rules={[
            { required: true, message: "Ingresa el título de la idea" },
            { min: 3, message: "El título debe tener al menos 3 caracteres" },
            { max: 200, message: "El título debe tener como máximo 200 caracteres" }
          ]}
        >
          <Input placeholder="Ingresa un título descriptivo para tu idea" />
        </Form.Item>

        <Form.Item
          name="description"
          label="Descripción"
          rules={[
            { required: true, message: "Ingresa la descripción de la idea" },
            { min: 10, message: "La descripción debe tener al menos 10 caracteres" },
            { max: 2000, message: "La descripción debe tener como máximo 2000 caracteres" }
          ]}
        >
          <TextArea 
            rows={4} 
            placeholder="Describe tu idea. ¿Qué problema resuelve? ¿Cómo funcionaría?"
            showCount
            maxLength={2000}
          />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="category"
              label="Categoría"
              rules={[{ required: true, message: "Selecciona una categoría" }]}
            >
              <Select placeholder="Selecciona una categoría">
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
              label="Estado"
              rules={[{ required: true, message: "Selecciona un estado" }]}
            >
              <Select placeholder="Selecciona un estado">
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
          title="Evaluación de prioridad" 
          style={{ marginBottom: 16 }}
          size="small"
        >
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            
            Evalúa el impacto y el esfuerzo de implementación para priorizar esta idea.
          </Text>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="impact_score"
                label="Puntaje de impacto"
                rules={[{ required: true, message: "Evalúa el impacto" }]}
              >
                <Select placeholder="Evalúa el impacto potencial">
                  {Object.entries(impactLabels).map(([value, label]) => (
                    <Option key={value} value={parseInt(value)}>
                      {value} - {label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                
                ¿Qué impacto positivo tendría esta idea en el negocio o equipo?
              </Text>
            </Col>
            <Col span={12}>
              <Form.Item
                name="effort_score"
                label="Puntaje de esfuerzo"
                rules={[{ required: true, message: "Evalúa el esfuerzo" }]}
              >
                <Select placeholder="Evalúa el esfuerzo de implementación">
                  {Object.entries(effortLabels).map(([value, label]) => (
                    <Option key={value} value={parseInt(value)}>
                      {value} - {label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                
                ¿Cuánta dificultad y tiempo requiere implementarla?
              </Text>
            </Col>
          </Row>

          <Form.Item dependencies={['impact_score', 'effort_score']}>
            {({ getFieldValue }) => {
              const impact = getFieldValue('impact_score') || 3;
              const effort = getFieldValue('effort_score') || 3;
              const priority = (impact / effort).toFixed(2);
              
              let priorityLevel = "Medio";
              let priorityColor = 'var(--color-warning)';
              
              if (parseFloat(priority) >= 2) {
                priorityLevel = "Alto";
                priorityColor = 'var(--color-error)';
              } else if (parseFloat(priority) >= 1.5) {
                priorityLevel = "Medio";
                priorityColor = 'var(--color-warning)';
              } else {
                priorityLevel = "Bajo";
                priorityColor = 'var(--color-success)';
              }

              return (
                <div style={{ 
                  padding: '12px', 
                  backgroundColor: 'var(--color-surface-raised)', 
                  borderRadius: '6px',
                  textAlign: 'center' 
                }}>
                  <Text strong>Prioridad calculada: </Text>
                  <Text style={{ color: priorityColor, fontSize: '16px', fontWeight: 'bold' }}>
                    {priority} ({priorityLevel})
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    
                    Impacto ({impact}) ÷ Esfuerzo ({effort}) = {priority}
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
