/**
 * E2E Test Teardown
 * Se ejecuta una vez después de todos los tests E2E
 */

export default async function globalTeardown() {
    console.log('\n🧹 Cleaning up E2E test environment...\n');

    // Aquí se podría:
    // 1. Cerrar servidores
    // 2. Limpiar base de datos de test
    // 3. Cerrar conexiones

    console.log('✅ E2E cleanup complete\n');
}
