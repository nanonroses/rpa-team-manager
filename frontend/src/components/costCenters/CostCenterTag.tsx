import React from 'react';
import { Tag, Tooltip, theme } from 'antd';
import {
  SafetyCertificateOutlined,
  CodeOutlined,
  CustomerServiceOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';
import { CostCenter, CostCenterCountry } from '@/types/costCenter';

interface CostCenterTagProps {
  costCenter?: CostCenter | {
    id?: number;
    code: string;
    name?: string;
    country?: CostCenterCountry | string;
    category?: string;
    is_rpa?: boolean;
  } | null;
  code?: string;
  name?: string;
  country?: CostCenterCountry | string;
  isRpa?: boolean;
  showName?: boolean;
  showCountry?: boolean;
  size?: 'small' | 'default';
  className?: string;
}

export const CostCenterTag: React.FC<CostCenterTagProps> = ({
  costCenter,
  code: propCode,
  name: propName,
  country: propCountry,
  isRpa: propIsRpa,
  showName = false,
  showCountry = false,
  size = 'default',
  className,
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

  const code = costCenter?.code || propCode || '';
  const name = costCenter?.name || propName || '';
  const country = (costCenter?.country || propCountry || 'CHILE') as CostCenterCountry;
  const isRpa = costCenter?.is_rpa !== undefined ? costCenter.is_rpa : (propIsRpa !== undefined ? propIsRpa : code.includes('RPA'));

  if (!code) {
    return <Tag color="default" className={className}>Sin CECO</Tag>;
  }

  // Country Flag Emoji / Tag
  const countryFlag: Record<string, string> = {
    CHILE: '🇨🇱',
    PERU: '🇵🇪',
    USA: '🇺🇸',
  };

  // Determine styling based on CECO type
  // RPA-L (Licencias) -> Cyan / Teal
  // RPA-P (Proyectos) -> Indigo / Geekblue / Blue
  // RPA-S (Soporte) -> Purple / Magenta
  // Others -> Slate / Volcan / Default
  let icon = <ApartmentOutlined />;
  let borderStyle = isDark ? `1px solid ${token.colorBorderSecondary}` : '1px solid #d9d9d9';
  let bgStyle = isDark ? 'rgba(255, 255, 255, 0.04)' : '#fafafa';
  let textStyle = isDark ? token.colorTextSecondary : '#595959';

  if (code.endsWith('RPA-L') || code === 'RPA-L') {
    icon = <SafetyCertificateOutlined />;
    bgStyle = isDark ? 'rgba(19, 194, 194, 0.15)' : '#e6fffb';
    borderStyle = isDark ? '1px solid rgba(19, 194, 194, 0.35)' : '1px solid #87e8de';
    textStyle = isDark ? '#36cfc9' : '#006d75';
  } else if (code.endsWith('RPA-P') || code === 'RPA-P') {
    icon = <CodeOutlined />;
    bgStyle = isDark ? 'rgba(47, 84, 235, 0.15)' : '#f0f5ff';
    borderStyle = isDark ? '1px solid rgba(47, 84, 235, 0.35)' : '1px solid #adc6ff';
    textStyle = isDark ? '#85a5ff' : '#1d39c4';
  } else if (code.endsWith('RPA-S') || code === 'RPA-S') {
    icon = <CustomerServiceOutlined />;
    bgStyle = isDark ? 'rgba(114, 46, 209, 0.15)' : '#f9f0ff';
    borderStyle = isDark ? '1px solid rgba(114, 46, 209, 0.35)' : '1px solid #d3adf7';
    textStyle = isDark ? '#b37feb' : '#531dab';
  } else if (isRpa) {
    icon = <CodeOutlined />;
    bgStyle = isDark ? 'rgba(24, 144, 255, 0.15)' : '#e6f7ff';
    borderStyle = isDark ? '1px solid rgba(24, 144, 255, 0.35)' : '1px solid #91d5ff';
    textStyle = isDark ? '#69c0ff' : '#096dd9';
  }

  const tooltipTitle = (
    <div style={{ fontSize: 12 }}>
      <div style={{ fontWeight: 600 }}>{code} - {name}</div>
      <div>País: {countryFlag[country] || '🌐'} {country}</div>
      {isRpa && <div style={{ color: token.colorSuccess, marginTop: 2 }}>⭐ Centro de Costo RPA / IA</div>}
    </div>
  );

  return (
    <Tooltip title={tooltipTitle}>
      <Tag
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: size === 'small' ? '0 6px' : '2px 8px',
          fontSize: size === 'small' ? 11 : 12,
          fontWeight: 600,
          borderRadius: 4,
          backgroundColor: bgStyle,
          border: borderStyle,
          color: textStyle,
          cursor: 'pointer',
        }}
      >
        {showCountry && <span style={{ marginRight: 2 }}>{countryFlag[country] || '🌐'}</span>}
        {icon}
        <span>{code}</span>
        {showName && name && (
          <span style={{ fontWeight: 400, opacity: 0.85, marginLeft: 2 }}>
            - {name}
          </span>
        )}
      </Tag>
    </Tooltip>
  );
};

export default CostCenterTag;
