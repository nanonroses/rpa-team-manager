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

// Mock de localStorage - implementacion real en memoria (no un stub que siempre
// devuelve null), para que componentes que guardan preferencias (ej. filtros de
// TasksPage) se puedan probar de verdad. Se limpia sola entre tests via afterEach.
const localStorageStore = new Map<string, string>();
const localStorageMock = {
    getItem: (key: string) => (localStorageStore.has(key) ? localStorageStore.get(key)! : null),
    setItem: (key: string, value: string) => { localStorageStore.set(key, String(value)); },
    removeItem: (key: string) => { localStorageStore.delete(key); },
    clear: () => { localStorageStore.clear(); },
    key: (index: number) => Array.from(localStorageStore.keys())[index] ?? null,
    get length() { return localStorageStore.size; },
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Aisla los tests entre si: sin esto, un valor guardado por un test podria
// filtrarse al siguiente test dentro del mismo archivo.
afterEach(() => {
    localStorageStore.clear();
});
