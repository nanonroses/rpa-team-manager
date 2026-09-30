import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Table,
  Row,
  Col,
  Statistic,
  Radio,
  Switch,
  Space,
  Typography,
  Progress,
  Tag,
  Button,
  Tooltip,
  theme,
} from 'antd';
import {
  ReloadOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  GlobalOutlined,
  PieChartOutlined,
} from '@ant-design/icons';
import { CostCenterBillingSummaryRow } from '@/types/costCenter';
import CostCenterTag from '@/components/costCenters/CostCenterTag';
import apiService from '@/services/api';

const { Text } = Typography;

interface CostCenterSummaryPanelProps {
  projectId?: number;
}

export const CostCenterSummaryPanel: React.FC<CostCenterSummaryPanelProps> = ({ projectId }) => {
  const { token } = theme.useToken();
  const isDark = document.documentElement.dataset.theme === 'dark' || token.colorBgBase === '#0F0F10' || token.colorBgContainer === '#171718';

  const [data, setData] = useState<CostCenterBillingSummaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [country, setCountry] = useState<string>('ALL');
  const [onlyRpa, setOnlyRpa] = useState<boolean>(true); // Default to true for the RPA lead!

  useEffect(() => {
    loadSummary();
  }, [country, onlyRpa, projectId]);

  const loadSummary = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (country !== 'ALL') params.country = country;
      if (onlyRpa) params.is_rpa = true;
      if (projectId) params.project_id = projectId;

      const result = await apiService.getCostCenterBillingSummary(params);
      setData(result);
    } catch (err) {
      console.error('Error al cargar resumen por CECO:', err);
    } finally {
      setLoading(false);
    }
  };

  // Aggregated totals
  const totals = useMemo(() => {
    return data.reduce(
      (acc, row) => {
        acc.allocated += Number(row.allocated_amount_clp || 0);
        acc.invoiced += Number(row.invoiced_amount_clp || 0);
        acc.paid += Number(row.paid_amount_clp || 0);
        acc.pendingInvoice += Number(row.pending_invoice_clp || 0);
        acc.pendingPayment += Number(row.pending_payment_clp || 0);
        return acc;
      },
      { allocated: 0, invoiced: 0, paid: 0, pendingInvoice: 0, pendingPayment: 0 }
    );
  }, [data]);

  const globalInvoicedPct = useMemo(() => {
    if (totals.allocated <= 0) return 0;
    return Math.min(100, Math.round((totals.invoiced / totals.allocated) * 100));
  }, [totals]);

  const globalCollectedPct = useMemo(() => {
    if (totals.invoiced <= 0) return 0;
    return Math.min(100, Math.round((totals.paid / totals.invoiced) * 100));
  }, [totals]);

  const formatCLP = (amount: number) => {
    return `$${Math.round(amount).toLocaleString('es-CL')} CLP`;
  };

  const columns = [
    {
      title: 'Centro de Costo',
      dataIndex: 'code',
      key: 'code',
      width: 170,
      render: (code: string, record: CostCenterBillingSummaryRow) => (
        <CostCenterTag
          code={code}
          name={record.name}
          country={record.country}
          isRpa={record.is_rpa}
        />
      ),
    },
    {
      title: 'Glosa / Área',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: CostCenterBillingSummaryRow) => (
        <div>
          <Text strong>{name}</Text>
          <div style={{ fontSize: 11, color: token.colorTextTertiary }}>
            {record.category} · {record.country}
          </div>
        </div>
      ),
    },
    {
      title: 'Monto Vendido',
      dataIndex: 'allocated_amount_clp',
      key: 'allocated_amount_clp',
      align: 'right' as const,
      sorter: (a: CostCenterBillingSummaryRow, b: CostCenterBillingSummaryRow) =>
        a.allocated_amount_clp - b.allocated_amount_clp,
      render: (v: number) => (
        <Text strong style={{ color: token.colorText }}>
          {formatCLP(v)}
        </Text>
      ),
    },
    {
      title: 'Facturado',
      dataIndex: 'invoiced_amount_clp',
      key: 'invoiced_amount_clp',
      align: 'right' as const,
      render: (v: number) => <Text style={{ color: '#1890ff' }}>{formatCLP(v)}</Text>,
    },
    {
      title: 'Cobrado (Pagado)',
      dataIndex: 'paid_amount_clp',
      key: 'paid_amount_clp',
      align: 'right' as const,
      render: (v: number) => <Text style={{ color: '#52c41a' }}>{formatCLP(v)}</Text>,
    },
    {
      title: 'Por Facturar',
      dataIndex: 'pending_invoice_clp',
      key: 'pending_invoice_clp',
      align: 'right' as const,
      render: (v: number) => (
        <Text style={{ color: v > 0 ? '#fa8c16' : '#8c8c8c' }}>{formatCLP(v)}</Text>
      ),
    },
    {
      title: 'Por Cobrar',
      dataIndex: 'pending_payment_clp',
      key: 'pending_payment_clp',
      align: 'right' as const,
      render: (v: number) => (
        <Text style={{ color: v > 0 ? '#f5222d' : '#8c8c8c' }}>{formatCLP(v)}</Text>
      ),
    },
    {
      title: 'Avance Facturación',
      key: 'progress',
      width: 150,
      render: (_: unknown, record: CostCenterBillingSummaryRow) => {
        const pct =
          record.allocated_amount_clp > 0
            ? Math.min(100, Math.round((record.invoiced_amount_clp / record.allocated_amount_clp) * 100))
            : record.invoiced_amount_clp > 0
            ? 100
            : 0;

        return (
          <Tooltip title={`Facturado: ${formatCLP(record.invoiced_amount_clp)} de ${formatCLP(record.allocated_amount_clp)}`}>
            <Progress
              percent={pct}
              size="small"
              status={pct >= 100 ? 'success' : pct > 0 ? 'active' : 'normal'}
              strokeColor={record.is_rpa ? '#722ed1' : '#1890ff'}
            />
          </Tooltip>
        );
      },
    },
  ];

  return (
    <div>
      {/* Header and Controls */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle" gutter={[12, 12]}>
          <Col xs={24} md={14}>
            <Space wrap size={16}>
              <Radio.Group
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                buttonStyle="solid"
                size="small"
              >
                <Radio.Button value="ALL">
                  <GlobalOutlined /> Todos los países
                </Radio.Button>
                <Radio.Button value="CHILE">🇨🇱 Chile</Radio.Button>
                <Radio.Button value="PERU">🇵🇪 Perú</Radio.Button>
                <Radio.Button value="USA">🇺🇸 USA</Radio.Button>
              </Radio.Group>

              <Space size={6}>
                <Switch checked={onlyRpa} onChange={(val) => setOnlyRpa(val)} size="small" />
                <Text strong style={{ fontSize: 13, color: onlyRpa ? (isDark ? '#69c0ff' : '#1d39c4') : token.colorTextSecondary }}>
                  ⭐ Mis CECOs RPA / IA
                </Text>
              </Space>
            </Space>
          </Col>

          <Col xs={24} md={10} style={{ textAlign: 'right' }}>
            <Button
              icon={<ReloadOutlined />}
              size="small"
              onClick={loadSummary}
              loading={loading}
            >
              Actualizar datos
            </Button>
          </Col>
        </Row>
      </Card>

      {/* KPI Cards */}
      <Row gutter={[12, 12]} style={{ marginBottom: 18 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small" style={{ borderLeft: '4px solid #1890ff' }}>
            <Statistic
              title="Vendido (Imputación CECO)"
              value={totals.allocated}
              formatter={(v) => formatCLP(Number(v))}
              prefix={<PieChartOutlined style={{ color: '#1890ff' }} />}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card size="small" style={{ borderLeft: '4px solid #722ed1' }}>
            <Statistic
              title="Facturado (% de lo vendido)"
              value={totals.invoiced}
              formatter={(v) => formatCLP(Number(v))}
              suffix={<Tag color="purple" style={{ marginLeft: 8 }}>{globalInvoicedPct}%</Tag>}
              prefix={<DollarOutlined style={{ color: '#722ed1' }} />}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card size="small" style={{ borderLeft: '4px solid #52c41a' }}>
            <Statistic
              title="Cobrado / Pagado"
              value={totals.paid}
              formatter={(v) => formatCLP(Number(v))}
              suffix={<Tag color="green" style={{ marginLeft: 8 }}>{globalCollectedPct}% cobrado</Tag>}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card size="small" style={{ borderLeft: '4px solid #fa8c16' }}>
            <Statistic
              title="Saldo Pendiente por Facturar"
              value={totals.pendingInvoice}
              formatter={(v) => formatCLP(Number(v))}
              valueStyle={{ color: totals.pendingInvoice > 0 ? '#fa8c16' : '#52c41a' }}
              prefix={<ClockCircleOutlined style={{ color: '#fa8c16' }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* Table Breakdown */}
      <Card
        title={
          <Space>
            <PieChartOutlined style={{ color: '#722ed1' }} />
            <span>Consolidado por Centro de Costo (Valores normalizados en CLP)</span>
          </Space>
        }
        size="small"
      >
        <Table
          dataSource={data}
          columns={columns}
          rowKey="cost_center_id"
          loading={loading}
          pagination={false}
          size="middle"
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row style={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#fafafa', fontWeight: 700 }}>
                <Table.Summary.Cell index={0} colSpan={2}>
                  TOTAL CONSOLIDADO
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  <Text strong>{formatCLP(totals.allocated)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2} align="right">
                  <Text strong style={{ color: '#1890ff' }}>{formatCLP(totals.invoiced)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={3} align="right">
                  <Text strong style={{ color: '#52c41a' }}>{formatCLP(totals.paid)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={4} align="right">
                  <Text strong style={{ color: '#fa8c16' }}>{formatCLP(totals.pendingInvoice)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="right">
                  <Text strong style={{ color: '#f5222d' }}>{formatCLP(totals.pendingPayment)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={6}>
                  <Progress percent={globalInvoicedPct} size="small" />
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Card>
    </div>
  );
};

export default CostCenterSummaryPanel;
