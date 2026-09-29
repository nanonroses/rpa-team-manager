import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Col, DatePicker, Empty, Row, Select, Space, Statistic, Table, Tabs, Typography } from 'antd';
import dayjs from 'dayjs';
import { apiService } from '@/services/api';

type Totals = {
  requests: number;
  input_tokens: number;
  output_tokens: number;
  cached_tokens: number;
  reasoning_tokens: number;
  cost_usd: number;
  unpriced: number;
  errors: number;
};

interface Usage {
  total: Totals;
  models: Array<Totals & { provider: string; model: string }>;
  recent: Array<{
    id: number;
    provider: string;
    model: string;
    operation: string;
    status: string;
    input_tokens: number | null;
    output_tokens: number | null;
    cost_usd: number | null;
    created_at: string;
  }>;
  tracking_since: string | null;
  prices: Array<{
    provider: string;
    model: string;
    label: string;
    rate: { input: number; output: number; cached: number; source: string; checked: string } | null;
  }>;
}

const usd = (n: number | null) =>
  n === null
    ? 'Sin estimar'
    : `US$ ${n.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`;

const tokens = (n: number | null) => (n === null ? 'No reportado' : n.toLocaleString('es-CL'));

const providers: Record<string, string> = {
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  claude: 'Anthropic',
  deepseek: 'DeepSeek'
};

const operationLabels: Record<string, string> = {
  key_validation: 'Validación de clave',
  quote_extraction: 'Extracción de cotización',
  completion: 'Generación / Asistente IA'
};

export function AIUsagePanel() {
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().startOf('month'), dayjs()]);
  const [preset, setPreset] = useState('month');
  const [data, setData] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const sequence = useRef(0);

  useEffect(() => {
    const id = ++sequence.current;
    setLoading(true);
    setError('');
    setData(null);
    const params = new URLSearchParams({
      start: range[0].startOf('day').toISOString(),
      end: range[1].add(1, 'day').startOf('day').toISOString()
    });
    apiService
      .get(`/llm-config/usage?${params}`)
      .then((result: any) => {
        if (sequence.current === id) setData(result as Usage);
      })
      .catch(() => {
        if (sequence.current === id) setError('No se pudo cargar el consumo. Vuelva a intentar.');
      })
      .finally(() => {
        if (sequence.current === id) setLoading(false);
      });
    return () => {
      sequence.current++;
    };
  }, [range, revision]);

  const usageColumns = [
    { title: 'Proveedor', dataIndex: 'provider', render: (p: string) => providers[p] || p },
    { title: 'Modelo', dataIndex: 'model' },
    { title: 'Solicitudes', dataIndex: 'requests' },
    { title: 'Entrada', dataIndex: 'input_tokens', render: tokens },
    { title: 'Salida', dataIndex: 'output_tokens', render: tokens },
    { title: 'Costo estimado', dataIndex: 'cost_usd', render: usd },
    { title: 'Sin estimar', dataIndex: 'unpriced' }
  ];

  return (
    <Card
      title="Consumo y gasto de IA"
      style={{ marginBottom: 24 }}
      extra={
        <Button onClick={() => setRevision(n => n + 1)} loading={loading}>
          Actualizar consumo
        </Button>
      }
    >
      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          aria-label="Período de consumo"
          value={preset}
          style={{ width: 170 }}
          onChange={value => {
            setPreset(value);
            const now = dayjs();
            setRange([
              value === 'today' ? now : value === '30' ? now.subtract(29, 'day') : now.startOf('month'),
              now
            ]);
          }}
          options={[
            { value: 'today', label: 'Hoy' },
            { value: 'month', label: 'Este mes' },
            { value: '30', label: 'Últimos 30 días' },
            { value: 'custom', label: 'Personalizado', disabled: true }
          ]}
        />
        <DatePicker.RangePicker
          value={range}
          allowClear={false}
          format="DD/MM/YYYY"
          onChange={value => {
            if (value?.[0] && value?.[1]) {
              setPreset('custom');
              setRange([value[0], value[1]]);
            }
          }}
        />
      </Space>
      <Typography.Paragraph type="secondary">
        Consumo de tu cuenta en esta plataforma. Período según la hora local. Costos estimados en USD con tarifas estándar
        de pago; no incluyen impuestos, créditos, planes gratuitos ni consumos externos. No es la factura del proveedor.
      </Typography.Paragraph>
      {error && (
        <Alert
          type="error"
          showIcon
          message={error}
          action={<Button onClick={() => setRevision(n => n + 1)}>Reintentar</Button>}
        />
      )}
      {data && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={12} lg={6}>
              <Statistic
                title={data.total.unpriced ? 'Costo conocido (parcial)' : 'Costo estimado del período'}
                value={data.total.cost_usd}
                formatter={() => usd(data.total.cost_usd)}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Statistic title="Tokens de entrada" value={data.total.input_tokens} />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Statistic title="Tokens de salida" value={data.total.output_tokens} />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Statistic title="Solicitudes" value={data.total.requests} />
            </Col>
          </Row>
          <Typography.Paragraph type="secondary">
            Entrada en caché: {tokens(data.total.cached_tokens)} · Razonamiento: {tokens(data.total.reasoning_tokens)}{' '}
            (incluido en salida) · Errores de API: {data.total.errors}
          </Typography.Paragraph>
          {!!data.total.unpriced && (
            <Alert
              style={{ marginBottom: 16 }}
              type="warning"
              showIcon
              message={`${data.total.unpriced} solicitudes sin costo estimable. El total es parcial; no se consideran gratuitas.`}
            />
          )}
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message={
              data.tracking_since
                ? `Registro habilitado desde ${dayjs(data.tracking_since.replace(' ', 'T') + 'Z').format(
                    'DD/MM/YYYY HH:mm'
                  )}. El consumo anterior no está disponible.`
                : 'El consumo comienza a registrarse desde esta actualización.'
            }
          />
          <Tabs
            items={[
              {
                key: 'usage',
                label: 'Consumo por modelo',
                children: (
                  <Table
                    size="small"
                    rowKey={r => `${r.provider}:${r.model}`}
                    columns={usageColumns}
                    dataSource={data.models}
                    scroll={{ x: 850 }}
                    locale={{ emptyText: <Empty description="Sin solicitudes registradas en este período" /> }}
                  />
                )
              },
              {
                key: 'prices',
                label: 'Tarifas de tokens',
                children: (
                  <>
                    <Typography.Paragraph>
                      USD por 1 millón de tokens. La tarifa se conserva con cada solicitud. Modelos sin tarifa verificada
                      registran tokens y dejan el costo pendiente.
                    </Typography.Paragraph>
                    <Table
                      size="small"
                      rowKey={r => `${r.provider}:${r.model}`}
                      dataSource={data.prices}
                      scroll={{ x: 800 }}
                      pagination={{ pageSize: 8 }}
                      columns={[
                        { title: 'Proveedor', dataIndex: 'provider', render: (p: string) => providers[p] || p },
                        { title: 'Modelo', dataIndex: 'label' },
                        ...(['input', 'output', 'cached'] as const).map((key, i) => ({
                          title: ['Entrada / ingress', 'Salida / output', 'Entrada en caché'][i],
                          key,
                          render: (_: unknown, r: Usage['prices'][number]) =>
                            r.rate ? usd(r.rate[key]) : 'Sin tarifa verificada'
                        })),
                        {
                          title: 'Fuente / revisión',
                          key: 'source',
                          render: (_: unknown, r: Usage['prices'][number]) =>
                            r.rate ? (
                              <a href={r.rate.source} target="_blank" rel="noreferrer">
                                {r.rate.checked}
                              </a>
                            ) : (
                              '—'
                            )
                        }
                      ]}
                    />
                  </>
                )
              },
              {
                key: 'requests',
                label: 'Últimas solicitudes',
                children: (
                  <Table
                    size="small"
                    rowKey="id"
                    dataSource={data.recent}
                    scroll={{ x: 950 }}
                    pagination={{ pageSize: 10 }}
                    columns={[
                      {
                        title: 'Fecha',
                        dataIndex: 'created_at',
                        render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm')
                      },
                      { title: 'Modelo', dataIndex: 'model' },
                      {
                        title: 'Uso',
                        dataIndex: 'operation',
                        render: (v: string) => operationLabels[v] || v
                      },
                      {
                        title: 'Estado API',
                        dataIndex: 'status',
                        render: (v: string) =>
                          ({ received: 'Respuesta recibida', error: 'Error', pending: 'Pendiente / interrumpida' }[v] || v)
                      },
                      { title: 'Entrada', dataIndex: 'input_tokens', render: tokens },
                      { title: 'Salida', dataIndex: 'output_tokens', render: tokens },
                      { title: 'Costo estimado', dataIndex: 'cost_usd', render: usd }
                    ]}
                    footer={() => 'Hasta 50 solicitudes recientes del período. Los totales incluyen todas.'}
                  />
                )
              }
            ]}
          />
        </>
      )}
      {loading && <Typography.Text type="secondary">Cargando consumo…</Typography.Text>}
    </Card>
  );
}
export default AIUsagePanel;
