import type { ThemeConfig } from 'antd';

export type PaletteId = 'orange' | 'cobalt';

export interface ThemePalette {
  id: PaletteId;
  name: string;
  color: {
    primary: string;
    primaryHover: string;
    primaryActive: string;
    primaryBg: string;
    primaryBorder: string;
    
    success: string;        // Verde
    successHover: string;
    successBg: string;
    successBorder: string;
    
    warning: string;        // Ámbar
    warningHover: string;
    warningBg: string;
    warningBorder: string;
    
    error: string;          // Rojo
    errorHover: string;
    errorBg: string;
    errorBorder: string;
    
    info: string;           // Azul
    infoHover: string;
    infoBg: string;
    infoBorder: string;

    sky: string;            // Celeste
    skyHover: string;
    skyBg: string;
    skyBorder: string;
    
    text: string;           // Negro
    textSecondary: string;  // Gris
    textMuted: string;      // Gris suave
    
    canvas: string;         // Blanco suave
    surface: string;        // Blanco puro
    surfaceRaised: string;
    border: string;
    borderStrong: string;
  };
}

// 1. TEMA GUARDADO: Cobalt Slate (Neuro-Precision)
export const cobaltPalette: ThemePalette = {
  id: 'cobalt',
  name: 'Azul Cobalto & Slate',
  color: {
    primary: '#2563EB',
    primaryHover: '#1D4ED8',
    primaryActive: '#1E40AF',
    primaryBg: '#EFF6FF',
    primaryBorder: '#BFDBFE',
    
    success: '#059669',
    successHover: '#047857',
    successBg: '#ECFDF5',
    successBorder: '#A7F3D0',
    
    warning: '#D97706',
    warningHover: '#B45309',
    warningBg: '#FFFBEB',
    warningBorder: '#FDE68A',
    
    error: '#DC2626',
    errorHover: '#B91C1C',
    errorBg: '#FEF2F2',
    errorBorder: '#FECACA',
    
    info: '#4F46E5',
    infoHover: '#4338CA',
    infoBg: '#EEF2FF',
    infoBorder: '#C7D2FE',

    sky: '#0284C7',
    skyHover: '#0369A1',
    skyBg: '#F0F9FF',
    skyBorder: '#BAE6FD',
    
    text: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#64748B',
    
    canvas: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceRaised: '#F1F5F9',
    border: '#E2E8F0',
    borderStrong: '#CBD5E1',
  }
};

// 2. TEMA NUEVO: Solar Orange (Naranjo, Blanco, Verde, Azul, Celeste, Gris y Negro)
export const orangePalette: ThemePalette = {
  id: 'orange',
  name: 'Solar Orange & Blanco / Negro',
  color: {
    primary: '#EA580C',        // Naranjo principal vibrante pero profesional
    primaryHover: '#C2410C',
    primaryActive: '#9A3412',
    primaryBg: '#FFF7ED',
    primaryBorder: '#FFEDD5',
    
    success: '#16A34A',        // Verde para validaciones, logros y completados
    successHover: '#15803D',
    successBg: '#F0FDF4',
    successBorder: '#DCFCE7',
    
    warning: '#D97706',        // Ámbar para alertas moderadas
    warningHover: '#B45309',
    warningBg: '#FFFBEB',
    warningBorder: '#FEF3C7',
    
    error: '#DC2626',          // Rojo
    errorHover: '#B91C1C',
    errorBg: '#FEF2F2',
    errorBorder: '#FEE2E2',
    
    info: '#2563EB',           // Azul corporativo
    infoHover: '#1D4ED8',
    infoBg: '#EFF6FF',
    infoBorder: '#DBEAFE',

    sky: '#0284C7',            // Celeste
    skyHover: '#0369A1',
    skyBg: '#F0F9FF',
    skyBorder: '#E0F2FE',
    
    text: '#0A0A0A',           // Negro profundo para máxima legibilidad
    textSecondary: '#525252',  // Gris medio para descripciones
    textMuted: '#737373',      // Gris claro para datos secundarios
    
    canvas: '#FAFAFA',         // Blanco fondo equilibrado
    surface: '#FFFFFF',        // Blanco puro para tarjetas
    surfaceRaised: '#F5F5F5',  // Gris muy claro
    border: '#E5E5E5',         // Bordes limpios de 1px
    borderStrong: '#D4D4D4',
  }
};

// Tema actualmente activo por defecto (Orange)
export const activePalette = orangePalette;

export const designTokens = {
  color: activePalette.color,
  typography: {
    body: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    display: "'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
  },
  spacing: [4, 8, 12, 16, 20, 24, 32, 40, 48],
  radius: {
    small: 6,
    medium: 8,
    large: 12,
    extraLarge: 16,
    full: 9999,
  },
  elevation: {
    low: '0 1px 2px 0 rgba(0, 0, 0, 0.04), 0 1px 1px -1px rgba(0, 0, 0, 0.02)',
    medium: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.03)',
    high: '0 10px 15px -3px rgba(0, 0, 0, 0.06), 0 4px 6px -4px rgba(0, 0, 0, 0.03)',
  },
  focus: {
    outline: '2px solid #EA580C',
    ring: 'rgba(234, 88, 12, 0.16)',
  },
} as const;

export const getAntdTheme = (palette: ThemePalette = activePalette): ThemeConfig => ({
  token: {
    colorPrimary: palette.color.primary,
    colorSuccess: palette.color.success,
    colorWarning: palette.color.warning,
    colorError: palette.color.error,
    colorInfo: palette.color.info,
    colorText: palette.color.text,
    colorTextSecondary: palette.color.textSecondary,
    colorBgBase: palette.color.surface,
    colorBgLayout: palette.color.canvas,
    colorBorder: palette.color.border,
    colorBorderSecondary: palette.color.surfaceRaised,
    fontFamily: designTokens.typography.body,
    borderRadius: designTokens.radius.medium,
    borderRadiusSM: designTokens.radius.small,
    borderRadiusLG: designTokens.radius.large,
    controlHeight: 38,
    controlHeightSM: 32,
    controlHeightLG: 44,
    fontSize: 14,
    lineHeight: 1.5,
  },
  components: {
    Layout: {
      bodyBg: palette.color.canvas,
      headerBg: palette.color.surface,
      siderBg: palette.color.surface,
    },
    Menu: {
      itemBg: 'transparent',
      itemSelectedBg: palette.color.primaryBg,
      itemSelectedColor: palette.color.primary,
      itemHoverBg: palette.color.surfaceRaised,
      itemHoverColor: palette.color.text,
      itemBorderRadius: designTokens.radius.medium,
      itemHeight: 40,
      itemMarginInline: 12,
      subMenuItemBg: 'transparent',
    },
    Card: {
      borderRadiusLG: designTokens.radius.large,
      colorBorderSecondary: palette.color.border,
      paddingLG: 20,
    },
    Button: {
      borderRadius: designTokens.radius.medium,
      controlHeight: 38,
      fontWeight: 500, // Entre bold y normal
      defaultBorderColor: palette.color.border,
      defaultHoverBorderColor: palette.color.primary,
      defaultHoverColor: palette.color.primary,
      primaryShadow: '0 1px 2px 0 rgba(234, 88, 12, 0.25)',
    },
    Table: {
      borderRadius: designTokens.radius.medium,
      headerBg: palette.color.surfaceRaised,
      headerColor: palette.color.textSecondary,
      headerSplitColor: 'transparent',
      rowHoverBg: '#F5F5F5',
      borderColor: palette.color.border,
    },
    Input: {
      activeShadow: `0 0 0 3px ${designTokens.focus.ring}`,
      hoverBorderColor: palette.color.primaryBorder,
      activeBorderColor: palette.color.primary,
      borderRadius: designTokens.radius.medium,
    },
    Select: {
      borderRadius: designTokens.radius.medium,
      optionSelectedBg: palette.color.primaryBg,
      optionSelectedColor: palette.color.primary,
    },
    Tag: {
      borderRadiusSM: designTokens.radius.small,
    },
    Modal: {
      borderRadiusLG: designTokens.radius.large,
      headerBg: 'transparent',
      contentBg: palette.color.surface,
    },
    Popconfirm: {
      borderRadiusLG: designTokens.radius.medium,
    },
    Tabs: {
      itemColor: palette.color.textSecondary,
      itemSelectedColor: palette.color.primary,
      itemHoverColor: palette.color.text,
      inkBarColor: palette.color.primary,
      titleFontSize: 14,
    },
  },
});

export const antdTheme = getAntdTheme(orangePalette);
