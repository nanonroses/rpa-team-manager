/**
 * Vitest Setup File
 * Se ejecuta antes de cada archivo de test
 */

import '@testing-library/jest-dom';

// Mock de matchMedia para Ant Design
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => { },
        removeListener: () => { },
        addEventListener: () => { },
        removeEventListener: () => { },
        dispatchEvent: () => false,
    }),
});

// Mock de ResizeObserver para algunos componentes
global.ResizeObserver = class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
};

// Mock de scrollTo para tests de navegación
window.scrollTo = () => { };

// Mock de localStorage
const localStorageMock = {
    getItem: (_key: string) => null,
    setItem: (_key: string, _value: string) => { },
    removeItem: (_key: string) => { },
    clear: () => { },
    length: 0,
    key: (_index: number) => null,
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });
