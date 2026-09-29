import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  Typography,
  Space,
  Tabs,
  Alert,
  Divider,
  Tag,
  Slider,
  Row,
  Col,
  App
} from 'antd';
import {
  SettingOutlined,
  UndoOutlined,
  SaveOutlined,
  RobotOutlined,
  FileTextOutlined,
  SlidersOutlined,
  BulbOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { apiService } from '@/services/api';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export interface SkillConfigData {
  name: string;
  description: string;
  role_description: string;
  system_prompt: string;
  client_report_guidelines: string;
  health_threshold_warning: number;
  health_threshold_critical: number;
  preferred_provider: string;
  temperature: number;
  max_tokens: number;
  custom_instructions?: string;
  updated_at?: string;
  updated_by_name?: string;
}

interface SkillConfigModalProps {
  visible: boolean;
  onClose: () => void;
  onConfigSaved?: (config: SkillConfigData) => void;
}

export const SkillConfigModal: React.FC<SkillConfigModalProps> = ({
  visible,
  onClose,
  onConfigSaved
}) => {
  const { message, modal } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [config, setConfig] = useState<SkillConfigData | null>(null);

  useEffect(() => {
    if (visible) {
      loadConfig();
    }
  }, [visible]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const response = await apiService.getSkillConfig();
      if (response && response.success && response.data) {
        setConfig(response.data);
        form.setFieldsValue(response.data);
      } else {
        message.error('No se pudo cargar la configuración de la Skill');
      }
    } catch (err: any) {
      console.error('Error fetching skill config:', err);
      message.error(err?.message || 'Error al obtener la configuración');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const response = await apiService.updateSkillConfig(values);

      if (response && response.success) {
        message.success('¡Configuración de la Skill guardada exitosamente!');
        setConfig(response.data);
        if (onConfigSaved) onConfigSaved(response.data);
        onClose();
      } else {
        message.error(response?.error || 'Error al guardar la configuración');
      }
    } catch (err: any) {
      if (err?.errorFields) return; // Validation error
      console.error('Error saving skill config:', err);
      message.error(err?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    modal.confirm({
      title: '¿Restablecer configuración a valores por defecto?',
      icon: <UndoOutlined style={{ color: '#faad14' }} />,
      content: 'Esta acción restaurará el prompt del sistema, directivas de reporte y umbrales a los valores iniciales estándar probados para RPA.',
      okText: 'Restablecer',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk: async () => {
        setResetting(true);
        try {
          const response = await apiService.resetSkillConfig();
          if (response && response.success && response.data) {
            setConfig(response.data);
            form.setFieldsValue(response.data);
            message.success('Valores de la Skill restablecidos por defecto');
            if (onConfigSaved) onConfigSaved(response.data);
          }
        } catch (err: any) {
          message.error('Error al restablecer valores');
        } finally {
          setResetting(false);
        }
      }
    });
  };

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      width={800}
      title={
        <Space align="center">
          <SettingOutlined style={{ color: '#1677ff', fontSize: 20 }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>
              Configurar Skill: Revisor IA de Proyecto RPA
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Personaliza las directivas, criterios de evaluación y formato de reporte para tu equipo.
            </Text>
          </div>
        </Space>
      }
      footer={[
        <Button key="reset" danger icon={<UndoOutlined />} loading={resetting} onClick={handleReset}>
          Restablecer Valores de Fábrica
        </Button>,
        <Button key="cancel" onClick={onClose}>
          Cancelar
        </Button>,
        <Button key="save" type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
          Guardar Cambios de la Skill
        </Button>
      ]}
      destroyOnClose
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Text type="secondary">Cargando directivas de la Skill...</Text>
        </div>
      ) : (
        <Form form={form} layout="vertical" initialValues={config || {}}>
          {config?.updated_at && (
            <Alert
              type="info"
              showIcon
              message={
                <Space>
                  <span>
                    Última actualización: {new Date(config.updated_at).toLocaleString()}
                    {config.updated_by_name ? ` por ${config.updated_by_name}` : ''}
                  </span>
                  <Tag color="blue">Team Lead / Admin</Tag>
                </Space>
              }
              style={{ marginBottom: 16 }}
            />
          )}

          <Tabs
            defaultActiveKey="directives"
            items={[
              {
                key: 'directives',
                label: (
                  <span>
                    <RobotOutlined /> Directivas y Prompt Maestro
                  </span>
                ),
                children: (
                  <div>
                    <Row gutter={16}>
                      <Col xs={24} md={12}>
                        <Form.Item
                          name="name"
                          label="Nombre Visible de la Skill"
                          rules={[{ required: true, message: 'Ingresa el nombre de la skill' }]}
                        >
                          <Input placeholder="Ej. Revisor IA de Proyecto RPA" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item
                          name="role_description"
                          label="Rol / Persona del Auditor IA"
                          rules={[{ required: true, message: 'Ingresa el rol del auditor' }]}
                        >
                          <Input placeholder="Ej. Director Senior de Operaciones y Auditor RPA" />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Form.Item
                      name="system_prompt"
                      label={
                        <Space>
                          <span>System Prompt Maestro (Instrucciones de Auditoría)</span>
                          <Tag color="cyan">Instrucción Principal</Tag>
                        </Space>
                      }
                      extra="Define las reglas precisas de análisis y el formato estricto JSON que el modelo devolverá."
                      rules={[{ required: true, message: 'El system prompt es requerido' }]}
                    >
                      <TextArea
                        rows={9}
                        style={{
                          fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                          fontSize: 12
                        }}
                      />
                    </Form.Item>

                    <Form.Item
                      name="custom_instructions"
                      label={
                        <Space>
                          <BulbOutlined style={{ color: '#faad14' }} />
                          <span>Directivas Específicas Adicionales para tu Equipo</span>
                        </Space>
                      }
                      extra="Agrega reglas particulares de tu empresa (ej: 'Considerar crítico si falta pase a producción en SAP', 'Priorizar hitos de integración con Salesforce')."
                    >
                      <TextArea
                        rows={3}
                        placeholder="Ej. Si el cliente es una institución bancaria, enfatizar en cuellos de botella de seguridad y accesos a VPN."
                      />
                    </Form.Item>
                  </div>
                )
              },
              {
                key: 'client_report',
                label: (
                  <span>
                    <FileTextOutlined /> Plantilla Reporte al Cliente
                  </span>
                ),
                children: (
                  <div>
                    <Paragraph type="secondary">
                      Estas directivas guían cómo la IA redactará el borrador del mensaje para el cliente (WhatsApp / Email).
                    </Paragraph>

                    <Form.Item
                      name="client_report_guidelines"
                      label="Directivas de Tono, Saludo y Firma del Reporte"
                      rules={[{ required: true, message: 'Ingresa las directivas del reporte' }]}
                    >
                      <TextArea
                        rows={7}
                        placeholder="Ej. Mantener tono formal y constructivo. Estructurar en: Estado General, Principales Avances, Próximos Pasos y Firma formal del Equipo de Automatización..."
                      />
                    </Form.Item>

                    <div className="ai-skill-guide-box">
                      <Text strong style={{ color: 'var(--color-success)', display: 'block', marginBottom: 4 }}>
                        <CheckCircleOutlined /> Consejo de Redacción:
                      </Text>
                      <Paragraph style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)' }}>
                        La IA inyectará automáticamente los datos reales del proyecto (progreso %, componentes concluidos, hitos alcanzados y puntos bloqueados) dentro de la plantilla que definas.
                      </Paragraph>
                    </div>
                  </div>
                )
              },
              {
                key: 'parameters',
                label: (
                  <span>
                    <SlidersOutlined /> Parámetros y Umbrales
                  </span>
                ),
                children: (
                  <div>
                    <Row gutter={24}>
                      <Col xs={24} md={12}>
                        <Form.Item
                          name="health_threshold_warning"
                          label="Puntaje Mínimo para Estado Saludable (0-100)"
                          extra="Puntajes por debajo de este valor se marcarán como 'En Riesgo'."
                          rules={[{ required: true }]}
                        >
                          <InputNumber min={50} max={99} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={12}>
                        <Form.Item
                          name="health_threshold_critical"
                          label="Umbral Máximo para Estado Crítico (0-100)"
                          extra="Puntajes menores a este valor se marcarán como 'Crítico'."
                          rules={[{ required: true }]}
                        >
                          <InputNumber min={10} max={70} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Divider style={{ margin: '16px 0' }} />

                    <Row gutter={24}>
                      <Col xs={24} md={12}>
                        <Form.Item
                          name="preferred_provider"
                          label="Proveedor de IA Preferido por Defecto"
                          extra="Motor que utilizará la Skill a menos que el usuario elija otro."
                        >
                          <Select
                            options={[
                              { value: 'auto', label: '🤖 Automático (Recomendado)' },
                              { value: 'gemini', label: '✨ Google Gemini' },
                              { value: 'openai', label: '⚡ OpenAI GPT' },
                              { value: 'claude', label: '🧠 Anthropic Claude' },
                              { value: 'deepseek', label: '🔮 DeepSeek' }
                            ]}
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={12}>
                        <Form.Item
                          name="temperature"
                          label="Temperatura del Modelo (Precisión vs Creatividad)"
                          extra="0.1 - 0.3 recomendado para auditorías técnicas y consistentes."
                        >
                          <Slider min={0.0} max={1.0} step={0.05} marks={{ 0.1: 'Preciso', 0.5: 'Equilibrado', 0.9: 'Creativo' }} />
                        </Form.Item>
                      </Col>
                    </Row>
                  </div>
                )
              }
            ]}
          />
        </Form>
      )}
    </Modal>
  );
};
