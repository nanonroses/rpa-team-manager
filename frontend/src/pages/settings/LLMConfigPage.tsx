import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Typography,
  Space,
  message,
  Row,
  Col,
  Alert,
  Divider,
  Tag,
  Modal,
  Spin,
  Select
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  KeyOutlined,
  SafetyOutlined,
  RobotOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { useLLMConfigStore, LLMProvider } from '@/store/llmConfigStore';
import { SkillConfigModal } from '@/components/projects/SkillConfigModal';

const REASONING_LABELS: Record<string, string> = { none: 'Sin razonamiento', minimal: 'Mínimo', low: 'Ligero', medium: 'Medio', high: 'Alto', xhigh: 'Muy alto', max: 'Máximo' };

const { Title, Text, Paragraph } = Typography;

interface ProviderConfig {
  key: LLMProvider;
  name: string;
  icon: string;
  description: string;
  docUrl: string;
  placeholder: string;
}

const PROVIDERS: ProviderConfig[] = [
  {
    key: 'openai',
    name: 'OpenAI',
    icon: '🤖',
    description: 'Modelos de OpenAI con selección de razonamiento según compatibilidad',
    docUrl: 'https://platform.openai.com/api-keys',
    placeholder: 'sk-...'
  },
  {
    key: 'claude',
    name: 'Anthropic Claude',
    icon: '🧠',
    description: 'Claude 3 Opus, Sonnet, y Haiku',
    docUrl: 'https://console.anthropic.com/settings/keys',
    placeholder: 'sk-ant-...'
  },
  {
    key: 'gemini',
    name: 'Google Gemini',
    icon: '✨',
    description: 'Gemini Pro y otros modelos de Google AI',
    docUrl: 'https://makersuite.google.com/app/apikey',
    placeholder: 'AIza...'
  },
  {
    key: 'deepseek',
    name: 'DeepSeek',
    icon: '🔍',
    description: 'DeepSeek Chat y modelos de razonamiento',
    docUrl: 'https://platform.deepseek.com/api_keys',
    placeholder: 'sk-...'
  }
];

export const LLMConfigPage: React.FC = () => {
  const {
    apiKeys,
    availableModels,
    isLoading,
    error,
    validating,
    fetchApiKeys,
    fetchAvailableModels,
    validateApiKey,
    saveApiKey,
    updateApiKey,
    deleteApiKey,
    clearError
  } = useLLMConfigStore();

  const [editingProvider, setEditingProvider] = useState<LLMProvider | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [reasoningEffort, setReasoningEffort] = useState<string | null>(null);
  const [replaceKey, setReplaceKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [validationResults, setValidationResults] = useState<Record<LLMProvider, boolean | null>>({
    openai: null,
    claude: null,
    gemini: null,
    deepseek: null
  });
  const [skillModalOpen, setSkillModalOpen] = useState(false);

  useEffect(() => {
    fetchApiKeys();
    fetchAvailableModels();
  }, [fetchApiKeys, fetchAvailableModels]);

  useEffect(() => {
    if (error) {
      message.error(error);
      clearError();
    }
  }, [error, clearError]);

  const getProviderKey = (provider: LLMProvider) => {
    return apiKeys.find(k => k.provider === provider);
  };

  const handleValidate = async (provider: LLMProvider) => {
    if (!apiKeyInput.trim()) {
      message.warning('Por favor ingrese una API key');
      return;
    }

    try {
      const result = await validateApiKey(provider, apiKeyInput);

      if (result.is_valid) {
        message.success('API key válida ✓');
        setValidationResults(prev => ({ ...prev, [provider]: true }));
      } else {
        message.error(`API key inválida: ${result.error}`);
        setValidationResults(prev => ({ ...prev, [provider]: false }));
      }
    } catch (error) {
      setValidationResults(prev => ({ ...prev, [provider]: false }));
    }
  };

  const handleSave = async (provider: LLMProvider) => {
    const needsKey = !getProviderKey(provider) || replaceKey;
    if (needsKey && !apiKeyInput.trim()) {
      message.warning('Por favor ingrese una API key');
      return;
    }

    if (needsKey && validationResults[provider] !== true) {
      message.warning('Por favor valide la API key antes de guardar');
      return;
    }

    if (!selectedModel) {
      message.warning('Por favor seleccione un modelo');
      return;
    }

    try {
      const existingKey = getProviderKey(provider);

      if (existingKey) {
        await updateApiKey(provider, apiKeyInput.trim(), selectedModel, reasoningEffort);
        message.success('Configuración actualizada exitosamente');
      } else {
        await saveApiKey(provider, apiKeyInput.trim(), selectedModel, reasoningEffort);
        message.success('API key guardada exitosamente');
      }

      setEditingProvider(null);
      setApiKeyInput('');
      setSelectedModel('');
      setValidationResults(prev => ({ ...prev, [provider]: null }));
    } catch (error) {
      // Error already handled by store
    }
  };

  const handleDelete = (provider: LLMProvider) => {
    Modal.confirm({
      title: '¿Eliminar API Key?',
      content: `¿Está seguro que desea eliminar la API key de ${PROVIDERS.find(p => p.key === provider)?.name}?`,
      okText: 'Eliminar',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          await deleteApiKey(provider);
          message.success('API key eliminada');
        } catch (error) {
          // Error already handled by store
        }
      }
    });
  };

  const handleEdit = (provider: LLMProvider) => {
    setEditingProvider(provider);
    setApiKeyInput('');
    const existingKey = getProviderKey(provider);
    setSelectedModel(existingKey?.selected_model || '');
    const options = availableModels?.[provider]?.find(m => m.value === existingKey?.selected_model)?.reasoning_options;
    setReasoningEffort(options ? existingKey?.reasoning_effort || 'low' : null);
    setReplaceKey(false);
    setValidationResults(prev => ({ ...prev, [provider]: null }));
  };

  const handleCancel = () => {
    setEditingProvider(null);
    setApiKeyInput('');
    setSelectedModel('');
    setValidationResults(_prev => ({
      openai: null,
      claude: null,
      gemini: null,
      deepseek: null
    }));
  };

  const renderProviderCard = (providerConfig: ProviderConfig) => {
    const { key, name, icon, description, docUrl, placeholder } = providerConfig;
    const savedKey = getProviderKey(key);
    const isEditing = editingProvider === key;
    const isValidating = validating[key];
    const validationResult = validationResults[key];
    const reasoningOptions = availableModels?.[key]?.find(m => m.value === selectedModel)?.reasoning_options;

    return (
      <Col xs={24} lg={12} key={key}>
        <Card
          title={
            <Space>
              <span style={{ fontSize: '24px' }}>{icon}</span>
              <span>{name}</span>
              {savedKey && savedKey.is_valid && (
                <Tag color="success" icon={<CheckCircleOutlined />}>
                  Configurado
                </Tag>
              )}
            </Space>
          }
          extra={
            savedKey && !isEditing && (
              <Space>
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => handleEdit(key)}
                >
                  Editar
                </Button>
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(key)}
                >
                  Eliminar
                </Button>
              </Space>
            )
          }
          styles={{ body: { padding: '20px' } }}
        >
          <Paragraph type="secondary" style={{ marginBottom: '16px' }}>
            {description}
          </Paragraph>

          {savedKey && !isEditing ? (
            <div>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text strong>Clave API: </Text>
                  <Text code>{savedKey.api_key_masked}</Text>
                </div>
                {savedKey.selected_model && (
                  <div>
                    <Text strong>Modelo: </Text>
                    <Tag color="blue">
                      {availableModels?.[key]?.find(m => m.value === savedKey.selected_model)?.label || savedKey.selected_model}
                    </Tag>
                  </div>
                )}
                <div><Text strong>Razonamiento: </Text>{REASONING_LABELS[savedKey.reasoning_effort || ''] || (availableModels?.[key]?.find(m => m.value === savedKey.selected_model)?.reasoning_options ? 'Ligero' : 'No configurable para este modelo')}</div>
                {savedKey.last_validated && (
                  <div>
                    <Text type="secondary">
                      Última validación: {new Date(savedKey.last_validated).toLocaleString('es-CL')}
                    </Text>
                  </div>
                )}
                {savedKey.validation_error && (
                  <Alert
                    message="Error de validación"
                    description={savedKey.validation_error}
                    type="error"
                    showIcon
                  />
                )}
              </Space>
            </div>
          ) : isEditing ? (
            <div>
              <Form layout="vertical">
                {savedKey && !replaceKey ? (
                  <Form.Item label="Clave API">
                    <Input value="••••••••••••" disabled />
                    <Text type="secondary">Clave guardada. Se conserva al cambiar el modelo o el razonamiento.</Text>
                    <Button type="link" onClick={() => setReplaceKey(true)}>Reemplazar clave API</Button>
                  </Form.Item>
                ) : (
                <Form.Item
                  label="Clave API"
                  help={
                    <a href={docUrl} target="_blank" rel="noopener noreferrer">
                      Obtener API key →
                    </a>
                  }
                >
                  <Input.Password
                    placeholder={placeholder}
                    value={apiKeyInput}
                    onChange={(e) => {
                      setApiKeyInput(e.target.value);
                      setValidationResults(prev => ({ ...prev, [key]: null }));
                    }}
                    prefix={<KeyOutlined />}
                    suffix={
                      validationResult === true ? (
                        <CheckCircleOutlined style={{ color: 'var(--color-success)' }} />
                      ) : validationResult === false ? (
                        <CloseCircleOutlined style={{ color: 'var(--color-error)' }} />
                      ) : null
                    }
                  />
                </Form.Item>

                )}

                <Form.Item
                  label="Modelo"
                  help="Seleccione el modelo que desea utilizar"
                >
                  <Select
                    placeholder="Seleccionar modelo"
                    value={selectedModel || undefined}
                    onChange={(value) => { setSelectedModel(value); setReasoningEffort(availableModels?.[key]?.find(m => m.value === value)?.reasoning_options ? 'low' : null); }}
                    options={availableModels?.[key] || []}
                    style={{ width: '100%' }}
                  />
                </Form.Item>

                <Form.Item label="Razonamiento" help="Un nivel mayor puede aumentar el consumo y el tiempo de respuesta.">
                  {reasoningOptions ? <Select aria-label="Razonamiento" value={reasoningEffort} onChange={setReasoningEffort} options={reasoningOptions.map(value => ({ value, label: REASONING_LABELS[value] || value }))} /> : <Text type="secondary">Este modelo no admite un nivel de razonamiento configurable en esta integración.</Text>}
                </Form.Item>
                <Space>
                  <Button
                    icon={<SafetyOutlined />}
                    onClick={() => handleValidate(key)}
                    loading={isValidating}
                    disabled={!apiKeyInput.trim()}
                  >
                    Validar
                  </Button>
                  <Button
                    type="primary"
                    onClick={() => handleSave(key)}
                    loading={isLoading}
                    disabled={((!savedKey || replaceKey) && validationResult !== true) || !selectedModel}
                  >
                    {savedKey ? 'Actualizar' : 'Guardar'}
                  </Button>
                  <Button onClick={handleCancel}>Cancelar</Button>
                </Space>
              </Form>
            </div>
          ) : null}

          {!savedKey && !isEditing && (
            <Button type="dashed" block onClick={() => handleEdit(key)}>
              Configurar {name}
            </Button>
          )}
        </Card>
      </Col>
    );
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Title level={2}>
          <KeyOutlined style={{ marginRight: '8px' }} />
          Configuración de LLM
        </Title>
        <Paragraph>
          Configure sus API keys para diferentes proveedores de modelos de lenguaje.
          Las API keys se almacenan de forma segura y encriptada.
        </Paragraph>

        <Alert
          message="Información de Seguridad"
          description="Sus API keys son encriptadas antes de almacenarse en la base de datos. Nunca compartiremos sus credenciales con terceros."
          type="info"
          showIcon
          style={{ marginTop: '16px' }}
        />
      </div>

      <Divider />

      <Spin spinning={isLoading && apiKeys.length === 0}>
        <Row gutter={[16, 16]}>
          {PROVIDERS.map(provider => renderProviderCard(provider))}
        </Row>
      </Spin>

      <Divider style={{ margin: '36px 0 24px 0' }} />

      {/* Skills Configuration Section */}
      <div style={{ marginBottom: '24px' }}>
        <Title level={3}>
          <RobotOutlined style={{ marginRight: '8px', color: '#1677ff' }} />
          Skills de IA del Equipo RPA
        </Title>
        <Paragraph type="secondary">
          Gestiona los agentes y directivas preconfiguradas que se ejecutan automáticamente en los proyectos y módulos del sistema.
        </Paragraph>

        <Card
          style={{
            borderColor: '#b7eb8f',
            background: 'linear-gradient(135deg, #f6ffed 0%, #ffffff 100%)'
          }}
        >
          <Row justify="space-between" align="middle" gutter={[16, 16]}>
            <Col xs={24} md={18}>
              <Space align="center" size="middle">
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    backgroundColor: '#52c41a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 24
                  }}
                >
                  <RobotOutlined />
                </div>
                <div>
                  <Space align="center">
                    <Title level={4} style={{ margin: 0 }}>
                      Skill: Revisor IA de Proyecto RPA
                    </Title>
                    <Tag color="success">Activa</Tag>
                    <Tag color="blue">v1.1.0</Tag>
                  </Space>
                  <Paragraph type="secondary" style={{ margin: '4px 0 0 0' }}>
                    Auditoría inteligente del estado real de proyectos: diagnóstico de salud, detección de cuellos de botella, plan de acción táctico y redacción de reporte al cliente.
                  </Paragraph>
                </div>
              </Space>
            </Col>

            <Col xs={24} md={6} style={{ textAlign: 'right' }}>
              <Button
                type="primary"
                icon={<SettingOutlined />}
                size="large"
                onClick={() => setSkillModalOpen(true)}
              >
                Configurar Skill
              </Button>
            </Col>
          </Row>
        </Card>
      </div>

      <SkillConfigModal
        visible={skillModalOpen}
        onClose={() => setSkillModalOpen(false)}
      />
    </div>
  );
};

export default LLMConfigPage;
