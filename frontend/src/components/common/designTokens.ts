import type { ThemeConfig } from 'antd';

export const designTokens = {
  color: {
    primary: '#39745d',
    primaryHover: '#285742',
    primaryBg: '#edf4ef',
    success: '#3d7957',
    warning: '#aa7433',
    error: '#a95048',
    info: '#52778a',
    text: '#26332e',
    textSecondary: '#52615a',
    canvas: '#f5f6f2',
    surface: '#ffffff',
    border: '#e8ebe5',
  },
  typography: { body: "'DM Sans', 'Segoe UI', sans-serif", display: "'Manrope', 'DM Sans', sans-serif" },
  spacing: [4, 8, 12, 16, 20, 24, 32],
  radius: { small: 8, medium: 10, large: 13, extraLarge: 16 },
  elevation: {
    low: '0 2px 8px rgba(41, 58, 49, .045)',
    medium: '0 8px 24px rgba(41, 58, 49, .07)',
  },
  focus: { outline: '3px solid rgba(57, 116, 93, .62)', ring: 'rgba(57, 116, 93, .18)' },
} as const;

// Concrete colors let Ant Design generate its semantic palettes reliably.
export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: designTokens.color.primary,
    colorSuccess: designTokens.color.success,
    colorWarning: designTokens.color.warning,
    colorError: designTokens.color.error,
    colorInfo: designTokens.color.info,
    colorText: designTokens.color.text,
    colorTextSecondary: designTokens.color.textSecondary,
    colorBgBase: designTokens.color.surface,
    colorBgLayout: designTokens.color.canvas,
    colorBorder: designTokens.color.border,
    fontFamily: designTokens.typography.body,
    borderRadius: designTokens.radius.medium,
    controlHeight: 38,
    controlHeightSM: 30,
    controlHeightLG: 44,
  },
  components: {
    Layout: { bodyBg: designTokens.color.canvas, headerBg: designTokens.color.surface, siderBg: designTokens.color.surface },
    Menu: {
      itemBg: 'transparent',
      itemSelectedBg: designTokens.color.primaryBg,
      itemSelectedColor: designTokens.color.primaryHover,
      itemBorderRadius: designTokens.radius.small,
      itemHeight: 40,
    },
    Card: { borderRadiusLG: designTokens.radius.large },
    Button: { borderRadius: 9, controlHeight: 38 },
    Input: { activeShadow: `0 0 0 3px ${designTokens.focus.ring}` },
    Modal: { borderRadiusLG: 14 },
    Popconfirm: { borderRadiusLG: 12 },
  },
};
