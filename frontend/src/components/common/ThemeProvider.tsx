import React, { createContext, useContext, useLayoutEffect, useMemo, useState } from 'react';
import { App, ConfigProvider, Select, theme } from 'antd';
import esES from 'antd/locale/es_ES';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { antdTheme, orangePalette, cobaltPalette, ThemePalette } from './designTokens';

dayjs.locale('es');
export type ThemePreference = 'light' | 'dark' | 'system';
export type PalettePreference = 'orange' | 'cobalt';

const storageKey = 'rpa-theme';
const paletteStorageKey = 'rpa-palette';

interface ThemeContextType {
  preference: ThemePreference;
  setPreference: (value: ThemePreference) => void;
  palette: PalettePreference;
  setPalette: (value: PalettePreference) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  preference: 'system',
  setPreference: () => {},
  palette: 'orange',
  setPalette: () => {},
});

export function ThemeProvider({ children }: React.PropsWithChildren) {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved === 'dark' || saved === 'light' ? saved : 'system';
    } catch { return 'system'; }
  });

  const [palette, setPalette] = useState<PalettePreference>(() => {
    try {
      const saved = localStorage.getItem(paletteStorageKey);
      return saved === 'cobalt' || saved === 'orange' ? saved : 'orange';
    } catch { return 'orange'; }
  });

  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const dark = preference === 'dark' || (preference === 'system' && systemDark);
  
  const currentPalette: ThemePalette = palette === 'cobalt' ? cobaltPalette : orangePalette;

  const config = useMemo(() => ({
    ...antdTheme,
    algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      ...antdTheme.token,
      colorPrimary: currentPalette.color.primary,
      colorSuccess: currentPalette.color.success,
      colorWarning: currentPalette.color.warning,
      colorError: currentPalette.color.error,
      colorInfo: currentPalette.color.info,
      ...(dark ? {
        colorText: '#F5F5F5',
        colorTextSecondary: '#A3A3A3',
        colorTextTertiary: '#737373',
        colorBgBase: '#0F0F10',
        colorBgContainer: '#171718',
        colorBgElevated: '#262626',
        colorBgLayout: '#0A0A0A',
        colorBorder: '#262626',
        colorBorderSecondary: '#333333',
        colorTextPlaceholder: '#737373',
        colorTextDisabled: '#D4D4D4',
        colorPrimaryBg: palette === 'orange' ? '#43140730' : '#1E293B',
        colorPrimaryText: palette === 'orange' ? '#FB923C' : '#60A5FA',
        colorLink: palette === 'orange' ? '#FB923C' : '#60A5FA',
        colorLinkHover: palette === 'orange' ? '#FDBA74' : '#93C5FD',
        colorTextLightSolid: '#FFFFFF',
      } : {
        colorText: currentPalette.color.text,
        colorTextSecondary: currentPalette.color.textSecondary,
        colorTextPlaceholder: currentPalette.color.textMuted,
        colorBorder: currentPalette.color.border,
      }),
    },
    components: {
      ...antdTheme.components,
      ...(dark ? {
        Layout: {
          bodyBg: '#0A0A0A',
          headerBg: '#171718',
          siderBg: '#171718',
        },
        Menu: {
          ...antdTheme.components?.Menu,
          itemColor: '#A3A3A3',
          itemSelectedBg: palette === 'orange' ? '#43140740' : '#1E293B',
          itemSelectedColor: palette === 'orange' ? '#FB923C' : '#60A5FA',
          itemHoverBg: '#262626',
          itemHoverColor: '#F5F5F5',
        },
        Table: {
          ...antdTheme.components?.Table,
          headerBg: '#1E1E20',
          headerColor: '#A3A3A3',
          rowHoverBg: '#202022',
          borderColor: '#262626',
        },
        Card: {
          ...antdTheme.components?.Card,
          colorBorderSecondary: '#262626',
        },
        Button: {
          ...antdTheme.components?.Button,
          defaultBorderColor: '#38383E',
          defaultHoverBorderColor: palette === 'orange' ? '#FB923C' : '#3B82F6',
          borderColorDisabled: '#38383E',
        },
        Modal: {
          ...antdTheme.components?.Modal,
          headerBg: 'transparent',
          contentBg: '#171718',
          footerBg: 'transparent',
        },
        Drawer: {
          ...antdTheme.components?.Drawer,
          colorBgElevated: '#171718',
        },
      } : {}),
    },
  }), [dark, palette, currentPalette]);

  useLayoutEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.dataset.palette = palette;
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    try {
      localStorage.setItem(storageKey, preference);
      localStorage.setItem(paletteStorageKey, palette);
    } catch { /* Storage can be disabled. */ }
    ConfigProvider.config({ holderRender: (node) => <ConfigProvider theme={config} locale={esES} modal={{ closable: { 'aria-label': 'Cerrar' } }}>{node}</ConfigProvider> });
  }, [dark, preference, palette, config]);

  return (
    <ThemeContext.Provider value={{ preference, setPreference, palette, setPalette }}>
      <ConfigProvider theme={config} locale={esES} modal={{ closable: { 'aria-label': 'Cerrar' } }}>
        <App>{children}</App>
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}

export function ThemeSelector() {
  const { preference, setPreference } = useContext(ThemeContext);
  return (
    <Select
      className="theme-selector"
      aria-label="Apariencia"
      value={preference}
      onChange={setPreference}
      popupMatchSelectWidth={150}
      options={[
        { value: 'light', label: 'Día' },
        { value: 'dark', label: 'Noche' },
        { value: 'system', label: 'Sistema' },
      ]}
    />
  );
}

export function PaletteSelector() {
  const { palette, setPalette } = useContext(ThemeContext);
  return (
    <Select
      className="palette-selector"
      aria-label="Estilo de color"
      value={palette}
      onChange={setPalette}
      popupMatchSelectWidth={150}
      options={[
        { value: 'orange', label: '🟠 Solar Orange' },
        { value: 'cobalt', label: '🔵 Azul Cobalto' },
      ]}
    />
  );
}
