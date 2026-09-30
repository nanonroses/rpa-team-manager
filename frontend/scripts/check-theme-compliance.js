#!/usr/bin/env node
/**
 * RPA Team Manager - Theme & UI Compliance Auditor
 *
 * Scans frontend/src for:
 * 1. Deprecated Ant Design v4 properties (e.g., bodyStyle, headStyle)
 * 2. Hardcoded light/dark background colors that break Day/Night mode
 * 3. Hardcoded text colors that cause illegibility in Dark mode
 * 4. Hardcoded borders that do not adapt to theme tokens
 *
 * Exit code 0: All clean
 * Exit code 1: Violations found
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, '../src');

// Anti-patterns that break Day/Night theming or AntD v5 standards
const RULES = [
  {
    id: 'ANTD_DEPRECATED_BODYSTYLE',
    name: 'Deprecated bodyStyle prop on AntD Card/Modal (Use styles.body instead)',
    regex: /\bbodyStyle\s*=/g,
    severity: 'error',
  },
  {
    id: 'ANTD_DEPRECATED_HEADSTYLE',
    name: 'Deprecated headStyle prop on AntD Card (Use styles.header instead)',
    regex: /\bheadStyle\s*=/g,
    severity: 'error',
  },
  {
    id: 'HARDCODED_LIGHT_BG_FAFAFA',
    name: 'Hardcoded light background #fafafa (Breaks Dark Mode: Use token.colorFillAlter or isDark ? "rgba(255,255,255,0.04)" : ...)',
    regex: /backgroundColor:\s*['"]#fafafa['"]/g,
    severity: 'error',
  },
  {
    id: 'HARDCODED_LIGHT_BG_F5F5F5',
    name: 'Hardcoded light background #f5f5f5 (Breaks Dark Mode: Use token.colorBgLayout or token.colorFillAlter)',
    regex: /backgroundColor:\s*['"]#f5f5f5['"]/g,
    severity: 'error',
  },
  {
    id: 'HARDCODED_LIGHT_BG_RGB_250',
    name: 'Hardcoded light background rgb(250, 250, 250) (Breaks Dark Mode)',
    regex: /backgroundColor:\s*['"]rgb\(250,\s*250,\s*250\)['"]/g,
    severity: 'error',
  },
  {
    id: 'HARDCODED_LIGHT_BORDER_D9D9D9',
    name: 'Hardcoded border #d9d9d9 (Breaks Dark Mode: Use token.colorBorder or token.colorBorderSecondary)',
    regex: /border(Color)?:\s*['"][^'"]*#d9d9d9['"]/g,
    severity: 'error',
  },
  {
    id: 'HARDCODED_LIGHT_BORDER_F0F0F0',
    name: 'Hardcoded border #f0f0f0 (Breaks Dark Mode: Use token.colorBorderSecondary)',
    regex: /border(Color)?:\s*['"][^'"]*#f0f0f0['"]/g,
    severity: 'error',
  },
  {
    id: 'HARDCODED_DARK_TEXT_262626',
    name: 'Hardcoded dark text #262626 (Breaks Dark Mode: Use token.colorText)',
    regex: /color:\s*['"]#262626['"]/g,
    severity: 'error',
  },
  {
    id: 'HARDCODED_DARK_TEXT_595959',
    name: 'Hardcoded dark text #595959 (Breaks Dark Mode: Use token.colorTextSecondary)',
    regex: /color:\s*['"]#595959['"]/g,
    severity: 'error',
  },
];

// Files or directories to skip (e.g. third-party, generated tokens definition itself)
const EXCLUDED_PATHS = [
  'node_modules',
  'dist',
  'designTokens.ts', // Definition of palettes
  'ThemeProvider.tsx', // Core provider definition
  '.d.ts',
];

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!EXCLUDED_PATHS.some((ex) => file.includes(ex))) {
        getAllFiles(fullPath, arrayOfFiles);
      }
    } else {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        if (!EXCLUDED_PATHS.some((ex) => file.includes(ex))) {
          arrayOfFiles.push(fullPath);
        }
      }
    }
  });

  return arrayOfFiles;
}

function auditFiles() {
  console.log('\n🎨 ============================================');
  console.log('   RPA Team Manager - Theme & UI Audit');
  console.log('============================================\n');

  const files = getAllFiles(SRC_DIR);
  let totalErrors = 0;
  const violations = [];

  for (const filePath of files) {
    const relPath = path.relative(path.resolve(__dirname, '..'), filePath).replace(/\\/g, '/');
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((lineText, lineIdx) => {
      // Allow explicit opt-out with // theme-ignore
      if (lineText.includes('// theme-ignore')) return;

      for (const rule of RULES) {
        rule.regex.lastIndex = 0;
        if (rule.regex.test(lineText)) {
          // If it's a ternary with isDark, allow it
          if (lineText.includes('isDark') || lineText.includes('dark ?')) {
            continue;
          }

          totalErrors++;
          violations.push({
            file: relPath,
            line: lineIdx + 1,
            ruleId: rule.id,
            ruleName: rule.name,
            snippet: lineText.trim(),
          });
        }
      }
    });
  }

  if (violations.length === 0) {
    console.log(`✅ EXCELENTE: Se analizaron ${files.length} archivos.`);
    console.log('✨ 0 violaciones de Theming (Día/Noche) y Ant Design v5 encontradas.\n');
    process.exit(0);
  } else {
    console.error(`❌ SE ENCONTRARON ${violations.length} VIOLACIONES DE THEMING / UI:\n`);
    violations.forEach((v, i) => {
      console.error(`${i + 1}. [${v.ruleId}] en ${v.file}:${v.line}`);
      console.error(`   Regla: ${v.ruleName}`);
      console.error(`   Línea: "${v.snippet}"\n`);
    });
    console.error('Por favor reemplaza los colores fijos por Ant Design Design Tokens (theme.useToken())');
    console.error('o acondiciona la propiedad con "isDark ? ... : ...".\n');
    process.exit(1);
  }
}

auditFiles();
