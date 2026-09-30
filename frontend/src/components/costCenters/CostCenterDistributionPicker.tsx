import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Table,
  Button,
  InputNumber,
  Input,
  Select,
  Space,
  Typography,
  Tooltip,
  Alert,
  Popconfirm,
  Badge,
  Row,
  Col,
  Tag,
  theme,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  PieChartOutlined,
} from '@ant-design/icons';
import { CostCenter, CostCenterCountry, ProjectCostCenterAllocation } from '@/types/costCenter';
import CostCenterTag from './CostCenterTag';
import apiService from '@/services/api';

const { Text, Title } = Typography;
const { Option } = Select;

const FALLBACK_COLORS = [
  '#13c2c2',
  '#2f54eb',
  '#722ed1',
  '#fa8c16',
  '#52c41a',
  '#1890ff',
  '#eb2f96',
  '#faad14',
];

export interface CostCenterDistributionPickerProps {
  totalAmount: number;
  currency?: string;
  allocations?: ProjectCostCenterAllocation[];
  onChange: (allocations: ProjectCostCenterAllocation[]) => void;
  defaultCountry?: CostCenterCountry;
  readOnly?: boolean;
  bordered?: boolean;
}

export const CostCenterDistributionPicker: React.FC<CostCenterDistributionPickerProps> = ({
  totalAmount = 0,
  currency = 'CLP',
  allocations = [],
  onChange,
  defaultCountry = 'CHILE',
  readOnly = false,
  bordered = true,
}) => {
  const { token } = theme.useToken();
  const isDark =
    typeof document !== 'undefined'
      ? document.documentElement.dataset.theme === 'dark' ||
        document.documentElement.getAttribute('data-theme') === 'dark' ||
        token.colorBgBase === '#0F0F10' ||
        token.colorBgContainer === '#171718' ||
        token.colorBgElevated === '#262626'
      : false;

  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [loadingCostCenters, setLoadingCostCenters] = useState<boolean>(false);
  const [selectedCountry, setSelectedCountry] = useState<CostCenterCountry>(defaultCountry);

  const safeAllocations = useMemo(() => (Array.isArray(allocations) ? allocations : []), [allocations]);

  const cecoColors = useMemo<Record<string, string>>(() => ({
    'RPA-L': '#13c2c2', // Cyan
    'RPA-P': isDark ? '#597ef7' : '#2f54eb', // Geekblue
    'RPA-S': isDark ? '#9254de' : '#722ed1', // Purple
    'P-RPA-L': '#13c2c2',
    'P-RPA-P': isDark ? '#597ef7' : '#2f54eb',
    'P-RPA-S': isDark ? '#9254de' : '#722ed1',
    'U-RPA-L': '#13c2c2',
    'U-RPA-P': isDark ? '#597ef7' : '#2f54eb',
    'U-RPA-S': isDark ? '#9254de' : '#722ed1',
  }), [isDark]);

  useEffect(() => {
    loadCostCenters();
  }, []);

  const loadCostCenters = async () => {
    try {
      setLoadingCostCenters(true);
      const res = await apiService.getCostCenters({ active_only: true });
      const list = Array.isArray(res) ? res : (res as any)?.data || [];
      setCostCenters(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Error al cargar centros de costo:', err);
      setCostCenters([]);
    } finally {
      setLoadingCostCenters(false);
    }
  };

  // Filter cost centers by selected country
  const filteredCostCenters = useMemo(() => {
    if (!Array.isArray(costCenters)) return [];
    return costCenters.filter((c) => !selectedCountry || c.country === selectedCountry);
  }, [costCenters, selectedCountry]);

  // Map of cost centers for easy lookup
  const costCenterMap = useMemo(() => {
    const map = new Map<number, CostCenter>();
    if (Array.isArray(costCenters)) {
      costCenters.forEach((c) => map.set(c.id, c));
    }
    return map;
  }, [costCenters]);

  // Calculate totals
  const totalAllocated = useMemo(() => {
    return safeAllocations.reduce((sum, item) => sum + (Number(item?.amount) || 0), 0);
  }, [safeAllocations]);

  const totalPercentage = useMemo(() => {
    if (totalAmount <= 0) return 0;
    return Math.round((totalAllocated / totalAmount) * 100 * 10) / 10;
  }, [totalAllocated, totalAmount]);

  const remainingAmount = useMemo(() => {
    return Math.max(0, totalAmount - totalAllocated);
  }, [totalAmount, totalAllocated]);

  const excessAmount = useMemo(() => {
    return Math.max(0, totalAllocated - totalAmount);
  }, [totalAmount, totalAllocated]);

  const isBalanced = useMemo(() => {
    if (totalAmount <= 0) return safeAllocations.length === 0;
    return Math.abs(totalAllocated - totalAmount) < 0.01;
  }, [totalAllocated, totalAmount, safeAllocations.length]);

  // Handler: Change row amount
  const handleAmountChange = (index: number, newAmount: number | null) => {
    const val = Math.max(0, newAmount || 0);
    const updated = [...safeAllocations];
    const item = { ...updated[index] };
    item.amount = val;
    item.percentage = totalAmount > 0 ? Math.round((val / totalAmount) * 100 * 100) / 100 : 0;
    updated[index] = item;
    onChange(updated);
  };

  // Handler: Change row percentage
  const handlePercentageChange = (index: number, newPercentage: number | null) => {
    const pct = Math.max(0, Math.min(100, newPercentage || 0));
    const updated = [...safeAllocations];
    const item = { ...updated[index] };
    item.percentage = pct;
    item.amount = totalAmount > 0 ? Math.round((pct / 100) * totalAmount * 100) / 100 : item.amount;
    updated[index] = item;
    onChange(updated);
  };

  // Handler: Change row cost center
  const handleCostCenterChange = (index: number, cecoId: number) => {
    const ceco = costCenterMap.get(cecoId);
    const updated = [...safeAllocations];
    updated[index] = {
      ...updated[index],
      cost_center_id: cecoId,
      cost_center_code: ceco?.code,
      cost_center_name: ceco?.name,
      country: ceco?.country,
      category: ceco?.category,
      is_rpa: ceco?.is_rpa,
    };
    onChange(updated);
  };

  // Handler: Change row description
  const handleDescriptionChange = (index: number, desc: string) => {
    const updated = [...safeAllocations];
    updated[index] = { ...updated[index], description: desc };
    onChange(updated);
  };

  // Handler: Add new row
  const handleAddRow = () => {
    // Default to the first available RPA CECO not yet used, or first in country
    const usedIds = new Set(safeAllocations.map((a) => a.cost_center_id));
    const candidate =
      filteredCostCenters.find((c) => c.is_rpa && !usedIds.has(c.id)) ||
      filteredCostCenters.find((c) => !usedIds.has(c.id)) ||
      filteredCostCenters[0];

    if (!candidate) return;

    const initialAmount = remainingAmount > 0 ? remainingAmount : 0;
    const initialPercentage = totalAmount > 0 ? Math.round((initialAmount / totalAmount) * 100 * 100) / 100 : 0;

    const newAlloc: ProjectCostCenterAllocation = {
      cost_center_id: candidate.id,
      cost_center_code: candidate.code,
      cost_center_name: candidate.name,
      country: candidate.country,
      category: candidate.category,
      is_rpa: candidate.is_rpa,
      amount: initialAmount,
      percentage: initialPercentage,
      currency: currency,
      description: '',
    };

    onChange([...safeAllocations, newAlloc]);
  };

  // Handler: Remove row
  const handleRemoveRow = (index: number) => {
    const updated = safeAllocations.filter((_, i) => i !== index);
    onChange(updated);
  };

  // Quick Preset Handlers
  const applyPreset100Projects = () => {
    const targetCode = selectedCountry === 'PERU' ? 'P-RPA-P' : selectedCountry === 'USA' ? 'U-RPA-P' : 'RPA-P';
    const ceco = costCenters.find((c) => c.code === targetCode) || costCenters.find((c) => c.is_rpa && c.code.endsWith('RPA-P'));
    if (!ceco) return;

    onChange([
      {
        cost_center_id: ceco.id,
        cost_center_code: ceco.code,
        cost_center_name: ceco.name,
        country: ceco.country,
        category: ceco.category,
        is_rpa: ceco.is_rpa,
        amount: totalAmount,
        percentage: 100,
        currency,
        description: '100% Desarrollo y Consultoría RPA',
      },
    ]);
  };

  const applyPreset100Support = () => {
    const targetCode = selectedCountry === 'PERU' ? 'P-RPA-S' : selectedCountry === 'USA' ? 'U-RPA-S' : 'RPA-S';
    const ceco = costCenters.find((c) => c.code === targetCode) || costCenters.find((c) => c.is_rpa && c.code.endsWith('RPA-S'));
    if (!ceco) return;

    onChange([
      {
        cost_center_id: ceco.id,
        cost_center_code: ceco.code,
        cost_center_name: ceco.name,
        country: ceco.country,
        category: ceco.category,
        is_rpa: ceco.is_rpa,
        amount: totalAmount,
        percentage: 100,
        currency,
        description: '100% Mesa de Ayuda y Soporte Continuo RPA',
      },
    ]);
  };

  const applyPresetRpaIntegral = () => {
    // 3 RPA CECOs: Licencias (40%), Soporte (50%), Proyectos (10%) or equal split
    const prefix = selectedCountry === 'PERU' ? 'P-' : selectedCountry === 'USA' ? 'U-' : '';
    const licCode = `${prefix}RPA-L`;
    const sopCode = `${prefix}RPA-S`;
    const proCode = `${prefix}RPA-P`;

    const cecoLic = costCenters.find((c) => c.code === licCode);
    const cecoSop = costCenters.find((c) => c.code === sopCode);
    const cecoPro = costCenters.find((c) => c.code === proCode);

    const items: ProjectCostCenterAllocation[] = [];

    if (cecoLic) {
      const amt = Math.round(totalAmount * 0.4 * 100) / 100;
      items.push({
        cost_center_id: cecoLic.id,
        cost_center_code: cecoLic.code,
        cost_center_name: cecoLic.name,
        country: cecoLic.country,
        category: cecoLic.category,
        is_rpa: cecoLic.is_rpa,
        amount: amt,
        percentage: 40,
        currency,
        description: 'Margen de Licencias de Software RPA',
      });
    }

    if (cecoSop) {
      const amt = Math.round(totalAmount * 0.5 * 100) / 100;
      items.push({
        cost_center_id: cecoSop.id,
        cost_center_code: cecoSop.code,
        cost_center_name: cecoSop.name,
        country: cecoSop.country,
        category: cecoSop.category,
        is_rpa: cecoSop.is_rpa,
        amount: amt,
        percentage: 50,
        currency,
        description: 'Mesa de Atención y Soporte de Incidentes',
      });
    }

    if (cecoPro) {
      const allocatedSoFar = items.reduce((s, it) => s + it.amount, 0);
      const amt = Math.max(0, Math.round((totalAmount - allocatedSoFar) * 100) / 100);
      items.push({
        cost_center_id: cecoPro.id,
        cost_center_code: cecoPro.code,
        cost_center_name: cecoPro.name,
        country: cecoPro.country,
        category: cecoPro.category,
        is_rpa: cecoPro.is_rpa,
        amount: amt,
        percentage: 10,
        currency,
        description: 'HH de Desarrollo y Consultoría RPA',
      });
    }

    if (items.length > 0) {
      onChange(items);
    }
  };

  // Columns for the allocations table
  const columns = [
    {
      title: 'Centro de Costo',
      dataIndex: 'cost_center_id',
      key: 'cost_center_id',
      width: 280,
      render: (_: any, record: ProjectCostCenterAllocation, index: number) => {
        if (readOnly) {
          return (
            <Space direction="vertical" size={2}>
              <CostCenterTag
                code={record.cost_center_code}
                name={record.cost_center_name}
                country={record.country}
                isRpa={record.is_rpa}
                showName
                showCountry
              />
            </Space>
          );
        }

        return (
          <Select
            value={record.cost_center_id}
            onChange={(val) => handleCostCenterChange(index, val)}
            style={{ width: '100%' }}
            loading={loadingCostCenters}
            placeholder="Seleccionar CECO"
            showSearch
            filterOption={(input, option) => {
              const label = String(option?.children || '').toLowerCase();
              return label.includes(input.toLowerCase());
            }}
          >
            {filteredCostCenters.map((ceco) => (
              <Option key={ceco.id} value={ceco.id}>
                <Space size={6}>
                  <CostCenterTag
                    code={ceco.code}
                    isRpa={ceco.is_rpa}
                    country={ceco.country}
                    size="small"
                  />
                  <span>{ceco.name}</span>
                </Space>
              </Option>
            ))}
          </Select>
        );
      },
    },
    {
      title: 'Monto Imputado',
      dataIndex: 'amount',
      key: 'amount',
      width: 170,
      render: (_: any, record: ProjectCostCenterAllocation, index: number) => {
        if (readOnly) {
          return (
            <Text strong style={{ fontSize: 14 }}>
              {currency} {record.amount?.toLocaleString()}
            </Text>
          );
        }

        return (
          <InputNumber
            value={record.amount}
            onChange={(val) => handleAmountChange(index, val)}
            formatter={(value) => `${currency} ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={(value) => value ? Number(value.replace(new RegExp(`\\${currency}\\s?|(,*)`, 'g'), '')) : 0}
            style={{ width: '100%' }}
            min={0}
            step={currency === 'CLP' ? 100000 : 500}
          />
        );
      },
    },
    {
      title: '% Porcentaje',
      dataIndex: 'percentage',
      key: 'percentage',
      width: 130,
      render: (_: any, record: ProjectCostCenterAllocation, index: number) => {
        if (readOnly) {
          return <Tag color="blue">{record.percentage || 0}%</Tag>;
        }

        return (
          <InputNumber
            value={record.percentage}
            onChange={(val) => handlePercentageChange(index, val)}
            min={0}
            max={100}
            step={5}
            formatter={(value) => `${value}%`}
            parser={(value) => value ? Number(value.replace('%', '')) : 0}
            style={{ width: '100%' }}
          />
        );
      },
    },
    {
      title: 'Concepto / Glosa',
      dataIndex: 'description',
      key: 'description',
      render: (_: any, record: ProjectCostCenterAllocation, index: number) => {
        if (readOnly) {
          return <Text type="secondary">{record.description || '-'}</Text>;
        }

        return (
          <Input
            value={record.description || ''}
            onChange={(e) => handleDescriptionChange(index, e.target.value)}
            placeholder="Ej: Licencias UiPath, 40 HH Desarrollo..."
          />
        );
      },
    },
    ...(!readOnly
      ? [
          {
            title: '',
            key: 'action',
            width: 50,
            render: (_: any, __: any, index: number) => (
              <Popconfirm
                title="¿Eliminar esta línea de imputación?"
                onConfirm={() => handleRemoveRow(index)}
                okText="Sí"
                cancelText="No"
              >
                <Button type="text" danger icon={<DeleteOutlined />} size="small" />
              </Popconfirm>
            ),
          },
        ]
      : []),
  ];

  const content = (
    <>
      {/* Header with Title and Presets */}
      <div style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle" gutter={[16, 12]}>
          <Col xs={24} sm={14}>
            <Space align="center" size={8}>
              <PieChartOutlined style={{ fontSize: 18, color: token.colorPrimary }} />
              <Title level={5} style={{ margin: 0 }}>
                Imputación por Centro de Costo (CECO)
              </Title>
              <Tooltip title="Permite asignar el monto total de venta a los diferentes centros de costo de RPA (Licencias, Proyectos, Soporte) u otras áreas de la empresa.">
                <InfoCircleOutlined style={{ color: token.colorTextTertiary, cursor: 'help' }} />
              </Tooltip>
            </Space>
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
              Define cómo se dividirá el ingreso del proyecto ({currency} {totalAmount.toLocaleString()}) para su posterior facturación y trazabilidad contable.
            </Text>
          </Col>

          {!readOnly && (
            <Col xs={24} sm={10} style={{ textAlign: 'right' }}>
              <Space wrap size={6}>
                <Select
                  value={selectedCountry}
                  onChange={(val) => setSelectedCountry(val)}
                  size="small"
                  style={{ width: 110 }}
                >
                  <Option value="CHILE">🇨🇱 Chile</Option>
                  <Option value="PERU">🇵🇪 Perú</Option>
                  <Option value="USA">🇺🇸 USA</Option>
                </Select>

                <Button
                  size="small"
                  icon={<PlusOutlined />}
                  type="primary"
                  ghost
                  onClick={handleAddRow}
                  disabled={loadingCostCenters}
                >
                  Agregar CECO
                </Button>
              </Space>
            </Col>
          )}
        </Row>
      </div>

      {/* Visual Stacked Progress Bar */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            height: 14,
            width: '100%',
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#f0f2f5',
            borderRadius: 7,
            overflow: 'hidden',
            display: 'flex',
            border: `1px solid ${token.colorBorderSecondary}`,
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)',
          }}
        >
          {safeAllocations.map((item, idx) => {
            const pct = item.percentage || (totalAmount > 0 ? (item.amount / totalAmount) * 100 : 0);
            const color =
              cecoColors[item.cost_center_code || ''] ||
              FALLBACK_COLORS[idx % FALLBACK_COLORS.length];

            if (pct <= 0) return null;

            return (
              <Tooltip
                key={idx}
                title={`${item.cost_center_code || 'CECO'} (${item.cost_center_name || ''}): ${currency} ${item.amount?.toLocaleString()} (${Math.round(pct)}%)`}
              >
                <div
                  style={{
                    width: `${Math.min(100, pct)}%`,
                    backgroundColor: color,
                    height: '100%',
                    transition: 'all 0.3s ease',
                  }}
                />
              </Tooltip>
            );
          })}
        </div>

        {/* Legend */}
        {safeAllocations.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8, fontSize: 11 }}>
            {safeAllocations.map((item, idx) => {
              const color =
                cecoColors[item.cost_center_code || ''] ||
                FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
              return (
                <div key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: color,
                      display: 'inline-block',
                    }}
                  />
                  <Text style={{ fontSize: 11 }}>
                    <strong>{item.cost_center_code}</strong>: {item.percentage || 0}% ({currency} {item.amount?.toLocaleString()})
                  </Text>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Live Balance Banner */}
      <div style={{ marginBottom: 16 }}>
        {isBalanced ? (
          <Alert
            type="success"
            showIcon
            icon={<CheckCircleOutlined />}
            message={
              <Space>
                <Text strong style={{ color: token.colorSuccess }}>
                  ✓ Total Imputado: {currency} {totalAllocated.toLocaleString()} de {currency} {totalAmount.toLocaleString()} (100% Equilibrado)
                </Text>
              </Space>
            }
            style={{ borderRadius: 6 }}
          />
        ) : excessAmount > 0 ? (
          <Alert
            type="error"
            showIcon
            icon={<ExclamationCircleOutlined />}
            message={
              <Space>
                <Text strong style={{ color: token.colorError }}>
                  ⚠️ El total imputado ({currency} {totalAllocated.toLocaleString()}) supera el monto de venta en {currency} {excessAmount.toLocaleString()} ({Math.round((excessAmount / totalAmount) * 100)}% excedente).
                </Text>
              </Space>
            }
            description="Por favor ajusta los montos o porcentajes para que la suma no exceda el precio del proyecto."
            style={{ borderRadius: 6 }}
          />
        ) : (
          <Alert
            type="warning"
            showIcon
            icon={<ExclamationCircleOutlined />}
            message={
              <Space>
                <Text strong style={{ color: token.colorWarning }}>
                  ⚠️ Pendiente por imputar: {currency} {remainingAmount.toLocaleString()} ({Math.max(0, 100 - totalPercentage)}% sin asignar)
                </Text>
                <Badge count={`${Math.round(totalPercentage)}% cubierto`} style={{ backgroundColor: token.colorWarning }} />
              </Space>
            }
            description="El monto del proyecto aún no está distribuido al 100%. Los hitos de pago se guiarán por esta imputación."
            style={{ borderRadius: 6 }}
          />
        )}
      </div>

      {/* 1-Click Quick Presets for RPA Lead */}
      {!readOnly && (
        <div
          style={{
            marginBottom: 16,
            padding: '10px 14px',
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : token.colorFillAlter,
            borderRadius: 6,
            border: `1px dashed ${token.colorBorderSecondary}`,
          }}
        >
          <Space align="center" wrap size={8}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <ThunderboltOutlined style={{ color: token.colorWarning, marginRight: 4 }} />
              Atajos Rápidos:
            </Text>
            <Button size="small" onClick={applyPreset100Projects}>
              ⚡ 100% RPA Proyectos
            </Button>
            <Button size="small" onClick={applyPresetRpaIntegral} type="primary" ghost>
              ⚡ RPA Integral (40% Lic + 50% Sop + 10% Proy)
            </Button>
            <Button size="small" onClick={applyPreset100Support}>
              ⚡ 100% RPA Soporte
            </Button>
          </Space>
        </div>
      )}

      {/* Allocations Table */}
      <Table
        dataSource={safeAllocations.map((a, i) => ({ ...a, key: i }))}
        columns={columns}
        pagination={false}
        size="small"
        bordered
        locale={{
          emptyText: (
            <div style={{ padding: '20px 0', textAlign: 'center' }}>
              <PieChartOutlined style={{ fontSize: 32, color: token.colorTextQuaternary || token.colorTextTertiary, marginBottom: 8 }} />
              <div style={{ color: token.colorTextSecondary }}>No hay centros de costos asignados a esta venta.</div>
              {!readOnly && (
                <div style={{ marginTop: 8 }}>
                  <Button type="primary" size="small" onClick={applyPresetRpaIntegral}>
                    Configurar Imputación RPA Típica
                  </Button>
                </div>
              )}
            </div>
          ),
        }}
      />
    </>
  );

  if (!bordered) {
    return <div style={{ padding: '4px 0' }}>{content}</div>;
  }

  return (
    <Card
      style={{
        borderRadius: 8,
        border: `1px solid ${token.colorBorderSecondary}`,
        boxShadow: isDark ? '0 2px 8px rgba(0, 0, 0, 0.4)' : '0 2px 8px rgba(0, 0, 0, 0.04)',
        backgroundColor: token.colorBgContainer,
      }}
      styles={{ body: { padding: 20 } }}
    >
      {content}
    </Card>
  );
};

export default CostCenterDistributionPicker;
