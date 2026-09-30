# Especificación Técnica de UI, Theming (Día/Noche) y Ant Design v5

> **ESTÁNDAR OBLIGATORIO Y PERMANENTE**  
> Todo componente de interfaz en **RPA Team Manager** debe cumplir estrictamente esta especificación.  
> Bajo ninguna circunstancia se permite introducir componentes o estilos que violen estas reglas.

---

## 1. Principio Fundamental: "UX/UI es lo primordial"

En RPA Team Manager, la experiencia de usuario (UX) y el diseño visual (UI) son prioritarios. La plataforma cuenta con soporte nativo para:
- **Modos de apariencia:** **Día** (Light) y **Noche** (Dark).
- **Estilos de color:** Paleta **Orange** (naranja corporativo) y paleta **Cobalt** (azul cobalto).

Un componente no se considera terminado si no ha sido verificado y validado en **ambos modos (Día y Noche)**.

---

## 2. Las 7 Reglas de Oro de Theming

### Regla 1: PROHIBIDO quemar colores hexadecimales o RGB fijos
Nunca declares estilos en línea o CSS con colores estáticos como `#fafafa`, `#f5f5f5`, `#d9d9d9`, `#262626`, `#595959` o `rgb(250, 250, 250)`.
En modo noche, esos colores generan cajas blancas deslumbrantes o textos completamente invisibles.

### Regla 2: Uso obligatorio de Design Tokens de Ant Design (`theme.useToken()`)
Todo componente con personalizaciones visuales debe importar `theme` de `antd` y extraer `token`:

```tsx
import { theme } from 'antd';

export const MiComponente: React.FC = () => {
  const { token } = theme.useToken();
  const isDark = typeof document !== 'undefined' && (
    document.documentElement.dataset.theme === 'dark' ||
    token.colorBgBase === '#0F0F10' ||
    token.colorBgContainer === '#171718' ||
    token.colorBgElevated === '#262626'
  );
  // ...
};
```

### Regla 3: Mapeo estricto de colores y superficies

| Elemento Visual | Anti-patrón PROHIBIDO ❌ | Patrón Obligatorio APROBADO ✅ |
| :--- | :--- | :--- |
| **Fondo secundario / cajas de atajos** | `backgroundColor: '#fafafa'` o `#f5f5f5` | `backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : token.colorFillAlter` |
| **Pista de progreso / barra de fondo** | `backgroundColor: '#f5f5f5'` | `backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#f0f2f5'` |
| **Bordes de cajas secundarias** | `border: '1px dashed #d9d9d9'` | `border: \`1px dashed ${token.colorBorderSecondary}\`` |
| **Bordes estándar de tablas o paneles** | `border: '1px solid #f0f0f0'` | `border: \`1px solid ${token.colorBorderSecondary}\`` |
| **Texto principal** | `color: '#000000'` o `#262626` | `<Typography.Text>` o `color: token.colorText` |
| **Texto secundario / glosas / notas** | `color: '#595959'` o `#8c8c8c` | `<Typography.Text type="secondary">` o `color: token.colorTextSecondary` |
| **Insignias y tags en modo noche** | Pasteles con fondo claro (`#e6fffb`) | Translúcidos luminosos (`rgba(19, 194, 194, 0.15)` con texto `#36cfc9`) |

### Regla 4: Ant Design v5 estricto (Cero deprecaciones)
Ant Design v5 deprecó las propiedades `bodyStyle` y `headStyle` en componentes `<Card>` y `<Modal>`.
- ❌ **Prohibido:** `<Card bodyStyle={{ padding: 24 }}>`
- ✅ **Obligatorio:** `<Card styles={{ body: { padding: 24 } }}>`

### Regla 5: Componentes dentro de Modales (`bordered={false}`)
Cuando un componente configurable (como un editor, formulario de imputación o resumen) pueda renderizarse tanto en una página como dentro de un `<Modal>` de Ant Design:
- Debe soportar la prop `bordered?: boolean` (por defecto `true`).
- Al abrirse dentro de un `<Modal>`, debe pasarse `bordered={false}` para no anidar tarjetas, sombras y marcos redundantes dentro del diálogo.
- La superficie del diálogo en modo noche es `token.colorBgElevated` (`#262626`), por lo que los elementos internos deben descansar sobre ella con fondos translúcidos suaves (`rgba(255, 255, 255, 0.04)`).

### Regla 6: Estados vacíos y placeholders
Los mensajes de tabla vacía, estados sin datos y guiones (`-`):
- ❌ **Prohibido:** `<span style={{ color: '#8c8c8c' }}>-</span>`
- ✅ **Obligatorio:** `<Typography.Text type="secondary">-</Typography.Text>`

### Regla 7: Botones destacados y primarios
Los botones de atajos recomendados deben tener jerarquía clara:
- En atajos o presets de 1 clic, el preset principal sugerido debe usar `type="primary"` sólido o estilos contrastantes que mantengan accesibilidad en dark mode sin depender de filtros oscuros.

### Regla 8: Menús Desplegables (`<Select>`, `<Dropdown>`, `<DatePicker>`, `<Cascader>`)
En Modo Noche, NUNCA debe filtrarse un fondo de opción seleccionado en crema o blanco claro (`#FFF7ED` o `#EFF6FF`):
- Los items seleccionados deben usar fondos oscuros translúcidos con tinte del acento (`rgba(234, 88, 12, 0.22)` en Orange o `rgba(37, 99, 235, 0.22)` en Cobalt) con texto de alto contraste (`#FB923C` / `#60A5FA`).
- Los items en hover deben usar `rgba(255, 255, 255, 0.08)`.
- Los items no seleccionados deben usar texto claro `#F5F5F5` sobre la superficie elevada `#262626`.
- El texto o spans dentro de opciones personalizadas (`<Option>`) debe heredar el color activo para evitar texto blanco sobre fondos claros.

---

## 3. Script de Auditoría Automática (`npm run check:theme`)

Para garantizar que ningún commit o cambio viole esta especificación, se ha incorporado el script:

```bash
cd frontend && npm run check:theme
```

Este script:
1. Inspecciona todos los archivos `.tsx` y `.ts` en `frontend/src`.
2. Detecta automáticamente propiedades deprecadas (`bodyStyle`, `headStyle`).
3. Detecta fondos quemados (`#fafafa`, `#f5f5f5`, `rgb(250, 250, 250)`).
4. Detecta textos oscuros quemados (`#262626`, `#595959`).
5. Detecta bordes claros no adaptativos (`#d9d9d9`, `#f0f0f0`).
6. Si encuentra alguna violación, interrumpe el proceso con código de salida `1` indicando archivo, línea y regla.

Está integrado directamente en:
```bash
npm run lint
```

---

## 4. Checklist Obligatorio Pre-Finalización

Antes de dar por completada cualquier tarea que involucre interfaz o componentes UI:

- [ ] 1. ¿Se ejecutó `npm run check:theme` y dio **0 violaciones**?
- [ ] 2. ¿El componente utiliza `styles={{ body: ... }}` en vez de `bodyStyle`?
- [ ] 3. ¿El componente utiliza `theme.useToken()` para bordes, fondos y colores de texto?
- [ ] 4. ¿Se verificó visualmente o por diseño que no existan cuadros con fondo blanco/gris claro en modo Noche?
- [ ] 5. ¿Los modales se ven limpios sin doble borde ni doble fondo anidado?
- [ ] 6. ¿`npm run build` compila con 0 errores de tipos y 0 warnings de deprecación?
