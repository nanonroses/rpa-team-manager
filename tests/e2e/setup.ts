/**
 * E2E Test Setup
 * Se ejecuta una vez antes de todos los tests E2E
 */

export default async function globalSetup() {
    console.log('\n🚀 Setting up E2E test environment...\n');

    // Aquí se podría:
    // 1. Iniciar servidores de prueba
    // 2. Crear base de datos de test
    // 3. Seedear datos iniciales

    // Por ahora solo configuramos variables de entorno
    process.env.TEST_MODE = 'e2e';
    process.env.API_URL = 'http://localhost:5001';
    process.env.APP_URL = 'http://localhost:3000';

    console.log('✅ E2E setup complete\n');
}
