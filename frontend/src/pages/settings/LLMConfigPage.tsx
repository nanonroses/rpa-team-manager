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
  SafetyOutlined
} from '@ant-design/icons';
import { useLLMConfigStore, LLMProvider } from '@/store/llmConfigStore';

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
    description: 'GPT-4, GPT-3.5, y otros modelos de OpenAI',
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
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [validationResults, setValidationResults] = useState<Record<LLMProvider, boolean | null>>({
    openai: null,
    claude: null,
    gemini: null,
    deepseek: null
  });

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
    if (!apiKeyInput.trim()) {
      message.warning('Por favor ingrese una API key');
      return;
    }

    if (validationResults[provider] !== true) {
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
        await updateApiKey(provider, apiKeyInput, selectedModel);
        message.success('API key actualizada exitosamente');
      } else {
        await saveApiKey(provider, apiKeyInput, selectedModel);
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
    setValidationResults(prev => ({ ...prev, [provider]: null }));
  };

  const handleCancel = () => {
    setEditingProvider(null);
    setApiKeyInput('');
    setSelectedModel('');
    setValidationResults(prev => ({
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
                  <Text strong>API Key: </Text>
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
                    size="small"
                  />
                )}
              </Space>
            </div>
          ) : (
            <div>
              <Form layout="vertical">
                <Form.Item
                  label="API Key"
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
                        <CheckCircleOutlined style={{ color: '#52c41a' }} />
                      ) : validationResult === false ? (
                        <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                      ) : null
                    }
                  />
                </Form.Item>

                <Form.Item
                  label="Modelo"
                  help="Seleccione el modelo que desea utilizar"
                >
                  <Select
                    placeholder="Seleccionar modelo"
                    value={selectedModel || undefined}
                    onChange={(value) => setSelectedModel(value)}
                    options={availableModels?.[key] || []}
                    style={{ width: '100%' }}
                  />
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
                    disabled={validationResult !== true || !selectedModel}
                  >
                    {savedKey ? 'Actualizar' : 'Guardar'}
                  </Button>
                  <Button onClick={handleCancel}>Cancelar</Button>
                </Space>
              </Form>
            </div>
          )}

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
    </div>
  );
};

export default LLMConfigPage;
