/**
 * Jest Setup File
 * Se ejecuta antes de cada archivo de test
 */

// Configurar variables de entorno para tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.PORT = '5002'; // Puerto diferente para tests

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
