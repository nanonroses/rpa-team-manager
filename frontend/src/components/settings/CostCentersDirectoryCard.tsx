import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Table,
  Typography,
  Tag,
  Space,
  Input,
  Radio,
  Switch,
  Row,
  Col,
  Statistic,
  Badge,
  theme,
} from 'antd';
import {
  ApartmentOutlined,
  SearchOutlined,
  StarFilled,
  GlobalOutlined,
} from '@ant-design/icons';
import { CostCenter } from '@/types/costCenter';
import CostCenterTag from '@/components/costCenters/CostCenterTag';
import apiService from '@/services/api';

const { Text, Paragraph } = Typography;

export const CostCentersDirectoryCard: React.FC = () => {
  const { token } = theme.useToken();
  const isDark = typeof document !== 'undefined' && (
    document.documentElement.dataset.theme === 'dark' ||
    token.colorBgBase === '#0F0F10' ||
    token.colorBgContainer === '#171718'
  );

  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string>('ALL');
  const [onlyRpa, setOnlyRpa] = useState<boolean>(false);
  const [searchText, setSearchText] = useState<string>('');

  useEffect(() => {
    loadCostCenters();
  }, []);

  const loadCostCenters = async () => {
    try {
      setLoading(true);
      const res = await apiService.getCostCenters();
      const list = Array.isArray(res) ? res : (res as any)?.data || [];
      setCostCenters(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Error al cargar centros de costos:', err);
      setCostCenters([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    if (!Array.isArray(costCenters)) return [];
    return costCenters.filter((item) => {
      if (selectedCountry !== 'ALL' && item.country !== selectedCountry) {
        return false;
      }
      if (onlyRpa && !item.is_rpa) {
        return false;
      }
      if (searchText.trim()) {
        const query = searchText.toLowerCase();
        const matchesCode = item.code.toLowerCase().includes(query);
        const matchesName = item.name.toLowerCase().includes(query);
        const matchesCategory = item.category.toLowerCase().includes(query);
        return matchesCode || matchesName || matchesCategory;
      }
      return true;
    });
  }, [costCenters, selectedCountry, onlyRpa, searchText]);

  const totalRpa = useMemo(() => costCenters.filter((c) => c.is_rpa).length, [costCenters]);
  const totalChile = useMemo(() => costCenters.filter((c) => c.country === 'CHILE').length, [costCenters]);
  const totalPeru = useMemo(() => costCenters.filter((c) => c.country === 'PERU').length, [costCenters]);
  const totalUsa = useMemo(() => costCenters.filter((c) => c.country === 'USA').length, [costCenters]);

  const countryFlags: Record<string, string> = {
    CHILE: '🇨🇱 Chile',
    PERU: '🇵🇪 Perú',
    USA: '🇺🇸 USA',
  };

  const columns = [
    {
      title: 'Código CECO',
      dataIndex: 'code',
      key: 'code',
      width: 160,
      render: (_: string, record: CostCenter) => (
        <CostCenterTag
          code={record.code}
          name={record.name}
          country={record.country}
          isRpa={record.is_rpa}
        />
      ),
    },
    {
      title: 'Nombre / Glosa',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: CostCenter) => (
        <Space>
          <Text strong>{text}</Text>
          {record.is_rpa && (
            <Tag color="cyan" style={{ fontSize: 11 }}>
              <StarFilled style={{ color: '#13c2c2', marginRight: 3 }} /> RPA / IA
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'País',
      dataIndex: 'country',
      key: 'country',
      width: 130,
      render: (country: string) => countryFlags[country] || country,
    },
    {
      title: 'Categoría',
      dataIndex: 'category',
      key: 'category',
      width: 160,
      render: (category: string) => <Tag>{category}</Tag>,
    },
    {
      title: 'Estado',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (isActive: boolean) => (
        <Badge
          status={isActive ? 'success' : 'default'}
          text={isActive ? 'Activo' : 'Inactivo'}
        />
      ),
    },
  ];

  return (
    <Card
      title={
        <Space>
          <ApartmentOutlined style={{ color: '#1890ff' }} />
          <span>Catálogo de Centros de Costos (CECOs)</span>
        </Space>
      }
      style={{ marginBottom: 24 }}
      styles={{ body: { padding: 24 } }}
    >
      <Paragraph type="secondary">
        Directorio oficial de los 28 Centros de Costos corporativos en Chile, Perú y USA. Se utilizan
        para imputar el margen de licencias, horas de desarrollo y soporte desde el inicio de cada venta.
      </Paragraph>

      {/* KPI Counters */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6}>
          <Card
            size="small"
            style={{
              backgroundColor: isDark ? 'rgba(47, 84, 235, 0.12)' : '#f0f5ff',
              borderColor: isDark ? 'rgba(47, 84, 235, 0.35)' : '#adc6ff',
            }}
          >
            <Statistic
              title={<span style={{ color: isDark ? token.colorTextSecondary : undefined }}>Mis CECOs RPA / IA</span>}
              value={totalRpa}
              valueStyle={{ color: isDark ? '#85a5ff' : '#1d39c4', fontWeight: 700 }}
              prefix={<StarFilled style={{ color: '#faad14' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Chile" value={totalChile} prefix="🇨🇱" />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Perú" value={totalPeru} prefix="🇵🇪" />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="USA" value={totalUsa} prefix="🇺🇸" />
          </Card>
        </Col>
      </Row>

      {/* Filters Toolbar */}
      <div style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle" gutter={[12, 12]}>
          <Col xs={24} md={14}>
            <Space wrap size={12}>
              <Radio.Group
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                buttonStyle="solid"
                size="small"
              >
                <Radio.Button value="ALL">
                  <GlobalOutlined /> Todos (28)
                </Radio.Button>
                <Radio.Button value="CHILE">🇨🇱 Chile (13)</Radio.Button>
                <Radio.Button value="PERU">🇵🇪 Perú (8)</Radio.Button>
                <Radio.Button value="USA">🇺🇸 USA (7)</Radio.Button>
              </Radio.Group>

              <Space size={6} style={{ marginLeft: 8 }}>
                <Switch
                  checked={onlyRpa}
                  onChange={(val) => setOnlyRpa(val)}
                  size="small"
                />
                <Text style={{ fontSize: 13 }}>Solo RPA / IA</Text>
              </Space>
            </Space>
          </Col>

          <Col xs={24} md={10} style={{ textAlign: 'right' }}>
            <Input
              placeholder="Buscar por código, nombre o categoría..."
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              style={{ width: '100%', maxWidth: 280 }}
            />
          </Col>
        </Row>
      </div>

      {/* Table */}
      <Table
        dataSource={filteredData}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{ pageSize: 10, showSizeChanger: true }}
      />
    </Card>
  );
};

export default CostCentersDirectoryCard;
