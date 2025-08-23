import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Form, 
  Input, 
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
import { DollarOutlined, BankOutlined, ClockCircleOutlined, TeamOutlined } from '@ant-design/icons';
import { apiService } from '@/services/api';

const { Title, Text } = Typography;

interface GlobalSettings {
  usd_rate: number;
  uf_rate: number;
  monthly_hours: number;
  weekly_hours: number;
}

interface TeamSalarySettings {
  team_lead_salary: number;
  rpa_developer_salary: number;
  it_support_salary: number;
  rpa_operations_salary: number;
}

export const SettingsPage: React.FC = () => {
  const [form] = Form.useForm();
  const [salaryForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [settings, setSettings] = useState<GlobalSettings>({
    usd_rate: 925.50,
    uf_rate: 37250.85,
    monthly_hours: 176,
    weekly_hours: 44
  });
  const [teamSalaries, setTeamSalaries] = useState<TeamSalarySettings>({
    team_lead_salary: 0,
    rpa_developer_salary: 0,
    it_support_salary: 0,
    rpa_operations_salary: 0
  });

  useEffect(() => {
    loadSettings();
    loadTeamSalaries();
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

  const loadTeamSalaries = async () => {
    try {
      setSalaryLoading(true);
      const userCosts = await apiService.getUserCosts();
      
      // Mapear los costos por rol
      const salaryData = {
        team_lead_salary: userCosts.find(u => u.role === 'team_lead')?.monthly_cost || 0,
        rpa_developer_salary: userCosts.find(u => u.role === 'rpa_developer')?.monthly_cost || 0,
        it_support_salary: userCosts.find(u => u.role === 'it_support')?.monthly_cost || 0,
        rpa_operations_salary: userCosts.find(u => u.role === 'rpa_operations')?.monthly_cost || 0
      };
      
      setTeamSalaries(salaryData);
      salaryForm.setFieldsValue(salaryData);
    } catch (error) {
      console.error('Error loading team salaries:', error);
      message.error('Error al cargar salarios del equipo');
    } finally {
      setSalaryLoading(false);
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

  const handleSaveSalaries = async (values: TeamSalarySettings) => {
    try {
      setSalaryLoading(true);
      
      // Actualizar cada rol por separado
      const userCosts = await apiService.getUserCosts();
      
      // Team Lead
      const teamLead = userCosts.find(u => u.role === 'team_lead');
      if (teamLead && values.team_lead_salary > 0) {
        await apiService.createUserCost({
          user_id: teamLead.user_id,
          monthly_cost: values.team_lead_salary,
          effective_from: new Date().toISOString().split('T')[0]
        });
      }
      
      // RPA Developer
      const rpaDev = userCosts.find(u => u.role === 'rpa_developer');
      if (rpaDev && values.rpa_developer_salary > 0) {
        await apiService.createUserCost({
          user_id: rpaDev.user_id,
          monthly_cost: values.rpa_developer_salary,
          effective_from: new Date().toISOString().split('T')[0]
        });
      }
      
      // IT Support
      const itSupport = userCosts.find(u => u.role === 'it_support');
      if (itSupport && values.it_support_salary > 0) {
        await apiService.createUserCost({
          user_id: itSupport.user_id,
          monthly_cost: values.it_support_salary,
          effective_from: new Date().toISOString().split('T')[0]
        });
      }
      
      // RPA Operations
      const rpaOps = userCosts.find(u => u.role === 'rpa_operations');
      if (rpaOps && values.rpa_operations_salary > 0) {
        await apiService.createUserCost({
          user_id: rpaOps.user_id,
          monthly_cost: values.rpa_operations_salary,
          effective_from: new Date().toISOString().split('T')[0]
        });
      }
      
      setTeamSalaries(values);
      message.success('Salarios del equipo actualizados exitosamente');
      
      // Recargar los datos para mostrar los nuevos valores
      await loadTeamSalaries();
      
    } catch (error) {
      console.error('Error saving team salaries:', error);
      message.error('Error al guardar salarios del equipo');
    } finally {
      setSalaryLoading(false);
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
                message="Chile: 44 horas semanales = 176 horas mensuales"
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
                      placeholder="44"
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
                      placeholder="176"
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

          {/* Configuración de Salarios del Equipo */}
          <Form
            form={salaryForm}
            layout="vertical"
            onFinish={handleSaveSalaries}
            initialValues={teamSalaries}
          >
            <Card 
              title={<><TeamOutlined /> Salarios del Equipo</>}
              style={{ marginBottom: '24px' }}
            >
              <Alert
                message="Solo para Team Lead"
                description="Configura los salarios mensuales de cada rol del equipo. Se calcularán automáticamente los costos por hora."
                type="warning"
                style={{ marginBottom: '16px' }}
              />
              
              <Row gutter={16}>
                <Col xs={24} sm={12} lg={6}>
                  <Form.Item
                    label="Team Lead"
                    name="team_lead_salary"
                    rules={[
                      { type: 'number', min: 0, message: 'Debe ser mayor o igual a 0' }
                    ]}
                  >
                    <InputNumber
                      placeholder="2,500,000"
                      prefix="$"
                      suffix="CLP"
                      style={{ width: '100%' }}
                      precision={0}
                      step={50000}
                      formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={value => value!.replace(/\$\s?|(,*)/g, '')}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Form.Item
                    label="RPA Developer"
                    name="rpa_developer_salary"
                    rules={[
                      { type: 'number', min: 0, message: 'Debe ser mayor o igual a 0' }
                    ]}
                  >
                    <InputNumber
                      placeholder="1,200,000"
                      prefix="$"
                      suffix="CLP"
                      style={{ width: '100%' }}
                      precision={0}
                      step={50000}
                      formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={value => value!.replace(/\$\s?|(,*)/g, '')}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Form.Item
                    label="RPA Operations"
                    name="rpa_operations_salary"
                    rules={[
                      { type: 'number', min: 0, message: 'Debe ser mayor o igual a 0' }
                    ]}
                  >
                    <InputNumber
                      placeholder="900,000"
                      prefix="$"
                      suffix="CLP"
                      style={{ width: '100%' }}
                      precision={0}
                      step={50000}
                      formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={value => value!.replace(/\$\s?|(,*)/g, '')}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Form.Item
                    label="Soporte TI"
                    name="it_support_salary"
                    rules={[
                      { type: 'number', min: 0, message: 'Debe ser mayor o igual a 0' }
                    ]}
                  >
                    <InputNumber
                      placeholder="700,000"
                      prefix="$"
                      suffix="CLP"
                      style={{ width: '100%' }}
                      precision={0}
                      step={50000}
                      formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={value => value!.replace(/\$\s?|(,*)/g, '')}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
                <Text strong>Cálculo automático de costo por hora:</Text>
                <br />
                <Text type="secondary">
                  • Team Lead: ${Math.round(teamSalaries.team_lead_salary / settings.monthly_hours).toLocaleString()}/hora
                </Text>
                <br />
                <Text type="secondary">
                  • RPA Developer: ${Math.round(teamSalaries.rpa_developer_salary / settings.monthly_hours).toLocaleString()}/hora
                </Text>
                <br />
                <Text type="secondary">
                  • RPA Operations: ${Math.round(teamSalaries.rpa_operations_salary / settings.monthly_hours).toLocaleString()}/hora
                </Text>
                <br />
                <Text type="secondary">
                  • Soporte TI: ${Math.round(teamSalaries.it_support_salary / settings.monthly_hours).toLocaleString()}/hora
                </Text>
              </div>
            </Card>

            <Form.Item>
              <Space>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  loading={salaryLoading}
                  size="large"
                  icon={<TeamOutlined />}
                >
                  Actualizar Salarios
                </Button>
                <Button 
                  onClick={() => salaryForm.resetFields()} 
                  size="large"
                >
                  Restaurar
                </Button>
              </Space>
            </Form.Item>
          </Form>
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
                  • Costo/hora empleado = Sueldo mensual ÷ {settings.monthly_hours}h
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