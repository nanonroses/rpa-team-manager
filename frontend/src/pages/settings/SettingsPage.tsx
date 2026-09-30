import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Button,
  InputNumber,
  Typography,
  Space,
  message,
  Divider,
  Row,
  Col,
  Alert
} from 'antd';
import { BankOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { apiService } from '@/services/api';
import { TeamCostsCard } from '@/components/settings/TeamCostsCard';
import { CostCentersDirectoryCard } from '@/components/settings/CostCentersDirectoryCard';

const { Title, Text } = Typography;

interface GlobalSettings {
  usd_rate: number;
  uf_rate: number;
  monthly_hours: number;
  weekly_hours: number;
}

export const SettingsPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<GlobalSettings>({
    usd_rate: 925.50,
    uf_rate: 37250.85,
    monthly_hours: 168,
    weekly_hours: 42
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await apiService.getGlobalSettings();
      const settingsData = response.data || response;
      setSettings(settingsData);
      form.setFieldsValue(settingsData);
    } catch (error) {
      console.error('Error loading settings:', error);
      message.error('Error al cargar configuraciones');
      // Usar valores por defecto si falla la carga
      form.setFieldsValue(settings);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (values: GlobalSettings) => {
    try {
      setLoading(true);
      await apiService.updateGlobalSettings(values);
      setSettings(values);
      message.success('Configuraciones actualizadas exitosamente');
    } catch (error) {
      console.error('Error saving settings:', error);
      message.error('Error al guardar configuraciones');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>⚙️ Configuraciones Globales</Title>
      <Text type="secondary">
        Configuraciones que afectan los cálculos financieros y de tiempo en todos los proyectos.
      </Text>

      <Row gutter={24} style={{ marginTop: '24px' }}>
        <Col xs={24} lg={16}>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSave}
            initialValues={settings}
          >
            {/* Tipos de Cambio */}
            <Card 
              title={<><BankOutlined /> Tipos de Cambio</>} 
              style={{ marginBottom: '24px' }}
            >
              <Alert
                message="Actualizar mensualmente"
                description="Estos valores se utilizan para convertir monedas en los cálculos ROI."
                type="info"
                style={{ marginBottom: '16px' }}
              />
              
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="Dólar USD a CLP"
                    name="usd_rate"
                    rules={[
                      { required: true, message: 'Ingrese el tipo de cambio USD' },
                      { type: 'number', min: 0, message: 'Debe ser mayor a 0' }
                    ]}
                  >
                    <InputNumber
                      placeholder="925.50"
                      prefix="$"
                      suffix="CLP"
                      style={{ width: '100%' }}
                      precision={2}
                      step={0.1}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="UF a CLP"
                    name="uf_rate"
                    rules={[
                      { required: true, message: 'Ingrese el valor de la UF' },
                      { type: 'number', min: 0, message: 'Debe ser mayor a 0' }
                    ]}
                  >
                    <InputNumber
                      placeholder="37,250.85"
                      prefix="$"
                      suffix="CLP"
                      style={{ width: '100%' }}
                      precision={2}
                      step={0.01}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* Configuración Laboral */}
            <Card 
              title={<><ClockCircleOutlined /> Configuración Laboral</>}
              style={{ marginBottom: '24px' }}
            >
              <Alert
                message="Chile: 42 horas semanales = 168 horas mensuales"
                description="Estos valores se usan para calcular el costo por hora de los empleados."
                type="info"
                style={{ marginBottom: '16px' }}
              />
              
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="Horas Semanales"
                    name="weekly_hours"
                    rules={[
                      { required: true, message: 'Ingrese las horas semanales' },
                      { type: 'number', min: 1, max: 168, message: 'Entre 1 y 168 horas' }
                    ]}
                  >
                    <InputNumber
                      placeholder="42"
                      suffix="horas"
                      style={{ width: '100%' }}
                      min={1}
                      max={168}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="Horas Mensuales"
                    name="monthly_hours"
                    rules={[
                      { required: true, message: 'Ingrese las horas mensuales' },
                      { type: 'number', min: 1, message: 'Debe ser mayor a 0' }
                    ]}
                  >
                    <InputNumber
                      placeholder="168"
                      suffix="horas"
                      style={{ width: '100%' }}
                      min={1}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Form.Item>
              <Space>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  loading={loading}
                  size="large"
                >
                  Guardar Configuraciones
                </Button>
                <Button 
                  onClick={() => form.resetFields()} 
                  size="large"
                >
                  Restaurar
                </Button>
              </Space>
            </Form.Item>
          </Form>

          <TeamCostsCard />
          <CostCentersDirectoryCard />
        </Col>

        <Col xs={24} lg={8}>
          <Card title="📊 Información">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong>Última actualización:</Text>
                <br />
                <Text type="secondary">18 de Agosto, 2025</Text>
              </div>
              
              <Divider />
              
              <div>
                <Text strong>Cálculos automáticos:</Text>
                <br />
                <Text type="secondary">
                  • Valor HH = Costo empresa mensual ÷ {settings.monthly_hours}h
                </Text>
                <br />
                <Text type="secondary">
                  • ROI = (Precio venta - Costo real) ÷ Costo real × 100
                </Text>
                <br />
                <Text type="secondary">
                  • Eficiencia = Horas planificadas ÷ Horas reales × 100
                </Text>
              </div>

              <Divider />

              <div>
                <Text strong>Conversiones:</Text>
                <br />
                <Text type="secondary">
                  USD ${settings.usd_rate.toLocaleString()} = $1 USD
                </Text>
                <br />
                <Text type="secondary">
                  UF ${settings.uf_rate.toLocaleString()} = 1 UF
                </Text>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};