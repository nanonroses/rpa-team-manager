/**
 * Jest Setup File
 * Se ejecuta antes de cada archivo de test
 */

// Configurar variables de entorno para tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.PORT = '5002'; // Puerto diferente para tests

// Fija la zona horaria de los tests a la del equipo (Chile, UTC-3/-4), sin depender
// de la del host que corre la suite. Sin esto, tests de regresión de fechas/horas
// (ej. projectHealthService) solo detectan el bug en hosts al oeste de UTC como
// Chile, y pasarían en falso en un runner de CI en UTC o al este.
process.env.TZ = 'America/Santiago';

// Timeout global para tests async
jest.setTimeout(10000);

// Mock de console para tests más limpios (opcional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
// };

// Limpieza después de cada test
afterEach(() => {
    jest.clearAllMocks();
});

// Limpieza después de todos los tests
afterAll(async () => {
    // Cerrar conexiones de base de datos si es necesario
    // await db.close();
});
